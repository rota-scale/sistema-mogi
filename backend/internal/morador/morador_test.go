package morador

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/auth"
)

func handlersDeTeste(t *testing.T) *Handlers {
	t.Helper()
	c, err := NovaCifra([]byte(segredoDeTeste))
	if err != nil {
		t.Fatal(err)
	}
	return &Handlers{Auth: auth.Novo(nil, []byte(segredoDeTeste)), Cifra: c, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
}

func codigo(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var d struct {
		Codigo string `json:"codigo"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &d)
	return d.Codigo
}

func TestEuSemTokenDa401(t *testing.T) {
	h := handlersDeTeste(t)
	chamou := false
	rota := h.Exigir(func(http.ResponseWriter, *http.Request) { chamou = true })
	for nome, cab := range map[string]string{
		"sem token":      "",
		"token quebrado": "Bearer abc.def.ghi",
	} {
		r := httptest.NewRequest("GET", "/eu", nil)
		if cab != "" {
			r.Header.Set("Authorization", cab)
		}
		w := httptest.NewRecorder()
		rota(w, r)
		if w.Code != http.StatusUnauthorized || codigo(t, w) != "cadastro_obrigatorio" || chamou {
			t.Fatalf("%s: %d %s", nome, w.Code, w.Body)
		}
	}
}

func TestCadastroRecusaSemAceiteEDocumentoInvalido(t *testing.T) {
	h := handlersDeTeste(t)
	casos := map[string]struct {
		corpo, codigo string
	}{
		"sem aceite":     {`{"tipo":"pf","nome":"Maria","documento":"52998224725"}`, "aceite_obrigatorio"},
		"cpf inválido":   {`{"tipo":"pf","nome":"Maria","documento":"529.982.247-24","aceite":true}`, "documento_invalido"},
		"cnpj inválido":  {`{"tipo":"pj","nome":"Padaria","documento":"11222333000180","aceite":true}`, "documento_invalido"},
		"cpf como pj":    {`{"tipo":"pj","nome":"Padaria","documento":"52998224725","aceite":true}`, "documento_invalido"},
		"tipo estranho":  {`{"tipo":"empresa","nome":"X","documento":"52998224725","aceite":true}`, "tipo_invalido"},
		"nome em branco": {`{"tipo":"pf","nome":"  ","documento":"52998224725","aceite":true}`, "nome_invalido"},
	}
	for nome, c := range casos {
		w := httptest.NewRecorder()
		h.Cadastrar(w, httptest.NewRequest("POST", "/moradores", strings.NewReader(c.corpo)))
		if w.Code != http.StatusBadRequest || codigo(t, w) != c.codigo {
			t.Errorf("%s: %d %s", nome, w.Code, w.Body)
		}
		if strings.Contains(w.Body.String(), "52998224725") {
			t.Errorf("%s: a resposta ecoou o documento", nome)
		}
	}
}

// O token de morador não abre rota da equipe e o da equipe não vale como
// morador.
func TestTokensNaoSeMisturam(t *testing.T) {
	a := auth.Novo(nil, []byte(segredoDeTeste))
	tok, err := a.EmitirMorador("0b6f3c1e-2d7a-4c8e-9f10-1a2b3c4d5e6f", 3)
	if err != nil {
		t.Fatal(err)
	}
	if id, ses, err := a.ConferirMorador(tok); err != nil || id != "0b6f3c1e-2d7a-4c8e-9f10-1a2b3c4d5e6f" || ses != 3 {
		t.Fatalf("token de morador: %q %v", id, err)
	}
	if _, err := a.Atual(t.Context(), tok); err == nil {
		t.Fatal("token de morador não pode passar em Atual")
	}
	r := httptest.NewRequest("GET", "/ocorrencias", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	a.ExigirPapel(func(http.ResponseWriter, *http.Request) { t.Fatal("não podia chegar aqui") }, auth.PapelGestor, auth.PapelOperador)(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("rota da central com token de morador: %d", w.Code)
	}
}

func TestMoradiaLimpa(t *testing.T) {
	m, err := Moradia{Cep: "37530-000", Municipio: "  Itamogi ", UF: "mg", IBGE: "3132909"}.Limpa()
	if err != nil || m.Cep != "37530000" || m.Municipio != "Itamogi" || m.UF != "MG" || m.IBGE != "3132909" {
		t.Fatalf("%+v, %v", m, err)
	}
	if m, err := (Moradia{}).Limpa(); err != nil || m != (Moradia{}) {
		t.Fatalf("vazio devia passar: %+v, %v", m, err)
	}
	for _, ruim := range []Moradia{{Cep: "3753"}, {UF: "M1"}, {UF: "MGA"}, {IBGE: "123"}} {
		if _, err := ruim.Limpa(); err == nil {
			t.Errorf("devia recusar %+v", ruim)
		}
	}
}

// Com o módulo de recuperação desligado (protótipo), entrar com o código
// responde 404 antes de olhar o banco: não vira um teste de CPF.
func TestEntrarComModuloDesligado(t *testing.T) {
	h := handlersDeTeste(t)
	h.Recuperacao = func(context.Context) bool { return false }
	w := httptest.NewRecorder()
	h.Entrar(w, httptest.NewRequest("POST", "/moradores/entrar", strings.NewReader(`{"documento":"52998224725","codigo":"AAAA-BBBB-CCCC"}`)))
	if w.Code != http.StatusNotFound || codigo(t, w) != "modulo_desligado" || strings.Contains(w.Body.String(), "token") {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}
