package ocorrencias

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/geo"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
)

// Rotas públicas do morador além do envio (ADR 0016): acompanhar o próprio
// protocolo e ver, em lista mínima, os chamados abertos perto dele para
// confirmar com um toque ("Também vi") em vez de mandar um relato repetido.

const (
	// O raio da lista "Perto de você" é parâmetro da cidade (padrão 80 m).
	// raioConfirmacaoM é a folga para aceitar o "Também vi": o GPS oscila
	// entre a consulta e o toque.
	raioConfirmacaoM = 150.0
	maximoPerto      = 5
	validadeDaRef    = 30 * time.Minute
)

// Passo é uma etapa do acompanhamento, na ordem em que acontece.
type Passo struct {
	Tipo   string     `json:"tipo"` // recebido, conferido, a_caminho, resolvido
	Feito  bool       `json:"feito"`
	Quando *time.Time `json:"quando"`
}

// Acompanhamento é o que o morador vê do próprio protocolo: o andamento e a
// devolutiva da prefeitura. Nada de texto, foto ou endereço de outra pessoa.
type Acompanhamento struct {
	Protocolo     string     `json:"protocolo"`
	Categoria     string     `json:"categoria"`
	CategoriaNome string     `json:"categoria_nome"`
	Status        string     `json:"status"`
	Nivel         *int16     `json:"nivel"`
	Secretaria    *string    `json:"secretaria"`
	PrazoAte      *time.Time `json:"prazo_ate"`
	Relatos       int        `json:"relatos"`
	EnviadoEm     time.Time  `json:"enviado_em"`
	Passos        []Passo    `json:"passos"`
	// OQueFoiFeito é a nota da equipe ao resolver; FotosDoDepois, os links
	// das fotos do serviço pronto (já borradas).
	OQueFoiFeito  string   `json:"o_que_foi_feito,omitempty"`
	FotosDoDepois []string `json:"fotos_do_depois,omitempty"`
	fotos         []string
}

