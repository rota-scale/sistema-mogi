package ocorrencias

import (
	"cmp"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/cidade"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/geo"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/imagem"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/midia"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/texto"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

const (
	validadeLeitura = 6 * time.Hour
	// validadeVideo é curta: o link do vídeo original é pedido na hora de ver.
	validadeVideo = 10 * time.Minute

	// Limites de um relato (ADR 0015).
	fotosMaximas   = 4
	quadrosMaximos = 3
	fotoMaxima     = 12 << 20
	videoMaximo    = 25 << 20
	videoSegundos  = 15
	// corpoMaximo soma tudo, com folga para os campos de texto.
	corpoMaximo = fotosMaximas*fotoMaxima + videoMaximo + quadrosMaximos*(2<<20) + 1<<20
	// memoriaDoFormulario é o que fica em memória ao ler o multipart; o resto
	// (o vídeo) vai para arquivo temporário.
	memoriaDoFormulario = 8 << 20
)

type Handlers struct {
	Repo     *Repositorio
	Midia    midia.Armazenamento
	Borrador midia.Borrador
	// Conteudo recusa foto de interior, pessoal ou íntima antes de gravar. Nulo desliga.
	Conteudo  midia.Verificador
	Assinador midia.Assinador
	Geo       geo.Geocodificador
	// Ceps busca a cidade e o bairro pelo CEP (ViaCEP). Nulo não acha nenhum.
	Ceps    geo.BuscaCep
	Triagem *triagem.Servico
	Log     *slog.Logger
	// Cidade e IAAtiva vão no GET /config para o app do morador.
	Cidade  string
	IAAtiva bool
	// Caixa é a cerca do município; nula aceita relato de qualquer lugar.
	Caixa *Caixa
	// Video liga o envio de vídeo curto no relato (MODULO_VIDEO do ambiente).
	// Para valer, o módulo também precisa estar ligado nos parâmetros.
	Video bool
	// Centro é o ponto central da cidade, para o mapa do app abrir no lugar certo.
	CentroLat, CentroLng float64
	// Parametros devolve os ajustes em vigor (ADR 0018). Nulo vale o padrão.
	Parametros func(context.Context) cidade.Parametros
	// Morador devolve o id do cadastro do morador pelo token do pedido, ou
	// vazio sem cadastro (ADR 0024). Nulo trata todo pedido como sem cadastro.
	Morador func(*http.Request) string
	// OcultarDemo esconde os chamados simulados da lista do painel quando o
	// pedido não diz nada (?demo=). Ligado quando DEMO_CHAMADOS=0: a central
	// vê só relatos reais e pede ?demo=incluir para ver a demonstração.
	OcultarDemo bool

	// vagas limita quantas fotos são abertas e borradas ao mesmo tempo, para
	// uma rajada de envios não esgotar a memória do servidor.
	vagas chan struct{}
	// emVoo guarda as chaves de idempotência com envio em andamento.
	mu    sync.Mutex
	emVoo map[string]chan struct{}
}

func (h *Handlers) parametros(ctx context.Context) cidade.Parametros {
	if h.Parametros == nil {
		return cidade.Padrao()
	}
	return h.Parametros(ctx)
}

// moradorDoPedido identifica quem envia. Com o módulo cadastro ligado, sem
// cadastro responde 401 com o código que o app entende e devolve ok falso.
func (h *Handlers) moradorDoPedido(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := ""
	if h.Morador != nil {
		id = h.Morador(r)
	}
	if id == "" && h.parametros(r.Context()).Modulos.Cadastro {
		httpx.ErroCodigo(w, http.StatusUnauthorized, "cadastro_obrigatorio", "Faça seu cadastro para relatar")
		return "", false
	}
	return id, true
}

// videoLigado junta a chave do ambiente com o módulo dos parâmetros.
func (h *Handlers) videoLigado(ctx context.Context) bool {
	return h.Video && h.parametros(ctx).Modulos.Video
}

// Caixa é um retângulo de coordenadas (a cerca do município).
type Caixa struct{ MinLng, MinLat, MaxLng, MaxLat float64 }

// Contem diz se o ponto está dentro da caixa.
func (c Caixa) Contem(lat, lng float64) bool {
	return lat >= c.MinLat && lat <= c.MaxLat && lng >= c.MinLng && lng <= c.MaxLng
}

// LerCaixa interpreta "minLng,minLat,maxLng,maxLat". Vazio devolve nil.
func LerCaixa(s string) (*Caixa, error) {
	if strings.TrimSpace(s) == "" {
		return nil, nil
	}
	p := strings.Split(s, ",")
	if len(p) != 4 {
		return nil, errors.New("caixa da cidade deve ter minLng,minLat,maxLng,maxLat")
	}
	var v [4]float64
	for i := range p {
		f, err := strconv.ParseFloat(strings.TrimSpace(p[i]), 64)
		if err != nil {
			return nil, errors.New("caixa da cidade com número inválido")
		}
		v[i] = f
	}
	c := &Caixa{v[0], v[1], v[2], v[3]}
	if c.MinLng >= c.MaxLng || c.MinLat >= c.MaxLat {
		return nil, errors.New("caixa da cidade com cantos trocados")
	}
	return c, nil
}

// borroesSimultaneos é quantas fotos são processadas ao mesmo tempo.
const borroesSimultaneos = 3

// ocupar espera uma vaga de processamento de foto e devolve como liberar.
func (h *Handlers) ocupar(ctx context.Context) (func(), error) {
	h.mu.Lock()
	if h.vagas == nil {
		h.vagas = make(chan struct{}, borroesSimultaneos)
	}
	vagas := h.vagas
	h.mu.Unlock()
	select {
	case vagas <- struct{}{}:
		return func() { <-vagas }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// entrar marca a chave de idempotência como em andamento. Se outro envio
// com a mesma chave já está em curso (o morador tocou em tentar de novo),
// espera ele terminar e devolve falso: o chamador responde com o recibo.
func (h *Handlers) entrar(ctx context.Context, chave string) (primeiro bool, sair func()) {
	if chave == "" {
		return true, func() {}
	}
	h.mu.Lock()
	if h.emVoo == nil {
		h.emVoo = map[string]chan struct{}{}
	}
	if fim, ok := h.emVoo[chave]; ok {
		h.mu.Unlock()
		select {
		case <-fim:
		case <-ctx.Done():
		}
		return false, func() {}
	}
	fim := make(chan struct{})
	h.emVoo[chave] = fim
	h.mu.Unlock()
	return true, func() {
		h.mu.Lock()
		delete(h.emVoo, chave)
		h.mu.Unlock()
		close(fim)
	}
}

// cronometro mede as etapas fora da triagem para o log do RF11.
type cronometro struct{ etapas []triagem.Etapa }

func (c *cronometro) medir(nome, provedor string, f func() error) error {
	t0 := time.Now()
	err := f()
	e := triagem.Etapa{Nome: nome, Provedor: provedor, MS: time.Since(t0).Milliseconds(), OK: err == nil}
	if err != nil {
		e.Erro = texto.Cortar(err.Error(), 200)
	}
	c.etapas = append(c.etapas, e)
	return err
}

// Criar trata POST /ocorrencias (multipart: foto, lat, lng, precisao, texto,
// categoria, local_manual). O cabeçalho Idempotency-Key torna o envio
// repetível: a mesma chave devolve o mesmo recibo, sem novo relato.
func (h *Handlers) Criar(w http.ResponseWriter, r *http.Request) {
	inicio := time.Now()
	// O cadastro é conferido antes de ler a foto: sem ele, nada é processado.
	moradorID, ok := h.moradorDoPedido(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, corpoMaximo)
	if err := r.ParseMultipartForm(memoriaDoFormulario); err != nil {
		var grande *http.MaxBytesError
		if errors.As(err, &grande) {
			httpx.ErroCodigo(w, http.StatusRequestEntityTooLarge, "foto_grande", "o envio passa do tamanho máximo")
			return
		}
		httpx.ErroCodigo(w, http.StatusBadRequest, "foto_ausente", "envie multipart com foto, lat e lng")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	idCliente := strings.ToLower(strings.TrimSpace(r.Header.Get("Idempotency-Key")))
	if !reUUID.MatchString(idCliente) {
		idCliente = ""
	}
	primeiro, sair := h.entrar(r.Context(), idCliente)
	defer sair()
	if h.responderRepetido(w, r, idCliente) {
		return
	}
	if !primeiro {
		// O primeiro envio terminou sem gravar (falhou): este segue como novo.
		h.Log.Info("reenvio depois de falha", "chave", idCliente)
	}

	lat, errLat := strconv.ParseFloat(r.FormValue("lat"), 64)
	lng, errLng := strconv.ParseFloat(r.FormValue("lng"), 64)
	if errLat != nil || errLng != nil || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		httpx.ErroCodigo(w, http.StatusBadRequest, "local_invalido", "lat e lng obrigatórios e válidos")
		return
	}
	if h.Caixa != nil && !h.Caixa.Contem(lat, lng) {
		httpx.ErroCodigo(w, http.StatusUnprocessableEntity, "fora_da_cidade", "o ponto fica fora de "+h.Cidade)
		return
	}
	manual := r.FormValue("local_manual") == "1"
	var precisao *float32
	if p, err := strconv.ParseFloat(r.FormValue("precisao"), 32); err == nil && p >= 0 && !manual {
		v := float32(p)
		precisao = &v
	}
	fotos := r.MultipartForm.File["foto"]
	if len(fotos) == 0 {
		httpx.ErroCodigo(w, http.StatusBadRequest, "foto_ausente", "campo foto obrigatório")
		return
	}
	if len(fotos) > fotosMaximas {
		httpx.ErroCodigo(w, http.StatusBadRequest, "fotos_demais", fmt.Sprintf("no máximo %d fotos por relato", fotosMaximas))
		return
	}
	videos := r.MultipartForm.File["video"]
	if len(videos) > 0 && !h.videoLigado(r.Context()) {
		videos = nil // módulo desligado: o relato segue só com as fotos
	}
	if len(videos) > 1 {
		httpx.ErroCodigo(w, http.StatusBadRequest, "fotos_demais", "no máximo 1 vídeo por relato")
		return
	}

	id := novoUUID()
	var cron cronometro
	var midias []NovaMidia
	// Se o relato não for gravado, o que já subiu ao armazenamento é apagado.
	gravado := false
	defer func() {
		if gravado {
			return
		}
		limpar, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelar()
		for _, m := range midias {
			for _, c := range []string{m.ChaveOriginal, m.ChavePublica} {
				if c != "" {
					_ = h.Midia.Apagar(limpar, c)
				}
			}
		}
	}()

	var capa []byte // primeira foto borrada: vai para a triagem
	var extras [][]byte
	for i, fh := range fotos {
		m, publica, falha := h.receberImagem(r.Context(), &cron, fh, id, "foto", i)
		if falha != nil {
			falha.escrever(w, h.Log)
			return
		}
		midias = append(midias, m)
		if i == 0 {
			capa = publica
		} else {
			extras = append(extras, publica)
		}
	}
	if len(videos) == 1 {
		m, falha := h.receberVideo(r.Context(), &cron, videos[0], id, r.FormValue("video_duracao_ms"))
		if falha != nil {
			falha.escrever(w, h.Log)
			return
		}
		midias = append(midias, m)
		// Os quadros do vídeo, extraídos no aparelho, viram a capa borrada dele.
		quadros := r.MultipartForm.File["quadro"]
		if len(quadros) > quadrosMaximos {
			quadros = quadros[:quadrosMaximos]
		}
		for i, fh := range quadros {
			q, _, falha := h.receberImagem(r.Context(), &cron, fh, id, "quadro", i)
			if falha != nil {
				h.Log.Warn("quadro de vídeo descartado", "erro", falha.msg)
				continue
			}
			midias = append(midias, q)
		}
	}
	chaveOriginal, chavePublica := midias[0].ChaveOriginal, midias[0].ChavePublica

	var end geo.Endereco
	if err := cron.medir("geocodigo", "nominatim", func() (e error) {
		ctxGeo, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancelar()
		end, e = h.Geo.Reverso(ctxGeo, lat, lng)
		return e
	}); err != nil {
		// Sem endereço o chamado continua; o ponto no mapa é a fonte.
		h.Log.Warn("geocodificação falhou", "erro", err)
	}

	escolhida := h.normalizarCategoria(r.Context(), r.FormValue("categoria"))
	// O texto é guardado já sem e-mail, CPF, telefone e placa: ele aparece
	// para toda a equipe e segue pelo tempo real (RNF03).
	relato := texto.Cortar(triagem.SemDadosPessoais(strings.TrimSpace(r.FormValue("texto"))), 1000)
	res := h.Triagem.Triar(r.Context(), triagem.Entrada{
		Categoria: escolhida, Texto: relato, Bairro: end.Bairro,
		// Só a versão borrada segue para a visão (RF03, C6).
		Foto: capa, FotoTipo: "image/jpeg", FotosExtras: extras,
		// O ponto fica no servidor: só as ferramentas do agente de contexto usam.
		Ponto: &triagem.Ponto{Lat: lat, Lng: lng},
	})
	categoria := res.Categoria
	if categoria == "" {
		categoria = escolhida
	}
	if categoria == "" {
		categoria = "outros"
	}

	nova := Nova{
		ID:            id,
		Categoria:     categoria,
		Secretaria:    res.Secretaria,
		Texto:         relato,
		Lat:           lat,
		Lng:           lng,
		PrecisaoM:     precisao,
		Endereco:      end.Endereco,
		Bairro:        end.Bairro,
		MidiaOriginal: chaveOriginal,
		MidiaPublica:  chavePublica,
		Status:        res.Status,
		Nivel:         res.Nivel,
		Triagem:       res.Registro,
		PrazoAte:      res.PrazoAte,
		PrazoFonte:    res.PrazoFonte,
		Etapas:        append(cron.etapas, res.Etapas...),
		LatenciaMS:    time.Since(inicio).Milliseconds(),
		IDCliente:     idCliente,
		Chave:         novaChave(),
		Aparelho:      strings.TrimPrefix(httpx.Aparelho(r), "aparelho:"),
		Manual:        manual,
		Midias:        midias,
		RetencaoDias:  h.parametros(r.Context()).RetencaoDias,
		MoradorID:     moradorID,
		ForaDoEscopo:  res.ForaDoEscopo,
	}
	o, agrupada, err := h.Repo.Registrar(r.Context(), nova, h.Triagem.Reavaliar, time.Now())
	if errors.Is(err, ErrRepetido) && h.responderRepetido(w, r, idCliente) {
		return
	}
	if err != nil {
		h.Log.Error("registrar ocorrência", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao gravar a ocorrência")
		return
	}
	gravado = true
	h.Log.Info("relato registrado", "protocolo", o.Protocolo, "nivel", o.Nivel, "status", o.Status,
		"agrupada", agrupada, "relatos", o.Relatos, "midias", len(midias), "ms", nova.LatenciaMS, "custo_brl", nova.custo())
	httpx.JSON(w, http.StatusCreated, ReciboDe(o, nova, agrupada))
}

// falhaDeEnvio é um erro de mídia já traduzido para o morador.
type falhaDeEnvio struct {
	status      int
	codigo, msg string
	causa       error
}

func (f *falhaDeEnvio) escrever(w http.ResponseWriter, log *slog.Logger) {
	if f.causa != nil {
		log.Error("mídia do relato", "codigo", f.codigo, "erro", f.causa)
	}
	httpx.ErroCodigo(w, f.status, f.codigo, f.msg)
}

// chaveDaMidia monta o nome do arquivo no armazenamento. A primeira foto
// mantém os nomes de sempre (original e publica), as outras ganham número.
func chaveDaMidia(id, base string, indice int, ext string) string {
	if indice > 0 || base == "quadro" {
		return fmt.Sprintf("ocorrencias/%s/%s-%d.%s", id, base, indice+1, ext)
	}
	return fmt.Sprintf("ocorrencias/%s/%s.%s", id, base, ext)
}

// receberImagem confere, borra e grava uma foto ou um quadro de vídeo.
// Da foto ficam a original e a borrada; do quadro, só a borrada (a original
// do quadro é o próprio vídeo). Devolve também os bytes borrados.
// MensagemFotoNaoAceita aparece ao morador quando a foto não é de lugar público.
const MensagemFotoNaoAceita = "Não aceitamos foto de dentro de casa, nem foto pessoal ou íntima. Fotografe o problema na rua, sem pessoas em destaque."

func (h *Handlers) receberImagem(ctx context.Context, cron *cronometro, fh *multipart.FileHeader, id, tipo string, indice int) (NovaMidia, []byte, *falhaDeEnvio) {
	if fh.Size > fotoMaxima {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusRequestEntityTooLarge, "foto_grande", "a foto passa de 12 MB", nil}
	}
	arquivo, err := fh.Open()
	if err != nil {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusBadRequest, "foto_ausente", "falha ao ler a foto", nil}
	}
	defer arquivo.Close()
	original, err := io.ReadAll(io.LimitReader(arquivo, fotoMaxima+1))
	if err != nil {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusBadRequest, "foto_ausente", "falha ao ler a foto", nil}
	}
	mime := http.DetectContentType(original)
	if mime != "image/jpeg" && mime != "image/png" {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusUnsupportedMediaType, "foto_formato", "foto deve ser JPEG ou PNG", nil}
	}
	cfg, err := imagem.Conferir(original)
	if errors.Is(err, imagem.ErrGrande) {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusRequestEntityTooLarge, "foto_grande", "a foto tem resolução grande demais", nil}
	} else if err != nil {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusUnsupportedMediaType, "foto_formato", "foto deve ser JPEG ou PNG", nil}
	}

	var publica []byte
	err = cron.medir("borrao", fmt.Sprintf("%T", h.Borrador), func() error {
		liberar, e := h.ocupar(ctx)
		if e != nil {
			return e
		}
		defer liberar()
		publica, e = h.Borrador.Borrar(original)
		return e
	})
	if errors.Is(err, midia.ErrImagemInvalida) {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusUnsupportedMediaType, "foto_formato", err.Error(), nil}
	} else if err != nil {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusInternalServerError, "interno", "falha ao processar a foto", err}
	}

	// Foto de morador é conferida antes de gravar: se não for lugar público,
	// nada vai ao armazenamento. A conferência de equipe (quadro, depois) não passa por aqui.
	if tipo == "foto" && h.Conteudo != nil {
		var v midia.Veredito
		err = cron.medir("conteudo", fmt.Sprintf("%T", h.Conteudo), func() error {
			var e error
			v, e = h.Conteudo.Verificar(ctx, original, publica)
			return e
		})
		if errors.Is(err, midia.ErrImagemInvalida) {
			return NovaMidia{}, nil, &falhaDeEnvio{http.StatusUnsupportedMediaType, "foto_formato", err.Error(), nil}
		} else if err != nil {
			return NovaMidia{}, nil, &falhaDeEnvio{http.StatusServiceUnavailable, "foto_nao_verificada", "não consegui conferir a foto agora. Tente de novo em instantes.", err}
		}
		if !v.Aceita {
			return NovaMidia{}, nil, &falhaDeEnvio{http.StatusUnprocessableEntity, "foto_nao_aceita", MensagemFotoNaoAceita, nil}
		}
	}

	m := NovaMidia{Tipo: tipo, Mime: "image/jpeg", Largura: cfg.Width, Altura: cfg.Height, Bytes: int64(len(original))}
	if tipo == "quadro" || tipo == "depois" {
		// Só a versão borrada é guardada.
		m.ChavePublica = chaveDaMidia(id, tipo, indice, "jpg")
	} else {
		ext := map[string]string{"image/jpeg": "jpg", "image/png": "png"}[mime]
		m.ChaveOriginal = chaveDaMidia(id, "original", indice, ext)
		m.ChavePublica = chaveDaMidia(id, "publica", indice, "jpg")
	}
	err = cron.medir("armazenamento", "s3", func() error {
		if m.ChaveOriginal != "" {
			if err := h.Midia.Gravar(ctx, m.ChaveOriginal, mime, original); err != nil {
				return err
			}
		}
		return h.Midia.Gravar(ctx, m.ChavePublica, "image/jpeg", publica)
	})
	if err != nil {
		return NovaMidia{}, nil, &falhaDeEnvio{http.StatusBadGateway, "midia_indisponivel", "armazenamento de mídia indisponível", err}
	}
	return m, publica, nil
}

