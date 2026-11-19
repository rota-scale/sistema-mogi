package morador

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
)

// Morador é a forma pública do cadastro: o documento vai sempre mascarado.
type Morador struct {
	ID                 string    `json:"id"`
	Tipo               string    `json:"tipo"`
	Nome               string    `json:"nome"`
	DocumentoMascarado string    `json:"documento_mascarado"`
	Profissao          *string   `json:"profissao"`
	Bairro             *string   `json:"bairro"`
	Cep                *string   `json:"cep"`
	Municipio          *string   `json:"municipio"`
	UF                 *string   `json:"uf"`
	MunicipioIBGE      *string   `json:"municipio_ibge"`
	CriadoEm           time.Time `json:"criado_em"`
}

// Moradia é onde a pessoa mora: CEP e município, os dois opcionais. Pode ser
// outra cidade, diferente da prefeitura que atende.
type Moradia struct {
	Cep       string `json:"cep"`
	Municipio string `json:"municipio"`
	UF        string `json:"uf"`
	IBGE      string `json:"municipio_ibge"`
}

// ErrMoradiaInvalida: CEP, estado ou código do IBGE fora do formato.
var ErrMoradiaInvalida = errors.New("cep ou município inválido")

func digitos(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Limpa confere o formato: CEP com 8 números, UF com 2 letras, IBGE com 7
// números. Vazio é aceito em todos.
func (m Moradia) Limpa() (Moradia, error) {
	out := Moradia{
		Cep:       digitos(m.Cep),
		Municipio: limpar(m.Municipio, campoMaximo),
		UF:        strings.ToUpper(strings.TrimSpace(m.UF)),
		IBGE:      digitos(m.IBGE),
	}
	if strings.TrimSpace(m.Cep) != "" && len(out.Cep) != 8 {
		return Moradia{}, ErrMoradiaInvalida
	}
	if out.UF != "" && (len(out.UF) != 2 || strings.Trim(out.UF, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") != "") {
		return Moradia{}, ErrMoradiaInvalida
	}
	if out.IBGE != "" && len(out.IBGE) != 7 {
		return Moradia{}, ErrMoradiaInvalida
	}
	return out, nil
}

// Handlers atende as rotas do morador: cadastro, perfil, histórico e o
// "Ver documento" do gestor.
type Handlers struct {
	Pool  *pgxpool.Pool
	Auth  *auth.Servico
	Cifra *Cifra
	Log   *slog.Logger
	// Cidade é a cidade desta instalação, gravada no cadastro (ADR 0021).
	Cidade string
	// Recuperacao diz se o módulo do código de recuperação está ligado
	// (parâmetro da cidade). Nulo vale ligado, o comportamento da v0.2.1.
	Recuperacao func(context.Context) bool
}

func (h *Handlers) comRecuperacao(ctx context.Context) bool {
	return h.Recuperacao == nil || h.Recuperacao(ctx)
}

const (
	nomeMaximo  = 120
	campoMaximo = 80
	// relatosNoHistorico é quantos relatos o GET /eu/relatos devolve.
	relatosNoHistorico = 50
)

var reUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// limpar tira caracteres de controle, junta espaços e corta no tamanho.
func limpar(s string, maximo int) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, s)
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > maximo {
		s = strings.TrimSpace(string(r[:maximo]))
	}
	return s
}

func opcional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

const colunas = `id, tipo, nome, COALESCE(documento_final, ''), profissao, bairro, cep, municipio, uf, municipio_ibge, criado_em`

func escanear(row pgx.Row) (Morador, error) {
	var m Morador
	err := row.Scan(&m.ID, &m.Tipo, &m.Nome, &m.DocumentoMascarado, &m.Profissao, &m.Bairro,
		&m.Cep, &m.Municipio, &m.UF, &m.MunicipioIBGE, &m.CriadoEm)
	return m, err
}

// ErrJaCadastrado: o documento já tem cadastro. Não se devolve nada dele:
// quem só sabe o CPF não pode pegar a conta de outra pessoa (issue #26).
var ErrJaCadastrado = errors.New("documento já cadastrado")

