// Comando api sobe o backend do Sistema MOGI: API REST, login JWT e
// WebSocket de tempo real (ADR 0013).
package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/admin"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/banco"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/cidade"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/config"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/conhecimento"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/demo"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/geo"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/midia"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/morador"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/observa"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/ocorrencias"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/temporeal"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

// Versao do MOGI, mostrada em /saude (veja CHANGELOG.md).
const Versao = "0.3.3"

func main() {
	// api -saude: usado pelo HEALTHCHECK da imagem, que não tem shell.
	if len(os.Args) > 1 && os.Args[1] == "-saude" {
		os.Exit(conferirSaude())
	}
	// LOG_FORMATO=json deixa cada linha pronta para um coletor de logs.
	var saida slog.Handler = slog.NewTextHandler(os.Stdout, nil)
	if os.Getenv("LOG_FORMATO") == "json" {
		saida = slog.NewJSONHandler(os.Stdout, nil)
	}
	log := slog.New(saida)
	if err := rodar(log); err != nil {
		log.Error("api parou", "erro", err)
		os.Exit(1)
	}
}

func rodar(log *slog.Logger) error {
	cfg, err := config.Carregar()
	if err != nil {
		return err
	}
	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()

	pool, err := banco.Abrir(ctx, cfg.BancoURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	autent := auth.Novo(pool, cfg.JWTSegredo)
	for _, u := range []struct{ login, senha, papel, secretaria string }{
		{cfg.SeedLogin, cfg.SeedSenha, auth.PapelGestor, ""},
		{cfg.OperadorLogin, cfg.OperadorSenha, auth.PapelOperador, ""},
		{cfg.CampoLogin, cfg.CampoSenha, auth.PapelCampo, cfg.CampoSecretaria},
		{cfg.PrefeitoLogin, cfg.PrefeitoSenha, auth.PapelPrefeito, ""},
	} {
		if criado, err := autent.Semear(ctx, u.login, u.senha, u.papel, u.secretaria); err != nil {
			return err
		} else if criado {
			log.Info("usuário inicial criado", "login", u.login, "papel", u.papel)
		}
	}
	if cfg.PrefeitoSenha != "" {
		if err := autent.Nomear(ctx, cfg.PrefeitoLogin, cfg.PrefeitoNome); err != nil {
			return err
		}
	}

	armazem, err := midia.NovoS3(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3SSL)
	if err != nil {
		return err
	}

	var geocod geo.Geocodificador = geo.Desligado{}
	if cfg.NominatimURL != "" {
		geocod = geo.NovoNominatim(cfg.NominatimURL, cfg.NominatimAgent, pool)
	}
	var ceps geo.BuscaCep = geo.CepDesligado{}
	if cfg.CepURL != "" {
		ceps = geo.NovoViaCep(cfg.CepURL, pool)
	}

	// Borrão seletivo de rostos e placas, com o borrão total de reserva (RF03).
	var borrador midia.Borrador = midia.BorradorSeletivo{Reserva: midia.BorradorConservador{}}
	if cfg.Borrador == "total" {
		borrador = midia.BorradorConservador{}
	}

	// A cidade é um cadastro no banco e os ajustes dela são parâmetros que o
	// gestor muda sem reiniciar (ADRs 0018 e 0021).
	cid := cidade.Novo(pool, cfg.Cidade)
	centroLat, centroLng := -21.0793, -47.0486
	if p := strings.Split(cfg.CidadeCentro, ","); len(p) == 2 {
		if lat, err := strconv.ParseFloat(strings.TrimSpace(p[0]), 64); err == nil {
			if lng, err := strconv.ParseFloat(strings.TrimSpace(p[1]), 64); err == nil {
				centroLat, centroLng = lat, lng
			}
		}
	}
	local, err := cid.Garantir(ctx, cfg.CidadeNome, cfg.CidadeCaixa, centroLat, centroLng)
	if err != nil {
		return err
	}
	caixa, err := ocorrencias.LerCaixa(local.Caixa)
	if err != nil {
		return err
	}
	demo.Centralizar(local.CentroLat, local.CentroLng)
	repo := ocorrencias.NovoRepositorio(pool)
	repo.Cidade, repo.Parametros = local.Slug, cid.Atuais
	motor := triagem.MotorLua{Dir: cfg.RegrasDir, Cidade: cfg.Cidade}
	// Cadeia do RF12, em ordem: Jev (decisão tipada, ADR 0007), IA com
	// visão e saída estruturada, e por último o classificador local, que não
	// depende de rede. A visão é a IA quando houver chave; senão, o Jev, se
	// ele puder ver a foto (JEV_FOTO).
	servico := &triagem.Servico{Motor: motor, Secretaria: repo.Secretaria, Log: log}
	// Agente de contexto (ADR 0023): orientações da prefeitura e histórico da
	// cidade antes da classificação (RAG), e as funções que a IA pode chamar.
	base, err := conhecimento.Carregar()
	if err != nil {
		return err
	}
	agente := &conhecimento.Agente{Base: base, Pool: pool, Cidade: local.Slug}
	servico.Contexto = agente
	var jev *triagem.Jev
	if cfg.JevChave != "" {
		jev = triagem.NovoJev(triagem.ConfigJev{Chave: cfg.JevChave, Base: cfg.JevBase, Modelo: cfg.JevModelo, ComFoto: cfg.JevFoto, Cambio: cfg.Cambio})
		servico.Classificadores = append(servico.Classificadores, jev)
		log.Info("triagem com Jev ligada", "modelo", jev.Nome(), "foto", jev.ComFoto())
	}
	var cenaIA midia.ClassificadorDeCena
	if cfg.IAChave != "" {
		ia := triagem.NovaIA(cfg.IAChave, cfg.IAModelo, cfg.Cambio)
		ia.Agente = agente
		cenaIA = triagem.NovaIA(cfg.IAChave, cfg.IAModeloCena, cfg.Cambio)
		servico.Descritor = ia
		servico.Classificadores = append(servico.Classificadores, ia)
		log.Info("visão com IA ligada", "modelo", ia.Nome())
	} else if jev != nil && jev.ComFoto() {
		servico.Descritor = jev
	}
	servico.Classificadores = append(servico.Classificadores, triagem.ClassificadorLocal{})
	if cfg.JevChave == "" && cfg.IAChave == "" {
		log.Warn("sem TYPESAFE_API_KEY nem IA_CHAVE: triagem só com o classificador local, por categoria e palavras do relato")
	}

	// Cadastro do morador (ADR 0024): o documento fica cifrado com a chave
	// DOCUMENTO_CHAVE e o app recebe um token de papel morador.
	if cfg.DocumentoChaveDerivada {
		log.Warn("sem DOCUMENTO_CHAVE: a chave do documento do morador sai do JWT_SEGREDO; rode make env para gerar uma própria")
	}
	cifra, err := morador.NovaCifra(cfg.DocumentoChave)
	if err != nil {
		return err
	}
	mor := &morador.Handlers{Pool: pool, Auth: autent, Cifra: cifra, Log: log, Cidade: local.Slug,
		Recuperacao: func(ctx context.Context) bool { return cid.Atuais(ctx).Modulos.Recuperacao }}

	oc := &ocorrencias.Handlers{
		Repo:     repo,
		Midia:    armazem,
		Borrador: borrador,
		// Foto de morador é conferida antes de gravar; sem IA, vale só a regra de rosto em destaque.
		Conteudo:   midia.Conteudo{Cena: cenaIA},
		Assinador:  midia.Assinador{Segredo: cfg.JWTSegredo},
		Geo:        geocod,
		Ceps:       ceps,
		Log:        log,
		Triagem:    servico,
		Cidade:     local.Nome,
		Caixa:      caixa,
		Video:      cfg.Video,
		CentroLat:  local.CentroLat,
		CentroLng:  local.CentroLng,
		Parametros: cid.Atuais,
		Morador:    mor.Identificar,
		// Com algum modelo vendo a foto, o morador pode deixar a categoria para a triagem.
		IAAtiva: servico.Descritor != nil,
	}
	adm := &admin.Handlers{Motor: motor, Repo: repo, Pool: pool, Log: log}
	metricas := observa.Novas()
	obs := &observa.Handlers{Pool: pool, Metricas: metricas, Pronto: armazem.Pronto, Log: log}

	if cfg.DemoChamados > 0 {
		if n, err := repo.Contar(ctx); err != nil {
			return err
		} else if n == 0 {
			criados, err := demo.Semear(ctx, pool, repo, armazem, motor, cfg.DemoChamados, time.Now())
			if err != nil {
				return err
			}
			log.Info("chamados simulados criados", "chamados", criados)
		}
	}

	go apagarOriginaisVencidas(ctx, repo, armazem, obs, log)

	// Vigia: confere a saúde a cada minuto e avisa quando algo cai e volta.
	obs.Vigia = &observa.Vigia{Pool: pool, Pronto: armazem.Pronto, Metricas: metricas, Log: log, URL: cfg.AlertaURL}
	go obs.Vigia.Rodar(ctx, time.Minute)

	hub := temporeal.NovoHub()
	go temporeal.Escutar(ctx, cfg.BancoURL, hub, func(ctx context.Context, id string) (any, string, error) {
		o, err := repo.Buscar(ctx, id)
		if err != nil {
			return nil, "", err
		}
		oc.AssinarMidia(&o)
		// Chamado ainda sem secretaria não vai para nenhuma equipe de campo.
		secretaria := "(sem secretaria)"
		if o.Secretaria != nil && *o.Secretaria != "" {
			secretaria = *o.Secretaria
		}
		return o, secretaria, nil
	}, log)

	// Cada rota vale na raiz (app Expo e teste de fumaça) e em /api (painel
	// e app web do morador, servidos pelo próprio Go no mesmo endereço).
	mux := http.NewServeMux()
	rota := func(metodo, caminho string, h http.HandlerFunc) {
		mux.HandleFunc(metodo+" "+caminho, h)
		mux.HandleFunc(metodo+" /api"+caminho, h)
	}
	// O envio do cidadão é aberto no teste alpha, com dois limites: um por
	// aparelho e um teto largo por IP, porque na rede móvel muitos moradores
	// saem pelo mesmo IP da operadora.
	origem := httpx.Origem{ProxyConfiavel: cfg.ProxyConfiavel}
	// Os dois tetos acompanham os parâmetros da cidade.
	porAparelho := &httpx.Limitador{Maximo: 12, Janela: 10 * time.Minute,
		MaximoAtual: func() int { return cid.Atuais(ctx).EnviosPorAparelho }}
	porIP := &httpx.Limitador{Maximo: 120, Janela: 10 * time.Minute,
		MaximoAtual: func() int { return cid.Atuais(ctx).EnviosPorIP }}
	// No login só as senhas erradas contam (8 a cada 10 minutos por IP e
	// login); o teto por IP é largo porque a prefeitura sai por um IP só.
	autent.Erros = &httpx.Limitador{Maximo: 8, Janela: 10 * time.Minute}
	autent.IP = origem.IP
	entradas := &httpx.Limitador{Maximo: 120, Janela: 5 * time.Minute}
	enviar := porIP.Limitar(origem.IP, porAparelho.Limitar(httpx.Aparelho, oc.Criar))
	rota("GET", "/saude", saude(pool, armazem))
	rota("GET", "/config", oc.Config)
	rota("GET", "/categorias", oc.Categorias)
	rota("GET", "/midia", oc.ServirMidia)
	rota("POST", "/auth/login", entradas.Limitar(origem.IP, autent.Login))
	rota("GET", "/auth/eu", autent.Exigir(autent.Eu))
	rota("POST", "/ocorrencias", enviar)
	// Rotas públicas do morador: acompanhar o protocolo e confirmar um
	// chamado perto. As consultas têm teto por IP para não virarem varredura.
	consultas := &httpx.Limitador{Maximo: 120, Janela: 10 * time.Minute}
	rota("GET", "/acompanhar/{protocolo}", consultas.Limitar(origem.IP, oc.Acompanhar))
	rota("GET", "/perto", consultas.Limitar(origem.IP, oc.Perto))
	rota("POST", "/perto/confirmacao", porIP.Limitar(origem.IP, porAparelho.Limitar(httpx.Aparelho, oc.TambemVi)))
	// "Meu bairro": resolvidos perto do morador, sem dado pessoal.
	rota("GET", "/comunidade", consultas.Limitar(origem.IP, oc.Comunidade))
	rota("GET", "/endereco", consultas.Limitar(origem.IP, oc.Endereco))
	rota("GET", "/cep/{cep}", consultas.Limitar(origem.IP, oc.Cep))

	// Cadastro e perfil do morador (ADR 0024). O cadastro tem teto por IP:
	// o mesmo documento devolve o token de novo, então não pode virar
	// varredura de CPFs.
	cadastros := &httpx.Limitador{Maximo: 30, Janela: 10 * time.Minute}
	rota("POST", "/moradores", cadastros.Limitar(origem.IP, mor.Cadastrar))
	rota("POST", "/moradores/entrar", cadastros.Limitar(origem.IP, mor.Entrar))
	rota("GET", "/eu", mor.Exigir(mor.Eu))
	rota("PUT", "/eu", mor.Exigir(mor.Atualizar))
	rota("DELETE", "/eu", mor.Exigir(mor.Apagar))
	rota("GET", "/eu/relatos", mor.Exigir(mor.Relatos))

	// Operador e gestor fazem a triagem e o despacho; a equipe de campo vê e
	// resolve só os chamados da própria secretaria (ADR 0016).
	gestor := func(h http.HandlerFunc) http.HandlerFunc { return autent.ExigirPapel(h, auth.PapelGestor) }
	central := func(h http.HandlerFunc) http.HandlerFunc {
		return autent.ExigirPapel(h, auth.PapelGestor, auth.PapelOperador)
	}
	// O prefeito acompanha (vê chamados e indicadores) e não age: resolver e
	// "não encontrado" ficam com a central e a equipe de campo.
	acompanha := func(h http.HandlerFunc) http.HandlerFunc {
		return autent.ExigirPapel(h, auth.PapelGestor, auth.PapelOperador, auth.PapelPrefeito)
	}
	quemAge := func(h http.HandlerFunc) http.HandlerFunc {
		return autent.ExigirPapel(h, auth.PapelGestor, auth.PapelOperador, auth.PapelCampo)
	}
	rota("GET", "/ocorrencias", autent.Exigir(oc.Listar))
	rota("GET", "/ocorrencias/{id}", autent.Exigir(oc.Buscar))
	rota("GET", "/secretarias", autent.Exigir(oc.Secretarias))
	rota("POST", "/ocorrencias/{id}/revisao", central(oc.Revisar))
	rota("POST", "/ocorrencias/{id}/despacho", central(oc.Despachar))
	rota("POST", "/ocorrencias/{id}/resolucao", quemAge(oc.Resolver))
	rota("POST", "/ocorrencias/{id}/nao-encontrado", quemAge(oc.NaoEncontrado))
	rota("POST", "/ocorrencias/{id}/reabertura", central(oc.Reabrir))
	rota("POST", "/ocorrencias/{id}/midias/{midia}/abertura", autent.Exigir(oc.AbrirVideo))
	// Documento completo de quem relatou: só o gestor, e cada abertura fica
	// no histórico do chamado.
	rota("POST", "/ocorrencias/{id}/relatos/{relato}/documento", gestor(mor.VerDocumento))
	rota("DELETE", "/ocorrencias/{id}/relatos/{relato}/morador", gestor(mor.ApagarPeloGestor))
	rota("GET", "/indicadores", acompanha(oc.Indicadores))
	// Observabilidade (ADR 0019): quadro da operação e relatório para o
	// gestor; os aparelhos avisam o que falhou, sem dado pessoal.
	rota("GET", "/operacao", gestor(obs.Operacao))
	rota("GET", "/relatorio.csv", gestor(obs.Relatorio))
	sinais := &httpx.Limitador{Maximo: 60, Janela: 10 * time.Minute}
	rota("POST", "/telemetria", sinais.Limitar(origem.IP, obs.Telemetria))
	rota("GET", "/admin/regras", gestor(adm.Regras))
	rota("POST", "/admin/regras/testar", gestor(adm.Testar))
	rota("PUT", "/admin/regras/{arquivo}", gestor(adm.Salvar))
	rota("GET", "/admin/categorias", gestor(adm.Categorias))
	rota("PUT", "/admin/categorias/{id}", gestor(adm.SalvarCategoria))
	rota("GET", "/admin/usuarios", gestor(autent.ListarUsuarios))
	rota("POST", "/admin/usuarios", gestor(autent.CriarUsuario))
	rota("PUT", "/admin/usuarios/{login}", gestor(autent.AtualizarUsuario))
	rota("GET", "/admin/parametros", gestor(cid.Ler))
	rota("PUT", "/admin/parametros", gestor(cid.Gravar))
	rota("GET", "/ao-vivo", hub.Handler(func(ctx context.Context, t string) (string, error) {
		u, err := autent.Atual(ctx, t)
		if err != nil {
			return "", err
		}
		if u.Papel == auth.PapelCampo {
			return u.Secretaria, nil
		}
		return "", nil
	}, cfg.Origens, log))
	if web := paginas(cfg.WebDir); web != nil {
		mux.Handle("GET /", web)
		log.Info("servindo o painel e o app do morador", "pasta", cfg.WebDir)
	}

	srv := &http.Server{
		Addr:              cfg.Endereco,
		Handler:           registrar(log, metricas, cabecalhos(mux)),
		ReadHeaderTimeout: 10 * time.Second,
		// Folga para foto grande em rede móvel lenta; sem teto, um corpo
		// enviado aos poucos prenderia a conexão para sempre.
		ReadTimeout:  5 * time.Minute,
		WriteTimeout: 5 * time.Minute,
		IdleTimeout:  2 * time.Minute,
	}
	go func() {
		<-ctx.Done()
		desligar, cancelar := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelar()
		_ = srv.Shutdown(desligar)
	}()
	log.Info("api no ar", "endereco", cfg.Endereco)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// apagarOriginaisVencidas cumpre a retenção (ADR 0015): passado o prazo, a
// foto sem borrão e o vídeo saem do armazenamento; a versão borrada fica.
// Roda ao subir e depois de hora em hora.
func apagarOriginaisVencidas(ctx context.Context, repo *ocorrencias.Repositorio, armazem midia.Armazenamento, obs *observa.Handlers, log *slog.Logger) {
	relogio := time.NewTicker(time.Hour)
	defer relogio.Stop()
	for {
		apagadas := 0
		for {
			antes := apagadas
			vencidas, err := repo.OriginaisVencidas(ctx, time.Now(), 200)
			if err != nil {
				log.Error("retenção: listar vencidas", "erro", err)
				break
			}
			for _, v := range vencidas {
				if err := armazem.Apagar(ctx, v.Chave); err != nil {
					log.Error("retenção: apagar do armazenamento", "erro", err)
					continue
				}
				if err := repo.MarcarOriginalApagada(ctx, v); err != nil {
					log.Error("retenção: marcar apagada", "erro", err)
					continue
				}
				apagadas++
			}
			// Para também quando nada andou, para não girar em falso se o
			// armazenamento estiver fora.
			if len(vencidas) < 200 || apagadas == antes {
				break
			}
		}
		if apagadas > 0 {
			log.Info("retenção: originais apagadas", "midias", apagadas)
		}
		if err := obs.LimparAntiga(ctx); err != nil {
			log.Error("retenção: telemetria antiga", "erro", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-relogio.C:
		}
	}
}

// saude responde 200 só quando o banco e o armazenamento de mídia respondem:
// é o que o HEALTHCHECK da imagem e quem opera o campo consultam.
func saude(pool interface{ Ping(context.Context) error }, armazem midia.Armazenamento) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancelar := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancelar()
		estado := map[string]any{"ok": true, "banco": "ok", "midia": "ok", "versao": Versao}
		status := http.StatusOK
		if err := pool.Ping(ctx); err != nil {
			estado["ok"], estado["banco"], status = false, "indisponível", http.StatusServiceUnavailable
		}
		if err := armazem.Pronto(ctx); err != nil {
			estado["ok"], estado["midia"], status = false, "indisponível", http.StatusServiceUnavailable
		}
		httpx.JSON(w, status, estado)
	}
}

func conferirSaude() int {
	_, porta, err := net.SplitHostPort(os.Getenv("API_ENDERECO"))
	if err != nil {
		porta = "8080"
	}
	cli := http.Client{Timeout: 2 * time.Second}
	resp, err := cli.Get("http://127.0.0.1:" + porta + "/saude")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

// paginas serve o build do painel (WEB_DIR): arquivos estáticos, /relatar
// para o app do morador e index.html para o resto. Sem a pasta, devolve nil
// e o Go fica só com a API (desenvolvimento com o Vite).
func paginas(dir string) http.Handler {
	if dir == "" {
		return nil
	}
	if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
		return nil
	}
	arquivos := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		switch {
		case strings.HasPrefix(p, "/api/"):
			httpx.Erro(w, http.StatusNotFound, "rota não encontrada")
			return
		case p == "/relatar", p == "/campo":
			// Páginas próprias do morador e da equipe de campo.
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, filepath.Join(dir, p[1:]+".html"))
			return
		case strings.HasPrefix(p, "/assets/"):
			// Nomes com hash do conteúdo: podem ficar em cache para sempre.
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		default:
			w.Header().Set("Cache-Control", "no-cache")
			if info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p))); err != nil || info.IsDir() {
				http.ServeFile(w, r, filepath.Join(dir, "index.html"))
				return
			}
		}
		arquivos.ServeHTTP(w, r)
	})
}