// Acompanhamento busca o chamado pelo protocolo e pela chave entregue no
// envio. Sem a chave certa, responde como se o protocolo não existisse.
func (r *Repositorio) Acompanhamento(ctx context.Context, protocolo, chave string) (Acompanhamento, error) {
	var a Acompanhamento
	var id string
	var revisado, despachado, resolvido *time.Time
	if len(chave) < 16 || len(chave) > 64 || len(protocolo) > 40 {
		return a, ErrNaoEncontrada
	}
	err := r.pool.QueryRow(ctx, `SELECT o.id, o.protocolo, o.categoria, COALESCE(c.nome, o.categoria), o.status, o.nivel,
			o.secretaria, o.prazo_ate, o.relatos, x.criado_em, o.revisado_em, o.despachado_em, o.resolvido_em
		FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id LEFT JOIN categorias c ON c.id = o.categoria
		WHERE x.chave = $2 AND o.protocolo = $1`, strings.ToUpper(strings.TrimSpace(protocolo)), chave).
		Scan(&id, &a.Protocolo, &a.Categoria, &a.CategoriaNome, &a.Status, &a.Nivel, &a.Secretaria, &a.PrazoAte,
			&a.Relatos, &a.EnviadoEm, &revisado, &despachado, &resolvido)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNaoEncontrada
	}
	if err != nil {
		return a, err
	}
	// "Conferido" vale quando o chamado saiu da triagem: ou um servidor
	// revisou, ou a triagem automática abriu direto.
	conferido := a.Status != "a_classificar" && a.Status != "revisao"
	quandoConferido := revisado
	if conferido && quandoConferido == nil {
		quandoConferido = &a.EnviadoEm
	}
	if !conferido {
		quandoConferido = nil
	}
	a.Passos = []Passo{
		{"recebido", true, &a.EnviadoEm},
		{"conferido", conferido, quandoConferido},
		{"a_caminho", despachado != nil && conferido, despachado},
		{"resolvido", a.Status == "resolvida", resolvido},
	}
	if a.Status != "resolvida" {
		a.Passos[3].Quando = nil
		return a, nil
	}
	// A nota e as fotos são as da resolução mais recente.
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(dados->>'motivo', '') FROM eventos
		WHERE ocorrencia_id = $1 AND tipo = 'resolvida' ORDER BY id DESC LIMIT 1`, id).Scan(&a.OQueFoiFeito)
	rows, err := r.pool.Query(ctx, `SELECT chave_publica FROM midias
		WHERE ocorrencia_id = $1 AND tipo = 'depois' AND chave_publica IS NOT NULL AND criado_em >= $2::timestamptz - interval '1 minute'
		ORDER BY criado_em, ordem LIMIT 6`, id, resolvido)
	if err != nil {
		return a, err
	}
	a.fotos, err = pgx.CollectRows(rows, pgx.RowTo[string])
	return a, err
}

// Acompanhar trata GET /acompanhar/{protocolo}?k=chave.
func (h *Handlers) Acompanhar(w http.ResponseWriter, r *http.Request) {
	a, err := h.Repo.Acompanhamento(r.Context(), r.PathValue("protocolo"), r.URL.Query().Get("k"))
	if errors.Is(err, ErrNaoEncontrada) {
		httpx.ErroCodigo(w, http.StatusNotFound, "nao_encontrado", "protocolo não encontrado")
		return
	} else if err != nil {
		h.Log.Error("acompanhar", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao consultar o protocolo")
		return
	}
	for _, c := range a.fotos {
		a.FotosDoDepois = append(a.FotosDoDepois, "/api/midia?"+h.Assinador.Consulta(c, validadeLeitura))
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, a)
}

// Proximo é um chamado aberto perto do morador, com o mínimo para ele
// reconhecer o problema: tipo, distância arredondada e há quanto tempo.
type Proximo struct {
	Ref           string    `json:"ref"`
	Categoria     string    `json:"categoria"`
	CategoriaNome string    `json:"categoria_nome"`
	DistanciaM    int       `json:"distancia_m"`
	Desde         time.Time `json:"desde"`
	Relatos       int       `json:"relatos"`
	Status        string    `json:"status"`
	id            string
}

// Perto lista os chamados reais e ainda abertos em volta do ponto.
func (r *Repositorio) Perto(ctx context.Context, lat, lng float64, agora time.Time) ([]Proximo, error) {
	p := r.parametros(ctx)
	janela := time.Duration(p.JanelaAgrupamentoDias) * 24 * time.Hour
	rows, err := r.pool.Query(ctx, `SELECT o.id, o.categoria, COALESCE(c.nome, o.categoria),
			ST_Distance(o.local, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography), o.criado_em, o.relatos, o.status
		FROM ocorrencias o LEFT JOIN categorias c ON c.id = o.categoria
		WHERE o.status NOT IN ('resolvida', 'a_classificar') AND NOT o.demo AND o.criado_em > $4 AND NOT `+foraDoEscopo+`
		  AND ST_DWithin(o.local, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
		ORDER BY 4 LIMIT $5`, lat, lng, p.RaioPertoM, agora.Add(-janela), maximoPerto)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Proximo, error) {
		var p Proximo
		var dist float64
		err := row.Scan(&p.id, &p.Categoria, &p.CategoriaNome, &dist, &p.Desde, &p.Relatos, &p.Status)
		// Distância de 10 em 10 metros e hora cheia: o bastante para
		// reconhecer, sem entregar a posição exata do relato de outra pessoa.
		p.DistanciaM = int(math.Round(dist/10) * 10)
		p.Desde = p.Desde.Truncate(time.Hour)
		return p, err
	})
}

// refDoChamado assina o id do chamado com validade, para o app devolver no
// "Também vi" sem conhecer o id nem o protocolo.
func (h *Handlers) refDoChamado(id string, validade time.Duration) string {
	exp := strconv.FormatInt(time.Now().Add(validade).Unix(), 10)
	return id + "." + exp + "." + h.macDaRef(id, exp)
}

func (h *Handlers) macDaRef(id, exp string) string {
	m := hmac.New(sha256.New, h.Assinador.Segredo)
	m.Write([]byte("perto\n" + id + "\n" + exp))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil)[:16])
}

func (h *Handlers) lerRef(ref string) (string, bool) {
	p := strings.Split(ref, ".")
	if len(p) != 3 || !reUUID.MatchString(p[0]) {
		return "", false
	}
	exp, err := strconv.ParseInt(p[1], 10, 64)
	if err != nil || time.Now().Unix() > exp || !hmac.Equal([]byte(h.macDaRef(p[0], p[1])), []byte(p[2])) {
		return "", false
	}
	return p[0], true
}

func lerPonto(latS, lngS string) (lat, lng float64, ok bool) {
	lat, errLat := strconv.ParseFloat(latS, 64)
	lng, errLng := strconv.ParseFloat(lngS, 64)
	if errLat != nil || errLng != nil || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return 0, 0, false
	}
	return lat, lng, true
}

// Perto trata GET /perto?lat=&lng=.
func (h *Handlers) Perto(w http.ResponseWriter, r *http.Request) {
	if !h.parametros(r.Context()).Modulos.Perto {
		// Módulo desligado: lista vazia, e o app segue para o relato normal.
		httpx.JSON(w, http.StatusOK, []Proximo{})
		return
	}
	lat, lng, ok := lerPonto(r.URL.Query().Get("lat"), r.URL.Query().Get("lng"))
	if !ok {
		httpx.ErroCodigo(w, http.StatusBadRequest, "local_invalido", "lat e lng obrigatórios e válidos")
		return
	}
	lista, err := h.Repo.Perto(r.Context(), lat, lng, time.Now())
	if err != nil {
		h.Log.Error("perto", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao consultar os chamados perto")
		return
	}
	if lista == nil {
		lista = []Proximo{}
	}
	for i := range lista {
		lista[i].Ref = h.refDoChamado(lista[i].id, validadeDaRef)
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, lista)
}

var (
	// ErrJaConfirmou: este aparelho já deu "Também vi" neste chamado.
	ErrJaConfirmou = errors.New("você já confirmou este chamado")
	// ErrLongeDemais: o ponto do morador não está perto do chamado.
	ErrLongeDemais = errors.New("este chamado não está perto de você")
)

// TambemVi soma a confirmação de um morador a um chamado aberto perto dele.
// Conta como mais um relato (reforça a tendência), sem foto e sem texto.
func (r *Repositorio) TambemVi(ctx context.Context, id string, lat, lng float64, n Nova, reavaliar Reavaliador, agora time.Time) (Ocorrencia, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Ocorrencia{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var a alvo
	err = tx.QueryRow(ctx, `SELECT id, triagem, nivel, status, relatos FROM ocorrencias
		WHERE id = $1 AND status <> 'resolvida' AND NOT demo AND NOT `+foraDoEscopoSemPrefixo+`
		  AND ST_DWithin(local, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
		FOR UPDATE`, id, lat, lng, raioConfirmacaoM).Scan(&a.id, &a.triagem, &a.nivel, &a.status, &a.relatos)
	if errors.Is(err, pgx.ErrNoRows) {
		return Ocorrencia{}, ErrLongeDemais
	}
	if err != nil {
		return Ocorrencia{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO relatos (ocorrencia_id, tipo, local, id_cliente, chave, aparelho, agrupou, morador_id)
		VALUES ($1, 'tambem_vi', ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
		        NULLIF($4, '')::uuid, $5, NULLIF($6, ''), true, NULLIF($7, '')::uuid)`,
		a.id, lat, lng, n.IDCliente, n.Chave, n.Aparelho, n.MoradorID); err != nil {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" {
			if pg.ConstraintName == "relatos_id_cliente_idx" {
				return Ocorrencia{}, ErrRepetido
			}
			return Ocorrencia{}, ErrJaConfirmou
		}
		return Ocorrencia{}, err
	}
	o, err := r.somarRelato(ctx, tx, a, nil, 0, reavaliar, agora)
	if err != nil {
		return Ocorrencia{}, err
	}
	if err := registrarEvento(ctx, tx, o.ID, "tambem_vi", "", map[string]any{"relatos": o.Relatos, "nivel": o.Nivel}, nil); err != nil {
		return Ocorrencia{}, err
	}
	return o, tx.Commit(ctx)
}