// cadastrar grava o cadastro novo com o HMAC do código de recuperação.
func (h *Handlers) cadastrar(ctx context.Context, tipo, nome, doc, profissao, bairro string, mora Moradia, codigo string) (Morador, error) {
	cifrado, err := h.Cifra.Cifrar(doc)
	if err != nil {
		return Morador{}, err
	}
	hash := h.Cifra.Hash(doc)
	// Sem código (módulo desligado), o banco guarda nulo e o "entrar" recusa.
	hashSeHouver := ""
	if codigo != "" {
		hashSeHouver = h.hashDoCodigo(hash, codigo)
	}
	cidade := h.Cidade
	if cidade == "" {
		cidade = "itamogi"
	}
	m, err := escanear(h.Pool.QueryRow(ctx, `INSERT INTO moradores
			(cidade, tipo, nome, profissao, bairro, documento_cifrado, documento_hash, documento_final, aceite_em, codigo_hash,
			 cep, municipio, uf, municipio_ibge)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, $8, now(), NULLIF($9, ''),
			NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''))
		ON CONFLICT (documento_hash) DO NOTHING
		RETURNING `+colunas, cidade, tipo, nome, profissao, bairro, cifrado, hash, Mascarar(doc), hashSeHouver,
		mora.Cep, mora.Municipio, mora.UF, mora.IBGE))
	if errors.Is(err, pgx.ErrNoRows) {
		return Morador{}, ErrJaCadastrado
	}
	return m, err
}

// alfabetoCodigo não tem letras e números que se confundem (0/O, 1/I/L).
const alfabetoCodigo = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// NovoCodigo sorteia o código de recuperação: 12 caracteres em 3 grupos.
func NovoCodigo() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	out := make([]byte, 0, 14)
	for i, x := range b {
		if i == 4 || i == 8 {
			out = append(out, '-')
		}
		out = append(out, alfabetoCodigo[int(x)%len(alfabetoCodigo)])
	}
	return string(out), nil
}

// NormalizarCodigo aceita minúsculas, espaços e hífens: "abcd efgh-jkmn".
func NormalizarCodigo(s string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(s) {
		if strings.ContainsRune(alfabetoCodigo, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// hashDoCodigo amarra o código ao documento: o mesmo código não serve para
// outro cadastro.
func (h *Handlers) hashDoCodigo(docHash, codigo string) string {
	return h.Cifra.Hash("codigo:" + docHash + ":" + NormalizarCodigo(codigo))
}

// Cadastrar trata POST /moradores com {tipo, nome, documento, profissao,
// bairro, aceite}. Devolve o token de morador que o app guarda. Documento já
// cadastrado responde 409 sem token nem dado nenhum: para entrar em outro
// aparelho, use POST /moradores/entrar com o código de recuperação.
func (h *Handlers) Cadastrar(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		Tipo      string `json:"tipo"`
		Nome      string `json:"nome"`
		Documento string `json:"documento"`
		Profissao string `json:"profissao"`
		Bairro    string `json:"bairro"`
		Aceite    bool   `json:"aceite"`
		Moradia
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&corpo); err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "corpo_invalido", "corpo inválido")
		return
	}
	if !corpo.Aceite {
		httpx.ErroCodigo(w, http.StatusBadRequest, "aceite_obrigatorio", "é preciso aceitar o termo para se cadastrar")
		return
	}
	tipo := strings.ToLower(strings.TrimSpace(corpo.Tipo))
	if !TipoValido(tipo) {
		httpx.ErroCodigo(w, http.StatusBadRequest, "tipo_invalido", "tipo deve ser pf, pj ou servidor")
		return
	}
	nome := limpar(corpo.Nome, nomeMaximo)
	if len([]rune(nome)) < 2 {
		httpx.ErroCodigo(w, http.StatusBadRequest, "nome_invalido", "informe o seu nome")
		return
	}
	doc, err := Normalizar(tipo, corpo.Documento)
	if err != nil {
		msg := "CPF inválido, confira os números"
		if tipo == TipoPJ {
			msg = "CNPJ inválido, confira os números"
		}
		httpx.ErroCodigo(w, http.StatusBadRequest, "documento_invalido", msg)
		return
	}
	mora, err := corpo.Moradia.Limpa()
	if err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "moradia_invalida", "confira o CEP e a cidade")
		return
	}
	recuperacao := h.comRecuperacao(r.Context())
	codigo := ""
	if recuperacao {
		if codigo, err = NovoCodigo(); err != nil {
			httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao gerar o código")
			return
		}
	}
	m, err := h.cadastrar(r.Context(), tipo, nome, doc, limpar(corpo.Profissao, campoMaximo), limpar(corpo.Bairro, campoMaximo), mora, codigo)
	if errors.Is(err, ErrJaCadastrado) {
		msg := "Este documento já tem cadastro. Toque em \"Já tenho cadastro\" e use o seu código de recuperação."
		if !recuperacao {
			msg = "Esse documento já tem cadastro em outro celular. Peça à prefeitura para liberar e cadastre de novo."
		}
		httpx.ErroCodigo(w, http.StatusConflict, "documento_cadastrado", msg)
		return
	}
	if err != nil {
		h.Log.Error("cadastrar morador", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao gravar o cadastro")
		return
	}
	token, err := h.Auth.EmitirMorador(m.ID, 1)
	if err != nil {
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao emitir o token")
		return
	}
	h.Log.Info("morador cadastrado", "tipo", m.Tipo)
	w.Header().Set("Cache-Control", "no-store")
	// O código vai uma vez só: o banco guarda apenas o HMAC dele.
	resposta := map[string]any{"token": token, "morador": m}
	if codigo != "" {
		resposta["codigo_recuperacao"] = codigo
	}
	httpx.JSON(w, http.StatusCreated, resposta)
}

