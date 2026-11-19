// Package auth emite e confere o JWT de operador e gestor (RF10).
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
)

const validade = 12 * time.Hour

// Papéis: gestor (tudo, inclusive regras e usuários), operador (triagem e
// despacho) e campo (a equipe na rua, que só vê e resolve os chamados da
// própria secretaria). Veja o ADR 0016.
const (
	PapelGestor   = "gestor"
	PapelOperador = "operador"
	PapelCampo    = "campo"
	// PapelPrefeito acompanha a cidade pelo gabinete: vê tudo, não muda nada.
	PapelPrefeito = "prefeito"
	// PapelMorador é o do token do app do morador (ADR 0024). Ele não é um
	// usuário do painel: Atual recusa esse token em toda rota da equipe.
	PapelMorador = "morador"
)

// validadeMorador é longa: o token fica guardado no aparelho do morador e,
// vencido, basta repetir o cadastro com o mesmo documento.
const validadeMorador = 90 * 24 * time.Hour

type Usuario struct {
	Login      string `json:"login"`
	Papel      string `json:"papel"`
	Nome       string `json:"nome,omitempty"`
	Secretaria string `json:"secretaria,omitempty"`
}

type Servico struct {
	pool    *pgxpool.Pool
	segredo []byte
	// Erros conta as senhas erradas por IP e login. Entrar certo não conta:
	// uma prefeitura inteira pode sair pelo mesmo IP.
	Erros *httpx.Limitador
	// IP diz de onde vem o pedido (veja httpx.Origem).
	IP func(*http.Request) string
}

func Novo(pool *pgxpool.Pool, segredo []byte) *Servico {
	return &Servico{pool: pool, segredo: segredo}
}

// Semear cria o usuário inicial se ele ainda não existir. Sem senha, não cria.
func (s *Servico) Semear(ctx context.Context, login, senha, papel, secretaria string) (bool, error) {
	if senha == "" || login == "" {
		return false, nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(senha), bcrypt.DefaultCost)
	if err != nil {
		return false, err
	}
	tag, err := s.pool.Exec(ctx, `INSERT INTO usuarios (login, senha_hash, papel, secretaria)
		VALUES ($1, $2, $3, NULLIF($4, '')) ON CONFLICT (login) DO NOTHING`, login, string(hash), papel, secretaria)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// Nomear grava o nome de exibição de um usuário inicial que ainda não tem.
func (s *Servico) Nomear(ctx context.Context, login, nome string) error {
	if login == "" || nome == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `UPDATE usuarios SET nome = $2 WHERE login = $1 AND COALESCE(nome, '') = ''`, login, nome)
	return err
}

type claims struct {
	Papel string `json:"papel"`
	// Sessao do morador: sobe a cada entrada e invalida os tokens antigos.
	Sessao int `json:"ses,omitempty"`
	jwt.RegisteredClaims
}

func (s *Servico) emitir(u Usuario) (string, error) {
	agora := time.Now()
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Papel: u.Papel,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.Login,
			IssuedAt:  jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(validade)),
			Issuer:    "mogi",
		},
	})
	return t.SignedString(s.segredo)
}

// EmitirMorador assina o token de papel morador, com o id do cadastro.
func (s *Servico) EmitirMorador(id string, sessao int) (string, error) {
	agora := time.Now()
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Papel:  PapelMorador,
		Sessao: sessao,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   id,
			IssuedAt:  jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(validadeMorador)),
			Issuer:    "mogi",
		},
	})
	return t.SignedString(s.segredo)
}

// ErrNaoEMorador: o token é válido, mas não é de morador.
var ErrNaoEMorador = errors.New("token não é de morador")

// ConferirMorador valida um token de morador e devolve o id do cadastro.
// Token da equipe não serve aqui, como o de morador não serve no painel.
func (s *Servico) ConferirMorador(token string) (string, int, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		return s.segredo, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("mogi"))
	if err != nil {
		return "", 0, err
	}
	if c.Papel != PapelMorador || c.Subject == "" {
		return "", 0, ErrNaoEMorador
	}
	return c.Subject, c.Sessao, nil
}

// Conferir valida o token e devolve o usuário.
func (s *Servico) Conferir(token string) (Usuario, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		return s.segredo, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("mogi"))
	if err != nil {
		return Usuario{}, err
	}
	return Usuario{Login: c.Subject, Papel: c.Papel}, nil
}