// TambemVi trata POST /perto/confirmacao com {ref, lat, lng}. Precisa do
// cabeçalho X-Mogi-Aparelho: é ele que garante uma confirmação por aparelho.
func (h *Handlers) TambemVi(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		Ref string  `json:"ref"`
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&corpo); err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "local_invalido", "corpo inválido")
		return
	}
	if !h.parametros(r.Context()).Modulos.Perto {
		httpx.ErroCodigo(w, http.StatusNotFound, "modulo_desligado", "confirmação desligada nesta cidade")
		return
	}
	moradorID, ok := h.moradorDoPedido(w, r)
	if !ok {
		return
	}
	id, ok := h.lerRef(corpo.Ref)
	aparelho := strings.TrimPrefix(httpx.Aparelho(r), "aparelho:")
	if !ok || aparelho == "" || corpo.Lat < -90 || corpo.Lat > 90 || corpo.Lng < -180 || corpo.Lng > 180 {
		httpx.ErroCodigo(w, http.StatusBadRequest, "ref_invalida", "confirmação inválida ou vencida, atualize a lista")
		return
	}
	idCliente := strings.ToLower(strings.TrimSpace(r.Header.Get("Idempotency-Key")))
	if !reUUID.MatchString(idCliente) {
		idCliente = ""
	}
	if h.responderRepetido(w, r, idCliente) {
		return
	}
	nova := Nova{IDCliente: idCliente, Chave: novaChave(), Aparelho: aparelho, MoradorID: moradorID}
	o, err := h.Repo.TambemVi(r.Context(), id, corpo.Lat, corpo.Lng, nova, h.Triagem.Reavaliar, time.Now())
	switch {
	case errors.Is(err, ErrRepetido) && h.responderRepetido(w, r, idCliente):
		return
	case errors.Is(err, ErrJaConfirmou):
		httpx.ErroCodigo(w, http.StatusConflict, "ja_confirmou", err.Error())
		return
	case errors.Is(err, ErrLongeDemais):
		httpx.ErroCodigo(w, http.StatusUnprocessableEntity, "longe_demais", err.Error())
		return
	case err != nil:
		h.Log.Error("também vi", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao registrar a confirmação")
		return
	}
	h.Log.Info("também vi", "protocolo", o.Protocolo, "relatos", o.Relatos, "nivel", o.Nivel)
	httpx.JSON(w, http.StatusCreated, ReciboDe(o, nova, true))
}

