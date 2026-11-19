// Package admin é a tela do gestor (T7): regras Lua, limiares e
// secretarias da prefeitura, editáveis sem novo deploy (C5).
package admin

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/ocorrencias"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

const tamanhoMaximoRegra = 32 << 10

var nomeDeArquivo = regexp.MustCompile(`^_?[a-z0-9_]{1,40}\.lua$`)

type Handlers struct {
	Motor triagem.MotorLua
	Repo  *ocorrencias.Repositorio
	Pool  *pgxpool.Pool
	Log   *slog.Logger
}

type regra struct {
	Arquivo  string `json:"arquivo"`
	Conteudo string `json:"conteudo"`
}

func (h *Handlers) pasta() string { return filepath.Join(h.Motor.Dir, h.Motor.Cidade) }

// Regras trata GET /admin/regras: todos os scripts da cidade.
func (h *Handlers) Regras(w http.ResponseWriter, r *http.Request) {
	entradas, err := os.ReadDir(h.pasta())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "pasta de regras indisponível")
		return
	}
	lista := []regra{}
	for _, e := range entradas {
		if e.IsDir() || !nomeDeArquivo.MatchString(e.Name()) {
			continue
		}
		b, err := os.ReadFile(filepath.Join(h.pasta(), e.Name()))
		if err != nil {
			continue
		}
		lista = append(lista, regra{e.Name(), string(b)})
	}
	sort.Slice(lista, func(i, j int) bool { return lista[i].Arquivo < lista[j].Arquivo })
	httpx.JSON(w, http.StatusOK, map[string]any{"cidade": h.Motor.Cidade, "regras": lista})
}

func (h *Handlers) lerRegra(w http.ResponseWriter, r *http.Request) (regra, bool) {
	var corpo regra
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, tamanhoMaximoRegra+1024)).Decode(&corpo); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido ou regra maior que 32 KB")
		return corpo, false
	}
	if a := r.PathValue("arquivo"); a != "" {
		corpo.Arquivo = a
	}
	if !nomeDeArquivo.MatchString(corpo.Arquivo) {
		httpx.Erro(w, http.StatusBadRequest, "nome de arquivo inválido: use letras minúsculas, números e _ com final .lua")
		return corpo, false
	}
	if strings.TrimSpace(corpo.Conteudo) == "" {
		httpx.Erro(w, http.StatusBadRequest, "a regra está vazia")
		return corpo, false
	}
	return corpo, true
}

// Testar trata POST /admin/regras/testar: roda os cenários de referência
// com o conteúdo enviado, sem salvar.
func (h *Handlers) Testar(w http.ResponseWriter, r *http.Request) {
	corpo, ok := h.lerRegra(w, r)
	if !ok {
		return
	}
	sim, err := h.Motor.Simular(r.Context(), corpo.Arquivo, corpo.Conteudo)
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao simular a regra")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": semErro(sim), "cenarios": sim})
}

// Salvar trata PUT /admin/regras/{arquivo}. A regra só é gravada se todos
// os cenários de referência rodarem na sandbox sem erro; a versão salva
// fica no histórico com o autor.
func (h *Handlers) Salvar(w http.ResponseWriter, r *http.Request) {
	corpo, ok := h.lerRegra(w, r)
	if !ok {
		return
	}
	sim, err := h.Motor.Simular(r.Context(), corpo.Arquivo, corpo.Conteudo)
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao validar a regra")
		return
	}
	if !semErro(sim) {
		httpx.JSON(w, http.StatusUnprocessableEntity, map[string]any{
			"erro": "a regra falhou na sandbox e não foi salva", "cenarios": sim})
		return
	}
	u, _ := auth.DoContexto(r.Context())
	if _, err := h.Pool.Exec(r.Context(), `INSERT INTO regras_historico (cidade, arquivo, conteudo, autor) VALUES ($1, $2, $3, $4)`,
		h.Motor.Cidade, corpo.Arquivo, corpo.Conteudo, u.Login); err != nil {
		h.Log.Error("histórico de regra", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar o histórico; nada foi salvo")
		return
	}
	// Grava num temporário e renomeia, para a triagem nunca ler meia regra.
	destino := filepath.Join(h.pasta(), corpo.Arquivo)
	tmp := destino + ".tmp"
	if err := os.WriteFile(tmp, []byte(corpo.Conteudo), 0o644); err == nil {
		err = os.Rename(tmp, destino)
	}
	if err != nil {
		_ = os.Remove(tmp)
		h.Log.Error("gravar regra", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao gravar a regra no servidor")
		return
	}
	h.Log.Info("regra alterada", "arquivo", corpo.Arquivo, "autor", u.Login)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "cenarios": sim})
}

func semErro(sim []triagem.Simulado) bool {
	for _, s := range sim {
		if s.Erro != "" {
			return false
		}
	}
	return true
}

// Categorias trata GET /admin/categorias.
func (h *Handlers) Categorias(w http.ResponseWriter, r *http.Request) {
	cats, err := h.Repo.Categorias(r.Context())
	if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao ler as categorias")
		return
	}
	httpx.JSON(w, http.StatusOK, cats)
}

// SalvarCategoria trata PUT /admin/categorias/{id}: nome e secretaria.
func (h *Handlers) SalvarCategoria(w http.ResponseWriter, r *http.Request) {
	var c ocorrencias.Categoria
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&c); err != nil {
		httpx.Erro(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	c.ID = r.PathValue("id")
	c.Nome, c.Secretaria = strings.TrimSpace(c.Nome), strings.TrimSpace(c.Secretaria)
	if c.Nome == "" || c.Secretaria == "" || len(c.Nome) > 80 || len(c.Secretaria) > 80 {
		httpx.Erro(w, http.StatusBadRequest, "nome e secretaria são obrigatórios, com até 80 caracteres")
		return
	}
	err := h.Repo.AtualizarCategoria(r.Context(), c)
	if errors.Is(err, ocorrencias.ErrNaoEncontrada) {
		httpx.Erro(w, http.StatusNotFound, "categoria não encontrada")
		return
	} else if err != nil {
		httpx.Erro(w, http.StatusInternalServerError, "falha ao salvar a categoria")
		return
	}
	httpx.JSON(w, http.StatusOK, c)
}
