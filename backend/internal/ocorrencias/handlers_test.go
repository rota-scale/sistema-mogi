package ocorrencias

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/cidade"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/geo"
)

func TestCaixaDaCidade(t *testing.T) {
	c, err := LerCaixa("-47.20, -21.22, -46.90, -20.95")
	if err != nil || c == nil {
		t.Fatalf("caixa válida recusada: %v", err)
	}
	if !c.Contem(-21.0756, -47.0486) {
		t.Fatal("o centro de Itamogi deveria estar dentro")
	}
	if c.Contem(-23.55, -46.63) {
		t.Fatal("São Paulo deveria estar fora")
	}
	if vazia, err := LerCaixa("  "); vazia != nil || err != nil {
		t.Fatal("caixa vazia desliga a cerca, sem erro")
	}
	for _, ruim := range []string{"1,2,3", "a,b,c,d", "-46.90,-21.22,-47.20,-20.95"} {
		if _, err := LerCaixa(ruim); err == nil {
			t.Fatalf("caixa %q deveria ser recusada", ruim)
		}
	}
}

// Dois envios com a mesma chave ao mesmo tempo: só um trabalha, o outro
// espera e é avisado de que não foi o primeiro.
func TestEnviosSimultaneosComAMesmaChave(t *testing.T) {
	h := &Handlers{}
	var primeiros, trabalhando atomic.Int32
	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			primeiro, sair := h.entrar(context.Background(), "chave-a")
			defer sair()
			if primeiro {
				primeiros.Add(1)
				if trabalhando.Add(1) > 1 {
					t.Error("dois envios da mesma chave trabalharam juntos")
				}
				time.Sleep(20 * time.Millisecond)
				trabalhando.Add(-1)
			}
		}()
	}
	wg.Wait()
	if primeiros.Load() < 1 {
		t.Fatal("alguém precisa ser o primeiro")
	}
	if primeiro, sair := h.entrar(context.Background(), ""); !primeiro {
		t.Fatal("sem chave não há espera")
	} else {
		sair()
	}
}

// O recibo do morador não pode carregar nada do chamado de outra pessoa.
func TestReciboNaoVazaOChamado(t *testing.T) {
	texto, login, endereco := "relato de outro morador", "operador", "Rua de Outro, 10"
	nivel := int16(4)
	o := Ocorrencia{
		ID: "id-interno", Protocolo: "MOGI-2026-000001", Categoria: "agua", Status: "revisao", Nivel: &nivel,
		Texto: &texto, Endereco: &endereco, RevisadoPor: &login, Relatos: 2,
		Triagem: json.RawMessage(`{"motivo":"interno"}`), MidiaURL: "/api/midia?c=x",
	}
	b, err := json.Marshal(ReciboDe(o, Nova{Chave: "segredo", Endereco: "Rua Minha, 5"}, true))
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, proibido := range []string{"id-interno", texto, login, endereco, "interno", "midia"} {
		if strings.Contains(s, proibido) {
			t.Fatalf("o recibo vazou %q: %s", proibido, s)
		}
	}
	for _, esperado := range []string{"MOGI-2026-000001", "segredo", "Rua Minha, 5", `"agrupada":true`, `"relatos":2`} {
		if !strings.Contains(s, esperado) {
			t.Fatalf("faltou %q no recibo: %s", esperado, s)
		}
	}
}