// "Meu bairro" (comunidade mínima, ADR 0024): o que a prefeitura resolveu
// perto do morador nos últimos 30 dias, com a foto do depois. Nada de nome,
// protocolo, texto ou posição exata de ninguém.
const (
	raioComunidadeM    = 1500
	itensDaComunidade  = 10
	janelaDaComunidade = 30 * 24 * time.Hour
)

// ItemDaComunidade é um chamado resolvido perto do morador.
type ItemDaComunidade struct {
	Categoria     string    `json:"categoria"`
	CategoriaNome string    `json:"categoria_nome"`
	ResolvidoEm   time.Time `json:"resolvido_em"`
	FotoDepoisURL *string   `json:"foto_depois_url"`
	DistanciaM    int       `json:"distancia_m"`
	foto          *string
}

// Comunidade é a resposta de GET /comunidade.
type Comunidade struct {
	RaioM         int                `json:"raio_m"`
	Resolvidos30d int                `json:"resolvidos_30d"`
	Abertos       int                `json:"abertos"`
	Bairro        *string            `json:"bairro"`
	Itens         []ItemDaComunidade `json:"itens"`
}

// Comunidade conta e lista os chamados reais em volta do ponto. Os de local
// privado (fora do escopo) e os simulados ficam de fora.
func (r *Repositorio) Comunidade(ctx context.Context, lat, lng float64, agora time.Time) (Comunidade, error) {
	c := Comunidade{RaioM: raioComunidadeM, Itens: []ItemDaComunidade{}}
	desde := agora.Add(-janelaDaComunidade)
	ponto := `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`
	filtro := `NOT o.demo AND NOT ` + foraDoEscopo + ` AND ST_DWithin(o.local, ` + ponto + `, $3)`
	err := r.pool.QueryRow(ctx, `SELECT
			count(*) FILTER (WHERE o.status = 'resolvida' AND o.resolvido_em > $4),
			count(*) FILTER (WHERE o.status NOT IN ('resolvida', 'a_classificar')),
			(SELECT o2.bairro FROM ocorrencias o2 WHERE o2.bairro IS NOT NULL AND NOT o2.demo
			   AND ST_DWithin(o2.local, `+ponto+`, $3)
			 ORDER BY ST_Distance(o2.local, `+ponto+`) LIMIT 1)
		FROM ocorrencias o WHERE `+filtro, lat, lng, raioComunidadeM, desde).
		Scan(&c.Resolvidos30d, &c.Abertos, &c.Bairro)
	if err != nil {
		return c, err
	}
	rows, err := r.pool.Query(ctx, `SELECT o.categoria, COALESCE(cat.nome, o.categoria), o.resolvido_em,
			ST_Distance(o.local, `+ponto+`),
			(SELECT m.chave_publica FROM midias m WHERE m.ocorrencia_id = o.id AND m.tipo = 'depois'
			   AND m.chave_publica IS NOT NULL AND m.criado_em >= o.resolvido_em - interval '1 minute'
			 ORDER BY m.criado_em, m.ordem LIMIT 1)
		FROM ocorrencias o LEFT JOIN categorias cat ON cat.id = o.categoria
		WHERE o.status = 'resolvida' AND o.resolvido_em > $4 AND `+filtro+`
		ORDER BY o.resolvido_em DESC LIMIT $5`, lat, lng, raioComunidadeM, desde, itensDaComunidade)
	if err != nil {
		return c, err
	}
	itens, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (ItemDaComunidade, error) {
		var it ItemDaComunidade
		var dist float64
		err := row.Scan(&it.Categoria, &it.CategoriaNome, &it.ResolvidoEm, &dist, &it.foto)
		// Como no "Perto de você": 10 em 10 metros e hora cheia.
		it.DistanciaM = int(math.Round(dist/10) * 10)
		it.ResolvidoEm = it.ResolvidoEm.Truncate(time.Hour)
		return it, err
	})
	if err != nil {
		return c, err
	}
	if itens != nil {
		c.Itens = itens
	}
	return c, nil
}