// receberVideo confere o contêiner e grava o vídeo original. Ele não é
// borrado (o servidor não decodifica vídeo): fica restrito, sem áudio, e só
// abre por link pedido por um servidor logado (ADR 0015).
func (h *Handlers) receberVideo(ctx context.Context, cron *cronometro, fh *multipart.FileHeader, id, duracaoDeclarada string) (NovaMidia, *falhaDeEnvio) {
	if fh.Size > videoMaximo {
		return NovaMidia{}, &falhaDeEnvio{http.StatusRequestEntityTooLarge, "video_grande", "o vídeo passa de 25 MB", nil}
	}
	arquivo, err := fh.Open()
	if err != nil {
		return NovaMidia{}, &falhaDeEnvio{http.StatusBadRequest, "video_formato", "falha ao ler o vídeo", nil}
	}
	defer arquivo.Close()
	info, err := midia.InspecionarVideo(arquivo, fh.Size)
	if err != nil {
		return NovaMidia{}, &falhaDeEnvio{http.StatusUnsupportedMediaType, "video_formato", "vídeo deve ser MP4 ou WebM", nil}
	}
	if info.TemAudio {
		return NovaMidia{}, &falhaDeEnvio{http.StatusUnprocessableEntity, "video_com_audio", "o vídeo precisa vir sem áudio", nil}
	}
	duracao := info.DuracaoMS
	if duracao == 0 {
		// Gravação do navegador não declara a duração no arquivo: vale a do app.
		if d, err := strconv.ParseInt(duracaoDeclarada, 10, 64); err == nil && d > 0 {
			duracao = d
		}
	}
	if duracao > (videoSegundos+2)*1000 {
		return NovaMidia{}, &falhaDeEnvio{http.StatusUnprocessableEntity, "video_longo", fmt.Sprintf("o vídeo passa de %d segundos", videoSegundos), nil}
	}
	m := NovaMidia{Tipo: "video", Mime: info.Mime, DuracaoMS: duracao, Bytes: fh.Size,
		ChaveOriginal: fmt.Sprintf("ocorrencias/%s/video.%s", id, info.Extensao)}
	err = cron.medir("armazenamento", "s3", func() error {
		return h.Midia.GravarFluxo(ctx, m.ChaveOriginal, info.Mime, arquivo, fh.Size)
	})
	if err != nil {
		return NovaMidia{}, &falhaDeEnvio{http.StatusBadGateway, "midia_indisponivel", "armazenamento de mídia indisponível", err}
	}
	return m, nil
}

