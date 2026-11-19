package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
)

// Cadastro é a forma pública de um usuário do painel, sem a senha.
type Cadastro struct {
	Login      string    `json:"login"`
	Nome       string    `json:"nome"`
	Papel      string    `json:"papel"`
	Secretaria string    `json:"secretaria"`
	Ativo      bool      `json:"ativo"`
	CriadoEm   time.Time `json:"criado_em"`
}

var reLogin = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,31}$`)

const senhaMinima = 8

func papelValido(p string) bool {
	return p == PapelGestor || p == PapelOperador || p == PapelCampo || p == PapelPrefeito
}

// conferirCadastro valida o que vale para criar e para atualizar.
func conferirCadastro(papel, secretaria string) string {
	if !papelValido(papel) {
		return "papel deve ser gestor, operador, campo ou prefeito"
	}
	if papel == PapelCampo && secretaria == "" {
		return "usuário de campo precisa de uma secretaria"
	}
	return ""
}

// ListarUsuarios trata GET /admin/usuarios.
func (s *Servico) ListarUsuarios(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT login, COALESCE(nome, ''), papel, COALESCE(secretaria, ''), ativo, criado_em
		FROM usuarios ORDER BY ativo DESC, papel, login`)
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao listar usuários")
		return
	}
	lista, err := pgx.CollectRows(rows, pgx.RowToStructByPos[Cadastro])
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao listar usuários")
		return
	}
	if lista == nil {
		lista = []Cadastro{}
	}
	httpx.JSON(w, http.StatusOK, lista)
}

// CriarUsuario trata POST /admin/usuarios.
func (s *Servico) CriarUsuario(w http.ResponseWriter, r *http.Request) {
	var c struct {
		Login, Nome, Senha, Papel, Secretaria string
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&c); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	c.Login = strings.ToLower(strings.TrimSpace(c.Login))
	c.Nome, c.Secretaria = strings.TrimSpace(c.Nome), strings.TrimSpace(c.Secretaria)
	switch {
	case !reLogin.MatchString(c.Login):
		httpx.Erro(w, http.StatusBadRequest, "login de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado")
		return
	case len(c.Senha) < senhaMinima:
		httpx.Erro(w, http.StatusBadRequest, "senha com pelo menos 8 caracteres")
		return
	case len(c.Nome) > 80 || len(c.Secretaria) > 80:
		httpx.Erro(w, http.StatusBadRequest, "nome e secretaria com até 80 caracteres")
		return
	}
	if msg := conferirCadastro(c.Papel, c.Secretaria); msg != "" {
		httpx.Erro(w, http.StatusBadRequest, msg)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(c.Senha), bcrypt.DefaultCost)
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao criar o usuário")
		return
	}
	quem, _ := DoContexto(r.Context())
	_, err = s.pool.Exec(r.Context(), `INSERT INTO usuarios (login, senha_hash, papel, nome, secretaria, criado_por)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6)`, c.Login, string(hash), c.Papel, c.Nome, c.Secretaria, quem.Login)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		httpx.Erro(w, http.StatusConflict, "já existe um usuário com este login")
		return
	}
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao criar o usuário")
		return
	}
	httpx.JSON(w, http.StatusCreated, Cadastro{Login: c.Login, Nome: c.Nome, Papel: c.Papel, Secretaria: c.Secretaria, Ativo: true, CriadoEm: time.Now()})
}

// AtualizarUsuario trata PUT /admin/usuarios/{login}: muda nome, papel,
// secretaria, senha e se está ativo. Só os campos enviados mudam.
func (s *Servico) AtualizarUsuario(w http.ResponseWriter, r *http.Request) {
	var c struct {
		Nome, Papel, Secretaria, Senha *string
		Ativo                          *bool
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&c); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	login := strings.ToLower(r.PathValue("login"))
	var atual Cadastro
	err := s.pool.QueryRow(r.Context(), `SELECT login, COALESCE(nome, ''), papel, COALESCE(secretaria, ''), ativo, criado_em
		FROM usuarios WHERE login = $1`, login).Scan(&atual.Login, &atual.Nome, &atual.Papel, &atual.Secretaria, &atual.Ativo, &atual.CriadoEm)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Erro(w, http.StatusNotFound, "usuário não encontrado")
		return
	} else if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao consultar o usuário")
		return
	}
	if c.Nome != nil {
		atual.Nome = strings.TrimSpace(*c.Nome)
	}
	if c.Papel != nil {
		atual.Papel = *c.Papel
	}
	if c.Secretaria != nil {
		atual.Secretaria = strings.TrimSpace(*c.Secretaria)
	}
	if c.Ativo != nil {
		atual.Ativo = *c.Ativo
	}
	if len(atual.Nome) > 80 || len(atual.Secretaria) > 80 {
		httpx.Erro(w, http.StatusBadRequest, "nome e secretaria com até 80 caracteres")
		return
	}
	if msg := conferirCadastro(atual.Papel, atual.Secretaria); msg != "" {
		httpx.Erro(w, http.StatusBadRequest, msg)
		return
	}
	// Ninguém se tranca para fora: o gestor não tira o próprio papel nem se desliga.
	if quem, _ := DoContexto(r.Context()); quem.Login == login && (atual.Papel != PapelGestor || !atual.Ativo) {
		httpx.Erro(w, http.StatusConflict, "você não pode tirar o seu próprio acesso de gestor")
		return
	}
	var hash *string
	if c.Senha != nil {
		if len(*c.Senha) < senhaMinima {
			httpx.Erro(w, http.StatusBadRequest, "senha com pelo menos 8 caracteres")
			return
		}
		b, err := bcrypt.GenerateFromPassword([]byte(*c.Senha), bcrypt.DefaultCost)
		if err != nil {
			httpx.Erro(w, http.StatusInternalServerError, "falha ao atualizar o usuário")
			return
		}
		h := string(b)
		hash = &h
	}
	if _, err := s.pool.Exec(r.Context(), `UPDATE usuarios SET nome = NULLIF($2, ''), papel = $3, secretaria = NULLIF($4, ''),
			ativo = $5, senha_hash = COALESCE($6, senha_hash) WHERE login = $1`,
		login, atual.Nome, atual.Papel, atual.Secretaria, atual.Ativo, hash); err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao atualizar o usuário")
		return
	}
	httpx.JSON(w, http.StatusOK, atual)
}