// Comunidade trata GET /comunidade?lat=&lng= (público, com teto por IP).
// Endereco trata GET /endereco?lat&lng: rua e bairro do ponto, para o
// cadastro preencher o bairro sozinho pelo GPS. Usa o mesmo geocodificador
// (com cache) dos relatos; sem geocodificador ou sem resposta, devolve vazio
// e o morador digita.
func (h *Handlers) Endereco(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := lerPonto(r.URL.Query().Get("lat"), r.URL.Query().Get("lng"))
	if !ok {
		httpx.ErroCodigo(w, http.StatusBadRequest, "local_invalido", "lat e lng obrigatórios e válidos")
		return
	}
	resposta := map[string]string{"endereco": "", "bairro": "", "cidade": "", "uf": ""}
	if h.Geo != nil {
		ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancelar()
		if e, err := h.Geo.Reverso(ctx, lat, lng); err == nil {
			resposta["endereco"], resposta["bairro"], resposta["cidade"], resposta["uf"] = e.Endereco, e.Bairro, e.Cidade, e.UF
		} else {
			h.Log.Warn("endereço pelo GPS", "erro", err)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, resposta)
}

// Cep trata GET /cep/{cep}: cidade, estado e bairro do CEP, para o cadastro
// preencher sozinho. Sem rede, responde 503 e o morador digita.
func (h *Handlers) Cep(w http.ResponseWriter, r *http.Request) {
	busca := h.Ceps
	if busca == nil {
		busca = geo.CepDesligado{}
	}
	ctx, cancelar := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancelar()
	c, err := busca.Buscar(ctx, r.PathValue("cep"))
	switch {
	case errors.Is(err, geo.ErrCepInvalido):
		httpx.ErroCodigo(w, http.StatusBadRequest, "cep_invalido", "o CEP tem 8 números")
	case errors.Is(err, geo.ErrCepNaoEncontrado):
		httpx.ErroCodigo(w, http.StatusNotFound, "cep_nao_encontrado", "não achamos esse CEP")
	case err != nil:
		h.Log.Warn("busca do CEP", "erro", err)
		httpx.ErroCodigo(w, http.StatusServiceUnavailable, "cep_indisponivel", "a busca do CEP não respondeu agora")
	default:
		w.Header().Set("Cache-Control", "public, max-age=86400")
		httpx.JSON(w, http.StatusOK, c)
	}
}

func (h *Handlers) Comunidade(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := lerPonto(r.URL.Query().Get("lat"), r.URL.Query().Get("lng"))
	if !ok {
		httpx.ErroCodigo(w, http.StatusBadRequest, "local_invalido", "lat e lng obrigatórios e válidos")
		return
	}
	c, err := h.Repo.Comunidade(r.Context(), lat, lng, time.Now())
	if err != nil {
		h.Log.Error("comunidade", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao consultar o bairro")
		return
	}
	for i := range c.Itens {
		if f := c.Itens[i].foto; f != nil && *f != "" {
			u := "/api/midia?" + h.Assinador.Consulta(*f, validadeLeitura)
			c.Itens[i].FotoDepoisURL = &u
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, c)
}