// responderRepetido devolve o recibo de um relato que o servidor já tem com
// esta chave de idempotência. O resultado diz se a resposta foi escrita.
func (h *Handlers) responderRepetido(w http.ResponseWriter, r *http.Request, idCliente string) bool {
	if idCliente == "" {
		return false
	}
	rc, existe, err := h.Repo.ReciboPorCliente(r.Context(), idCliente)
	if err != nil {
		h.Log.Error("consultar relato repetido", "erro", err)
		return false
	}
	if existe {
		h.Log.Info("reenvio do mesmo relato", "protocolo", rc.Protocolo)
		httpx.JSON(w, http.StatusOK, rc)
	}
	return existe
}

// novaChave gera o segredo de acompanhamento entregue ao morador.
func novaChave() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Listar trata GET /ocorrencias?status=&limite=.
func (h *Handlers) Listar(w http.ResponseWriter, r *http.Request) {
	limite, err := strconv.Atoi(r.URL.Query().Get("limite"))
	if err != nil || limite <= 0 || limite > 5000 {
		limite = 1000
	}
	// A equipe de campo só enxerga os chamados da própria secretaria.
	u, _ := auth.DoContexto(r.Context())
	secretaria := ""
	if u.Papel == auth.PapelCampo {
		secretaria = u.Secretaria
	}
	lista, err := h.Repo.Listar(r.Context(), r.URL.Query().Get("status"), limite, secretaria,
		LerFiltroDemo(r.URL.Query().Get("demo"), h.filtroDemoPadrao()))
	if err != nil {
		h.Log.Error("listar", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao listar")
		return
	}
	for i := range lista {
		h.assinar(&lista[i])
	}
	httpx.JSON(w, http.StatusOK, lista)
}

// filtroDemoPadrao é o que vale quando o pedido não traz ?demo=.
func (h *Handlers) filtroDemoPadrao() FiltroDemo {
	if h.OcultarDemo {
		return DemoOcultar
	}
	return DemoIncluir
}

// Buscar trata GET /ocorrencias/{id}, com os relatos agrupados e as etapas.
func (h *Handlers) Buscar(w http.ResponseWriter, r *http.Request) {
	o, err := h.Repo.Buscar(r.Context(), r.PathValue("id"))
	if errors.Is(err, ErrNaoEncontrada) {
		httpx.Erro(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao buscar")
		return
	}
	if !podeVer(r.Context(), o) {
		httpx.Erro(w, http.StatusNotFound, ErrNaoEncontrada.Error())
		return
	}
	if err := h.Repo.Detalhes(r.Context(), &o); err != nil {
		h.Log.Error("detalhes", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao buscar os relatos")
		return
	}
	// Quem relatou é visto pela central e pelo gestor; a equipe de campo
	// atende o problema sem precisar saber de quem veio (LGPD, ADR 0024).
	if u, _ := auth.DoContexto(r.Context()); u.Papel == auth.PapelCampo {
		for i := range o.RelatosLista {
			o.RelatosLista[i].Morador = nil
		}
	}
	h.assinar(&o)
	httpx.JSON(w, http.StatusOK, o)
}

// responder traduz o resultado de uma transição de status.
func (h *Handlers) responder(w http.ResponseWriter, o Ocorrencia, err error, acao string) {
	switch {
	case errors.Is(err, ErrNaoEncontrada):
		httpx.Erro(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrNaoRevisavel), errors.Is(err, ErrTransicao):
		httpx.Erro(w, http.StatusConflict, err.Error())
	case err != nil:
		h.Log.Error(acao, "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao "+acao)
	default:
		h.assinar(&o)
		httpx.JSON(w, http.StatusOK, o)
	}
}

// Revisar trata POST /ocorrencias/{id}/revisao: o operador confirma ou
// ajusta o nível de um chamado em revisão ou a classificar (RF07).
func (h *Handlers) Revisar(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		Nivel int `json:"nivel"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&corpo); err != nil || corpo.Nivel < 1 || corpo.Nivel > 5 {
		httpx.Erro(w, http.StatusBadRequest, "informe nivel de 1 a 5")
		return
	}
	u, _ := auth.DoContexto(r.Context())
	// O prazo conta do relato do morador, não da hora da revisão: o tempo
	// parado na fila de revisão também é tempo de espera de quem relatou.
	desde := time.Now()
	if atual, err := h.Repo.Buscar(r.Context(), r.PathValue("id")); err == nil {
		desde = atual.CriadoEm
	}
	prazo, fonte := triagem.Prazo(corpo.Nivel, desde)
	o, err := h.Repo.Revisar(r.Context(), r.PathValue("id"), int16(corpo.Nivel), u.Login, prazo, fonte)
	h.responder(w, o, err, "revisar")
}

// nota lê um texto curto opcional do corpo JSON (observação ou motivo).
// Corpo vazio é aceito: o campo é opcional.
func nota(w http.ResponseWriter, r *http.Request, campo string) string {
	var corpo map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&corpo); err != nil {
		return ""
	}
	return notaDe(corpo, campo)
}

func notaDe(corpo map[string]any, campo string) string {
	s, _ := corpo[campo].(string)
	return texto.Cortar(triagem.SemDadosPessoais(strings.TrimSpace(s)), 300)
}

// podeVer diz se o usuário logado pode ver o chamado: operador e gestor
// veem todos; a equipe de campo, só os da própria secretaria.
func podeVer(ctx context.Context, o Ocorrencia) bool {
	u, _ := auth.DoContexto(ctx)
	if u.Papel != auth.PapelCampo {
		return true
	}
	return o.Secretaria != nil && *o.Secretaria == u.Secretaria
}

// doCampo confere, antes de uma ação da equipe de campo, se o chamado é da
// secretaria dela. Responde 404 e devolve falso quando não é.
func (h *Handlers) doCampo(w http.ResponseWriter, r *http.Request) bool {
	if u, _ := auth.DoContexto(r.Context()); u.Papel != auth.PapelCampo {
		return true
	}
	o, err := h.Repo.Buscar(r.Context(), r.PathValue("id"))
	if err != nil || !podeVer(r.Context(), o) {
		httpx.Erro(w, http.StatusNotFound, ErrNaoEncontrada.Error())
		return false
	}
	return true
}

// Despachar trata POST /ocorrencias/{id}/despacho, com observacao opcional
// e, se o operador quiser trocar a responsável, secretaria.
func (h *Handlers) Despachar(w http.ResponseWriter, r *http.Request) {
	var corpo map[string]any
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&corpo)
	observacao := notaDe(corpo, "observacao")
	secretaria, _ := corpo["secretaria"].(string)
	secretaria = strings.TrimSpace(secretaria)
	if secretaria != "" {
		validas, err := h.Repo.Secretarias(r.Context())
		if err != nil || !slices.Contains(validas, secretaria) {
			httpx.Erro(w, http.StatusBadRequest, "secretaria desconhecida")
			return
		}
	}
	u, _ := auth.DoContexto(r.Context())
	o, err := h.Repo.Despachar(r.Context(), r.PathValue("id"), u.Login, observacao, secretaria)
	h.responder(w, o, err, "despachar")
}

// fotosDoDepois é quantas fotos a equipe pode anexar ao resolver.
const fotosDoDepois = 3

// Resolver trata POST /ocorrencias/{id}/resolucao. Aceita JSON com motivo
// opcional ou multipart com motivo e até 3 fotos do depois (campo foto), que
// são borradas como as do morador e ficam no chamado como prova do serviço.
func (h *Handlers) Resolver(w http.ResponseWriter, r *http.Request) {
	if !h.doCampo(w, r) {
		return
	}
	u, _ := auth.DoContexto(r.Context())
	id := r.PathValue("id")
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		o, err := h.Repo.Resolver(r.Context(), id, u.Login, nota(w, r, "motivo"), nil)
		h.responder(w, o, err, "resolver")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, fotosDoDepois*fotoMaxima+1<<20)
	if err := r.ParseMultipartForm(memoriaDoFormulario); err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "foto_grande", "envie até 3 fotos de até 12 MB")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	arquivos := r.MultipartForm.File["foto"]
	if len(arquivos) > fotosDoDepois {
		httpx.ErroCodigo(w, http.StatusBadRequest, "fotos_demais", "no máximo 3 fotos do depois")
		return
	}
	// Só grava foto de chamado que existe e ainda pode ser resolvido.
	atual, err := h.Repo.Buscar(r.Context(), id)
	if err != nil || (atual.Status != "aberta" && atual.Status != "em_atendimento") {
		h.responder(w, atual, cmp.Or(err, ErrTransicao), "resolver")
		return
	}
	var cron cronometro
	var fotos []NovaMidia
	gravado := false
	defer func() {
		if gravado {
			return
		}
		limpar, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelar()
		for _, f := range fotos {
			_ = h.Midia.Apagar(limpar, f.ChavePublica)
		}
	}()
	// Cada resolução tem a sua pasta: reabrir e resolver de novo não sobrescreve.
	pasta := atual.ID + "/" + novoUUID()
	for i, fh := range arquivos {
		m, _, falha := h.receberImagem(r.Context(), &cron, fh, pasta, "depois", i)
		if falha != nil {
			falha.escrever(w, h.Log)
			return
		}
		fotos = append(fotos, m)
	}
	motivo := texto.Cortar(triagem.SemDadosPessoais(strings.TrimSpace(r.FormValue("motivo"))), 300)
	o, err := h.Repo.Resolver(r.Context(), id, u.Login, motivo, fotos)
	gravado = err == nil
	h.responder(w, o, err, "resolver")
}

// NaoEncontrado trata POST /ocorrencias/{id}/nao-encontrado: a equipe foi ao
// local e não achou o problema. O chamado volta para a revisão.
func (h *Handlers) NaoEncontrado(w http.ResponseWriter, r *http.Request) {
	if !h.doCampo(w, r) {
		return
	}
	motivo := nota(w, r, "motivo")
	if motivo == "" {
		httpx.Erro(w, http.StatusBadRequest, "conte o que você viu no local")
		return
	}
	u, _ := auth.DoContexto(r.Context())
	o, err := h.Repo.NaoEncontrado(r.Context(), r.PathValue("id"), u.Login, motivo)
	h.responder(w, o, err, "registrar")
}

// Secretarias trata GET /secretarias: as opções de despacho e de cadastro.
func (h *Handlers) Secretarias(w http.ResponseWriter, r *http.Request) {
	lista, err := h.Repo.Secretarias(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao listar as secretarias")
		return
	}
	if lista == nil {
		lista = []string{}
	}
	httpx.JSON(w, http.StatusOK, lista)
}

// Reabrir trata POST /ocorrencias/{id}/reabertura: o motivo é obrigatório.
func (h *Handlers) Reabrir(w http.ResponseWriter, r *http.Request) {
	motivo := nota(w, r, "motivo")
	if motivo == "" {
		httpx.Erro(w, http.StatusBadRequest, "informe o motivo da reabertura")
		return
	}
	u, _ := auth.DoContexto(r.Context())
	o, err := h.Repo.Reabrir(r.Context(), r.PathValue("id"), u.Login, motivo)
	h.responder(w, o, err, "reabrir")
}

// Indicadores trata GET /indicadores?dias=&reais=1 (T8).
func (h *Handlers) Indicadores(w http.ResponseWriter, r *http.Request) {
	dias, err := strconv.Atoi(r.URL.Query().Get("dias"))
	if err != nil || dias < 1 || dias > 365 {
		dias = 30
	}
	ind, err := h.Repo.Indicadores(r.Context(), dias, r.URL.Query().Get("reais") == "1")
	if err != nil {
		h.Log.Error("indicadores", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao calcular os indicadores")
		return
	}
	httpx.JSON(w, http.StatusOK, ind)
}

// Config trata GET /config: o que o app do morador precisa saber antes do envio.
func (h *Handlers) Config(w http.ResponseWriter, r *http.Request) {
	cats, err := h.Repo.Categorias(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao ler as categorias")
		return
	}
	type item struct {
		ID   string `json:"id"`
		Nome string `json:"nome"`
	}
	lista := make([]item, 0, len(cats))
	for _, c := range cats {
		lista = append(lista, item{c.ID, c.Nome})
	}
	p := h.parametros(r.Context())
	modulos := p.Modulos
	modulos.Video = h.videoLigado(r.Context())
	httpx.JSON(w, http.StatusOK, map[string]any{
		"cidade": h.Cidade, "ia_ativa": h.IAAtiva, "categorias": lista,
		"centro":  map[string]float64{"lat": h.CentroLat, "lng": h.CentroLng},
		"caixa":   caixaDaCidade(h.Caixa),
		"modulos": modulos,
		// Limites de mídia do relato, para o app não oferecer o que o servidor recusa.
		"midia": map[string]any{
			"fotos_max": fotosMaximas, "foto_mb": fotoMaxima >> 20,
			"video": modulos.Video, "video_segundos": videoSegundos, "video_mb": videoMaximo >> 20, "quadros_max": quadrosMaximos,
		},
	})
}

// Categorias trata GET /categorias (mantido para o app Expo).
func (h *Handlers) Categorias(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, triagem.Categorias())
}

// ServirMidia trata GET /midia?c=&exp=&s=: entrega a mídia de um link
// assinado. Não exige JWT porque <img> e <video> do navegador não o enviam.
// Responde a pedidos de trecho (Range), que o vídeo precisa para tocar.
func (h *Handlers) ServirMidia(w http.ResponseWriter, r *http.Request) {
	chave, restrita, err := h.Assinador.Conferir(r.URL.Query())
	if err != nil {
		httpx.Erro(w, http.StatusForbidden, err.Error())
		return
	}
	obj, err := h.Midia.Abrir(r.Context(), chave)
	if err != nil {
		httpx.Erro(w, http.StatusNotFound, "mídia não encontrada")
		return
	}
	defer obj.Close()
	tipo := obj.Tipo
	if tipo == "" {
		tipo = "image/jpeg"
	}
	w.Header().Set("Content-Type", tipo)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if restrita {
		w.Header().Set("Cache-Control", "private, no-store")
	} else {
		w.Header().Set("Cache-Control", "private, max-age=3600")
	}
	http.ServeContent(w, r, "", obj.Modificado, obj)
}

// AbrirVideo trata POST /ocorrencias/{id}/midias/{midia}/abertura: devolve
// um link curto para o vídeo original e registra quem abriu.
func (h *Handlers) AbrirVideo(w http.ResponseWriter, r *http.Request) {
	if !h.doCampo(w, r) {
		return
	}
	u, _ := auth.DoContexto(r.Context())
	chave, err := h.Repo.AbrirVideo(r.Context(), r.PathValue("id"), r.PathValue("midia"), u.Login)
	if errors.Is(err, ErrMidiaIndisponivel) {
		httpx.Erro(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		h.Log.Error("abrir vídeo", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao abrir o vídeo")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"url":        "/api/midia?" + h.Assinador.ConsultaRestrita(chave, validadeVideo),
		"validade_s": int(validadeVideo.Seconds()),
	})
}

// assinar preenche os links temporários das versões borradas; a foto
// original nunca sai e o vídeo só por AbrirVideo.
func (h *Handlers) assinar(o *Ocorrencia) {
	if o.midiaPublica != "" {
		o.MidiaURL = "/api/midia?" + h.Assinador.Consulta(o.midiaPublica, validadeLeitura)
	}
	for i := range o.RelatosLista {
		if c := o.RelatosLista[i].midiaPublica; c != "" {
			o.RelatosLista[i].MidiaURL = "/api/midia?" + h.Assinador.Consulta(c, validadeLeitura)
		}
	}
	for i := range o.Midias {
		if c := o.Midias[i].ChavePublica(); c != "" {
			o.Midias[i].URL = "/api/midia?" + h.Assinador.Consulta(c, validadeLeitura)
		}
	}
}

// AssinarMidia é usado pelo tempo real para entregar o mesmo formato do GET.
func (h *Handlers) AssinarMidia(o *Ocorrencia) { h.assinar(o) }

// normalizarCategoria aceita só categorias cadastradas. Vazio deixa a
// triagem decidir pela foto e pela fala.
func (h *Handlers) normalizarCategoria(ctx context.Context, c string) string {
	c = strings.ToLower(strings.TrimSpace(c))
	if c == "" {
		return ""
	}
	cats, err := h.Repo.Categorias(ctx)
	if err == nil {
		for _, k := range cats {
			if k.ID == c {
				return c
			}
		}
	}
	return "outros"
}

func novoUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// NovoID gera um UUID v4 (usado também pela semente da demo).
func NovoID() string { return novoUUID() }

// caixaDaCidade devolve a cerca do município para o app avisar quem está
// fora dela; nula quando a cidade aceita relato de qualquer lugar.
func caixaDaCidade(c *Caixa) map[string]float64 {
	if c == nil {
		return nil
	}
	return map[string]float64{"min_lng": c.MinLng, "min_lat": c.MinLat, "max_lng": c.MaxLng, "max_lat": c.MaxLat}
}