const (
	// Depois de tantas tentativas erradas, o cadastro fica travado um tempo.
	falhasAteTravar = 5
	tempoTravado    = 15 * time.Minute
)

// Entrar trata POST /moradores/entrar com {documento, codigo}: prova de posse
// do cadastro para usar em outro aparelho. Qualquer erro responde o mesmo
// 401, para não revelar se o documento tem cadastro. Entrar sobe a sessão e
// derruba os tokens dos outros aparelhos.
func (h *Handlers) Entrar(w http.ResponseWriter, r *http.Request) {
	if !h.comRecuperacao(r.Context()) {
		httpx.ErroCodigo(w, http.StatusNotFound, "modulo_desligado", "Entrar com o código está desligado nesta cidade.")
		return
	}
	var corpo struct {
		Documento string `json:"documento"`
		Codigo    string `json:"codigo"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&corpo); err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "corpo_invalido", "corpo inválido")
		return
	}
	negar := func() {
		httpx.ErroCodigo(w, http.StatusUnauthorized, "credenciais_invalidas", "Documento ou código não conferem.")
	}
	doc, err := Normalizar(TipoPF, corpo.Documento)
	if err != nil {
		if doc, err = Normalizar(TipoPJ, corpo.Documento); err != nil {
			negar()
			return
		}
	}
	hash := h.Cifra.Hash(doc)
	ctx := r.Context()
	var id string
	var guardado *string
	var travado bool
	err = h.Pool.QueryRow(ctx, `SELECT id, codigo_hash, COALESCE(bloqueado_ate > now(), false)
		FROM moradores WHERE documento_hash = $1`, hash).Scan(&id, &guardado, &travado)
	if err != nil || travado || guardado == nil {
		negar()
		return
	}
	if !hmac.Equal([]byte(*guardado), []byte(h.hashDoCodigo(hash, corpo.Codigo))) {
		_, _ = h.Pool.Exec(ctx, `UPDATE moradores SET falhas_entrada = falhas_entrada + 1,
			bloqueado_ate = CASE WHEN falhas_entrada + 1 >= $2 THEN now() + $3::interval ELSE bloqueado_ate END
			WHERE id = $1`, id, falhasAteTravar, tempoTravado.String())
		negar()
		return
	}
	var sessao int
	m, err := escanearComSessao(h.Pool.QueryRow(ctx, `UPDATE moradores
		SET sessao = sessao + 1, falhas_entrada = 0, bloqueado_ate = NULL, atualizado_em = now()
		WHERE id = $1 RETURNING `+colunas+`, sessao`, id), &sessao)
	if err != nil {
		h.Log.Error("entrar morador", "erro", err)
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao entrar")
		return
	}
	token, err := h.Auth.EmitirMorador(m.ID, sessao)
	if err != nil {
		httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao emitir o token")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{"token": token, "morador": m})
}

func escanearComSessao(row pgx.Row, sessao *int) (Morador, error) {
	var m Morador
	err := row.Scan(&m.ID, &m.Tipo, &m.Nome, &m.DocumentoMascarado, &m.Profissao, &m.Bairro,
		&m.Cep, &m.Municipio, &m.UF, &m.MunicipioIBGE, &m.CriadoEm, sessao)
	return m, err
}

// Identificar devolve o id do morador do token no cabeçalho Authorization,
// ou vazio quando não há token, ele não é de morador ou o cadastro foi
// apagado. É o que o envio usa para exigir o cadastro.
func (h *Handlers) Identificar(r *http.Request) string {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || h.Auth == nil {
		return ""
	}
	id, sessao, err := h.Auth.ConferirMorador(strings.TrimSpace(token))
	if err != nil || !reUUID.MatchString(id) {
		return ""
	}
	// Token de uma sessão antiga (o morador entrou em outro aparelho) não vale.
	var atual int
	if err := h.Pool.QueryRow(r.Context(), `SELECT sessao FROM moradores WHERE id = $1`, id).Scan(&atual); err != nil || atual != max(sessao, 1) {
		return ""
	}
	return id
}

type chaveCtx struct{}

// Exigir protege as rotas /eu com o token de morador.
func (h *Handlers) Exigir(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := h.Identificar(r)
		if id == "" {
			httpx.ErroCodigo(w, http.StatusUnauthorized, "cadastro_obrigatorio", "Faça seu cadastro para continuar")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), chaveCtx{}, id)))
	}
}

func doContexto(ctx context.Context) string {
	id, _ := ctx.Value(chaveCtx{}).(string)
	return id
}

func (h *Handlers) buscar(ctx context.Context, id string) (Morador, error) {
	return escanear(h.Pool.QueryRow(ctx, `SELECT `+colunas+` FROM moradores WHERE id = $1`, id))
}

// Eu trata GET /eu: o perfil, com o documento mascarado.
func (h *Handlers) Eu(w http.ResponseWriter, r *http.Request) {
	m, err := h.buscar(r.Context(), doContexto(r.Context()))
	if err != nil {
		h.responderErro(w, err, "ler o perfil")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handlers) responderErro(w http.ResponseWriter, err error, acao string) {
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.ErroCodigo(w, http.StatusUnauthorized, "cadastro_obrigatorio", "Faça seu cadastro para continuar")
		return
	}
	h.Log.Error(acao, "erro", err)
	httpx.ErroCodigo(w, http.StatusInternalServerError, "interno", "falha ao "+acao)
}

// Atualizar trata PUT /eu com {nome?, profissao?, bairro?}. O tipo e o
// documento não mudam: documento errado é um cadastro novo.
func (h *Handlers) Atualizar(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		Nome      *string `json:"nome"`
		Profissao *string `json:"profissao"`
		Bairro    *string `json:"bairro"`
		// Moradia, quando vem, troca CEP, município, UF e IBGE juntos.
		Moradia *Moradia `json:"moradia"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&corpo); err != nil {
		httpx.ErroCodigo(w, http.StatusBadRequest, "corpo_invalido", "corpo inválido")
		return
	}
	var nome, profissao, bairro *string
	var mora *Moradia
	if corpo.Moradia != nil {
		m, err := corpo.Moradia.Limpa()
		if err != nil {
			httpx.ErroCodigo(w, http.StatusBadRequest, "moradia_invalida", "confira o CEP e a cidade")
			return
		}
		mora = &m
	}
	if corpo.Nome != nil {
		n := limpar(*corpo.Nome, nomeMaximo)
		if len([]rune(n)) < 2 {
			httpx.ErroCodigo(w, http.StatusBadRequest, "nome_invalido", "informe o seu nome")
			return
		}
		nome = &n
	}
	// Profissão e bairro em branco apagam o valor; ausentes ficam como estão.
	if corpo.Profissao != nil {
		p := limpar(*corpo.Profissao, campoMaximo)
		profissao = &p
	}
	if corpo.Bairro != nil {
		b := limpar(*corpo.Bairro, campoMaximo)
		bairro = &b
	}
	m, err := escanear(h.Pool.QueryRow(r.Context(), `UPDATE moradores SET
			nome = COALESCE($2, nome),
			profissao = CASE WHEN $3::text IS NULL THEN profissao ELSE NULLIF($3, '') END,
			bairro = CASE WHEN $4::text IS NULL THEN bairro ELSE NULLIF($4, '') END,
			cep = CASE WHEN $5 THEN NULLIF($6, '') ELSE cep END,
			municipio = CASE WHEN $5 THEN NULLIF($7, '') ELSE municipio END,
			uf = CASE WHEN $5 THEN NULLIF($8, '') ELSE uf END,
			municipio_ibge = CASE WHEN $5 THEN NULLIF($9, '') ELSE municipio_ibge END,
			atualizado_em = now()
		WHERE id = $1 RETURNING `+colunas, doContexto(r.Context()), nome, profissao, bairro,
		mora != nil, campo(mora, func(m Moradia) string { return m.Cep }), campo(mora, func(m Moradia) string { return m.Municipio }),
		campo(mora, func(m Moradia) string { return m.UF }), campo(mora, func(m Moradia) string { return m.IBGE })))
	if err != nil {
		h.responderErro(w, err, "atualizar o perfil")
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

// Apagar trata DELETE /eu: apaga o cadastro (direito de exclusão da LGPD).
// Os relatos continuam nos chamados, sem ligação com a pessoa.
func (h *Handlers) Apagar(w http.ResponseWriter, r *http.Request) {
	tag, err := h.Pool.Exec(r.Context(), `DELETE FROM moradores WHERE id = $1`, doContexto(r.Context()))
	if err != nil {
		h.responderErro(w, err, "apagar o cadastro")
		return
	}
	if tag.RowsAffected() == 0 {
		h.responderErro(w, pgx.ErrNoRows, "apagar o cadastro")
		return
	}
	h.Log.Info("cadastro de morador apagado a pedido")
	w.WriteHeader(http.StatusNoContent)
}

// RelatoDoMorador é uma linha do histórico do morador. A chave abre o
// acompanhamento já existente (GET /acompanhar/{protocolo}?k=).
type RelatoDoMorador struct {
	Protocolo     string     `json:"protocolo"`
	Categoria     string     `json:"categoria"`
	CategoriaNome string     `json:"categoria_nome"`
	Status        string     `json:"status"`
	Nivel         *int16     `json:"nivel"`
	CriadoEm      time.Time  `json:"criado_em"`
	ResolvidoEm   *time.Time `json:"resolvido_em"`
	Chave         *string    `json:"chave"`
}

// Historico é a resposta de GET /eu/relatos.
type Historico struct {
	Total           int               `json:"total"`
	Resolvidos      int               `json:"resolvidos"`
	TempoMedioHoras *float64          `json:"tempo_medio_horas"`
	Relatos         []RelatoDoMorador `json:"relatos"`
}

// Relatos trata GET /eu/relatos: o histórico em qualquer aparelho, com
// total, resolvidos e o tempo médio do relato até a resolução.
func (h *Handlers) Relatos(w http.ResponseWriter, r *http.Request) {
	id := doContexto(r.Context())
	var hist Historico
	err := h.Pool.QueryRow(r.Context(), `SELECT count(*), count(*) FILTER (WHERE o.status = 'resolvida'),
			round((avg(extract(epoch FROM o.resolvido_em - x.criado_em)) FILTER (WHERE o.status = 'resolvida' AND o.resolvido_em >= x.criado_em) / 3600)::numeric, 1)::float8
		FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id WHERE x.morador_id = $1`, id).
		Scan(&hist.Total, &hist.Resolvidos, &hist.TempoMedioHoras)
	if err != nil {
		h.responderErro(w, err, "ler o histórico")
		return
	}
	rows, err := h.Pool.Query(r.Context(), `SELECT o.protocolo, o.categoria, COALESCE(c.nome, o.categoria), o.status, o.nivel,
			x.criado_em, o.resolvido_em, x.chave
		FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id LEFT JOIN categorias c ON c.id = o.categoria
		WHERE x.morador_id = $1 ORDER BY x.criado_em DESC LIMIT $2`, id, relatosNoHistorico)
	if err != nil {
		h.responderErro(w, err, "ler o histórico")
		return
	}
	hist.Relatos, err = pgx.CollectRows(rows, pgx.RowToStructByPos[RelatoDoMorador])
	if err != nil {
		h.responderErro(w, err, "ler o histórico")
		return
	}
	if hist.Relatos == nil {
		hist.Relatos = []RelatoDoMorador{}
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, hist)
}

// VerDocumento trata POST /ocorrencias/{id}/relatos/{relato}/documento, só
// do gestor: devolve o documento completo de quem relatou e grava no
// histórico do chamado quem abriu, como o vídeo sem borrão.
func (h *Handlers) VerDocumento(w http.ResponseWriter, r *http.Request) {
	ocorrencia, relato := r.PathValue("id"), r.PathValue("relato")
	if !reUUID.MatchString(ocorrencia) || !reUUID.MatchString(relato) {
		httpx.Erro(w, http.StatusNotFound, "relato sem cadastro")
		return
	}
	u, _ := auth.DoContexto(r.Context())
	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao abrir o documento")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var cifrado []byte
	var tipo string
	err = tx.QueryRow(r.Context(), `SELECT m.documento_cifrado, m.tipo FROM relatos x JOIN moradores m ON m.id = x.morador_id
		WHERE x.id = $1 AND x.ocorrencia_id = $2`, relato, ocorrencia).Scan(&cifrado, &tipo)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Erro(w, http.StatusNotFound, "relato sem cadastro")
		return
	}
	if err != nil {
		h.Log.Error("ver documento", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao abrir o documento")
		return
	}
	doc, err := h.Cifra.Decifrar(cifrado)
	if err != nil {
		// Chave trocada depois do cadastro: o documento não abre mais.
		h.Log.Error("ver documento: decifrar", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "o documento não pôde ser aberto com a chave atual")
		return
	}
	// O evento guarda quem viu e de qual relato, nunca o documento.
	dados, _ := json.Marshal(map[string]any{"relato": relato, "tipo": tipo})
	if _, err := tx.Exec(r.Context(), `INSERT INTO eventos (ocorrencia_id, tipo, autor, dados)
		VALUES ($1, 'documento_visto', NULLIF($2, ''), $3)`, ocorrencia, u.Login, dados); err != nil {
		h.Log.Error("ver documento: evento", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar o acesso")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar o acesso")
		return
	}
	h.Log.Info("documento de morador visto", "autor", u.Login, "ocorrencia", ocorrencia)
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]string{"documento": Formatar(doc)})
}