// cabecalhos aplica os cabeçalhos de segurança a todas as respostas. O app
// do morador precisa de câmera, microfone e localização na própria origem.
func cabecalhos(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := w.Header()
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Referrer-Policy", "same-origin")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)")
		h.ServeHTTP(w, r)
	})
}

// registrar dá um identificador a cada pedido (devolvido em X-Request-Id,
// para casar a queixa de alguém com a linha do log), loga método, caminho,
// status e duração, e alimenta as métricas da aba Operação. Não loga corpo
// nem consulta (a consulta do WebSocket carrega o token).
func registrar(log *slog.Logger, m *observa.Metricas, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		id := idDoPedido()
		w.Header().Set("X-Request-Id", id)
		rw := &gravador{ResponseWriter: w, status: http.StatusOK}
		h.ServeHTTP(rw, r)
		duracao := time.Since(inicio)
		// O roteador grava em r.Pattern a rota que casou ("POST /ocorrencias/{id}/despacho").
		// As rotas existem na raiz e em /api: contam como uma só.
		padrao := strings.Replace(r.Pattern, " /api/", " /", 1)
		if padrao == "GET /" {
			padrao = "GET (páginas e arquivos)"
		}
		// O WebSocket fica aberto por horas: a duração dele não é tempo de resposta.
		if rw.status != http.StatusSwitchingProtocols {
			m.Registrar(r.Method, padrao, rw.status, duracao, id)
		}
		log.Info("http", "id", id, "metodo", r.Method, "caminho", r.URL.Path, "status", rw.status, "ms", duracao.Milliseconds())
	})
}

func idDoPedido() string {
	var b [6]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

type gravador struct {
	http.ResponseWriter
	status int
}

func (g *gravador) WriteHeader(s int) {
	g.status = s
	g.ResponseWriter.WriteHeader(s)
}

// Unwrap e Hijack permitem ao WebSocket assumir a conexão original.
func (g *gravador) Unwrap() http.ResponseWriter { return g.ResponseWriter }

func (g *gravador) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	g.status = http.StatusSwitchingProtocols
	return http.NewResponseController(g.ResponseWriter).Hijack()
}