// Login é o handler de POST /auth/login.
func (s *Servico) Login(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		Login string `json:"login"`
		Senha string `json:"senha"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&corpo); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	corpo.Login = strings.ToLower(strings.TrimSpace(corpo.Login))
	tentativa := ""
	if s.Erros != nil && s.IP != nil {
		tentativa = s.IP(r) + "|" + corpo.Login
		if s.Erros.Cheio(tentativa, time.Now()) {
			httpx.ErroCodigo(w, http.StatusTooManyRequests, "muitos_envios", "muitas senhas erradas, aguarde alguns minutos")
			return
		}
	}
	errou := func() {
		if tentativa != "" {
			s.Erros.Permitir(tentativa, time.Now())
		}
		httpx.Erro(w, http.StatusUnauthorized, "login ou senha incorretos")
	}
	var hash string
	var ativo bool
	u := Usuario{Login: corpo.Login}
	err := s.pool.QueryRow(r.Context(), `SELECT senha_hash, papel, COALESCE(nome, ''), COALESCE(secretaria, ''), ativo
		FROM usuarios WHERE login = $1`, corpo.Login).Scan(&hash, &u.Papel, &u.Nome, &u.Secretaria, &ativo)
	if errors.Is(err, pgx.ErrNoRows) {
		// Gasta o mesmo tempo de uma senha errada, para não revelar se o login existe.
		_ = bcrypt.CompareHashAndPassword([]byte(hashFalso), []byte(corpo.Senha))
		errou()
		return
	}
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao consultar usuário")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(corpo.Senha)) != nil || !ativo {
		errou()
		return
	}
	token, err := s.emitir(u)
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao emitir token")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"token": token, "usuario": u})
}

// Eu é o handler de GET /auth/eu: devolve o usuário do token.
func (s *Servico) Eu(w http.ResponseWriter, r *http.Request) {
	u, _ := DoContexto(r.Context())
	httpx.JSON(w, http.StatusOK, u)
}

type chaveCtx struct{}

// Exigir protege um handler com o JWT no cabeçalho Authorization.
func (s *Servico) Exigir(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			httpx.Erro(w, http.StatusUnauthorized, "token ausente")
			return
		}
		u, err := s.Atual(r.Context(), token)
		if err != nil {
			httpx.Erro(w, http.StatusUnauthorized, "token inválido")
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), chaveCtx{}, u)))
	}
}

// ExigirPapel protege um handler que só alguns papéis podem usar.
func (s *Servico) ExigirPapel(h http.HandlerFunc, papeis ...string) http.HandlerFunc {
	return s.Exigir(func(w http.ResponseWriter, r *http.Request) {
		u, _ := DoContexto(r.Context())
		if !slices.Contains(papeis, u.Papel) {
			httpx.Erro(w, http.StatusForbidden, "seu papel não permite esta ação")
			return
		}
		h(w, r)
	})
}

// Atual valida o token e confere no banco se o usuário continua ativo. O
// papel e a secretaria valem os do banco, não os do token: rebaixar ou
// desligar alguém vale na hora, sem esperar o token de 12 horas vencer.
func (s *Servico) Atual(ctx context.Context, token string) (Usuario, error) {
	u, err := s.Conferir(token)
	if err != nil {
		return Usuario{}, err
	}
	// Token de morador nunca abre rota da equipe, mesmo que um login do
	// painel venha a coincidir com o id de um cadastro.
	if u.Papel == PapelMorador {
		return Usuario{}, errors.New("token de morador não vale no painel")
	}
	var ativo bool
	err = s.pool.QueryRow(ctx, `SELECT papel, COALESCE(nome, ''), COALESCE(secretaria, ''), ativo
		FROM usuarios WHERE login = $1`, u.Login).Scan(&u.Papel, &u.Nome, &u.Secretaria, &ativo)
	if err != nil {
		return Usuario{}, err
	}
	if !ativo {
		return Usuario{}, errors.New("usuário desligado")
	}
	return u, nil
}

// hashFalso é o bcrypt de uma senha qualquer, comparado quando o login não existe.
var hashFalso = func() string {
	h, _ := bcrypt.GenerateFromPassword([]byte("login-inexistente"), bcrypt.DefaultCost)
	return string(h)
}()

// DoContexto devolve o usuário autenticado pela middleware Exigir.
func DoContexto(ctx context.Context) (Usuario, bool) {
	u, ok := ctx.Value(chaveCtx{}).(Usuario)
	return u, ok
}