// ApagarPeloGestor trata DELETE /ocorrencias/{id}/relatos/{relato}/morador,
// só do gestor: apaga o cadastro de quem fez o relato, para liberar o CPF
// quando a pessoa trocou de celular sem o código. Os relatos ficam, sem dono
// (ON DELETE SET NULL), e o histórico do chamado guarda quem apagou.
func (h *Handlers) ApagarPeloGestor(w http.ResponseWriter, r *http.Request) {
	ocorrencia, relato := r.PathValue("id"), r.PathValue("relato")
	if !reUUID.MatchString(ocorrencia) || !reUUID.MatchString(relato) {
		httpx.Erro(w, http.StatusNotFound, "relato sem cadastro")
		return
	}
	u, _ := auth.DoContexto(r.Context())
	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao apagar o cadastro")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var morador, tipo string
	err = tx.QueryRow(r.Context(), `SELECT m.id, m.tipo FROM relatos x JOIN moradores m ON m.id = x.morador_id
		WHERE x.id = $1 AND x.ocorrencia_id = $2`, relato, ocorrencia).Scan(&morador, &tipo)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Erro(w, http.StatusNotFound, "relato sem cadastro")
		return
	}
	if err != nil {
		h.Log.Error("apagar cadastro pelo gestor", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao apagar o cadastro")
		return
	}
	if _, err := tx.Exec(r.Context(), `DELETE FROM moradores WHERE id = $1`, morador); err != nil {
		h.Log.Error("apagar cadastro pelo gestor: delete", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao apagar o cadastro")
		return
	}
	dados, _ := json.Marshal(map[string]any{"relato": relato, "tipo": tipo})
	if _, err := tx.Exec(r.Context(), `INSERT INTO eventos (ocorrencia_id, tipo, autor, dados)
		VALUES ($1, 'cadastro_apagado', NULLIF($2, ''), $3)`, ocorrencia, u.Login, dados); err != nil {
		h.Log.Error("apagar cadastro pelo gestor: evento", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar a exclusão")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar a exclusão")
		return
	}
	h.Log.Info("cadastro de morador apagado pelo gestor", "autor", u.Login, "ocorrencia", ocorrencia)
	w.WriteHeader(http.StatusNoContent)
}

func campo(m *Moradia, f func(Moradia) string) string {
	if m == nil {
		return ""
	}
	return f(*m)
}
