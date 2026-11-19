package cidade

import (
	"encoding/json"
	"net/http"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
)

type resposta struct {
	Cidade     Cidade     `json:"cidade"`
	Parametros Parametros `json:"parametros"`
	Padrao     Parametros `json:"padrao"`
}

func (s *Servico) responder(w http.ResponseWriter, r *http.Request) {
	c, err := s.Cidade(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao ler a cidade")
		return
	}
	httpx.JSON(w, http.StatusOK, resposta{c, s.Atuais(r.Context()), Padrao()})
}

// Ler trata GET /admin/parametros: a cidade, os parâmetros em vigor e os de fábrica.
func (s *Servico) Ler(w http.ResponseWriter, r *http.Request) { s.responder(w, r) }

// Gravar trata PUT /admin/parametros. O corpo é o documento inteiro de
// parâmetros; o que faltar nele fica com o valor em vigor.
func (s *Servico) Gravar(w http.ResponseWriter, r *http.Request) {
	p := s.Atuais(r.Context())
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&p); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	if err := p.Conferir(); err != nil {
		httpx.Erro(w, http.StatusBadRequest, err.Error())
		return
	}
	u, _ := auth.DoContexto(r.Context())
	if err := s.Salvar(r.Context(), p, u.Login); err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao gravar os parâmetros")
		return
	}
	s.responder(w, r)
}