// Com o módulo cadastro ligado (padrão), relatar e dar "Também vi" sem o
// token de morador dá 401 com o código que o app entende (ADR 0024).
func TestEnvioSemCadastroDa401(t *testing.T) {
	h := &Handlers{Morador: func(*http.Request) string { return "" }}
	for nome, chamar := range map[string]func(http.ResponseWriter, *http.Request){
		"relato":    h.Criar,
		"também vi": h.TambemVi,
	} {
		corpo := `{"ref":"x","lat":-21.07,"lng":-47.04}`
		r := httptest.NewRequest("POST", "/ocorrencias", strings.NewReader(corpo))
		w := httptest.NewRecorder()
		chamar(w, r)
		var d struct{ Erro, Codigo string }
		_ = json.Unmarshal(w.Body.Bytes(), &d)
		if w.Code != http.StatusUnauthorized || d.Codigo != "cadastro_obrigatorio" || d.Erro != "Faça seu cadastro para relatar" {
			t.Fatalf("%s: %d %s", nome, w.Code, w.Body)
		}
	}
	// Desligado o módulo, o pedido segue (e para adiante, por falta de foto).
	h.Parametros = func(context.Context) cidade.Parametros {
		p := cidade.Padrao()
		p.Modulos.Cadastro = false
		return p
	}
	w := httptest.NewRecorder()
	h.Criar(w, httptest.NewRequest("POST", "/ocorrencias", strings.NewReader("")))
	if w.Code == http.StatusUnauthorized {
		t.Fatal("com o cadastro desligado o envio não exige token")
	}
}

func TestReciboAvisaForaDoEscopo(t *testing.T) {
	b, _ := json.Marshal(ReciboDe(Ocorrencia{Protocolo: "MOGI-2026-000002"}, Nova{ForaDoEscopo: true}, false))
	if !strings.Contains(string(b), `"fora_do_escopo":true`) {
		t.Fatalf("recibo sem o aviso: %s", b)
	}
}

type geoFalso struct{ e geo.Endereco }

func (g geoFalso) Reverso(context.Context, float64, float64) (geo.Endereco, error) { return g.e, nil }

type cepFalso struct{}

func (cepFalso) Buscar(_ context.Context, cep string) (geo.Cep, error) {
	d, err := geo.SoDigitosCep(cep)
	switch {
	case err != nil:
		return geo.Cep{}, err
	case d == "37530000":
		return geo.Cep{Cep: d, Cidade: "Itamogi", UF: "MG", IBGE: "3132909"}, nil
	case d == "11111111":
		return geo.Cep{}, errors.New("sem rede")
	}
	return geo.Cep{}, geo.ErrCepNaoEncontrado
}

// O cadastro preenche a cidade pelo CEP com GET /cep/{cep}.
func TestCepNoCadastro(t *testing.T) {
	h := &Handlers{Ceps: cepFalso{}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	pedir := func(cep string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, "/cep/"+cep, nil)
		r.SetPathValue("cep", cep)
		rec := httptest.NewRecorder()
		h.Cep(rec, r)
		return rec
	}
	rec := pedir("37530-000")
	var c geo.Cep
	if err := json.NewDecoder(rec.Body).Decode(&c); err != nil || rec.Code != http.StatusOK || c.Cidade != "Itamogi" || c.UF != "MG" {
		t.Fatalf("status %d, %+v, %v", rec.Code, c, err)
	}
	for cep, status := range map[string]int{"123": 400, "99999-999": 404, "11111-111": 503} {
		if got := pedir(cep).Code; got != status {
			t.Errorf("%s: esperava %d, veio %d", cep, status, got)
		}
	}
}

// O cadastro preenche o bairro pelo GPS com GET /endereco.
func TestEnderecoPeloGPS(t *testing.T) {
	h := &Handlers{Geo: geoFalso{geo.Endereco{Endereco: "Rua Coronel Antônio Ribeiro, 120", Bairro: "Centro"}}}
	rec := httptest.NewRecorder()
	h.Endereco(rec, httptest.NewRequest(http.MethodGet, "/endereco?lat=-20.795&lng=-47.047", nil))
	var r map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&r); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("status %d, erro %v", rec.Code, err)
	}
	if r["bairro"] != "Centro" || r["endereco"] == "" {
		t.Fatalf("resposta %v", r)
	}
	rec = httptest.NewRecorder()
	h.Endereco(rec, httptest.NewRequest(http.MethodGet, "/endereco?lat=abc", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("ponto inválido devia dar 400, deu %d", rec.Code)
	}
}
