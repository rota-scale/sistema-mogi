package triagem

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/anthropics/anthropic-sdk-go/v2/option"
)

// agenteFalso finge o agente de contexto e anota as chamadas de função.
type agenteFalso struct {
	cx       Contexto
	err      error
	chamadas []string
	pontos   []*Ponto
}

func (a *agenteFalso) Contextualizar(context.Context, Entrada) (Contexto, error) { return a.cx, a.err }

func (a *agenteFalso) Executar(_ context.Context, nome string, args map[string]any, e Entrada) (string, error) {
	a.chamadas = append(a.chamadas, nome)
	a.pontos = append(a.pontos, e.Ponto)
	if nome == "chamados_abertos_perto" {
		return `{"raio_m":150,"chamados":[{"protocolo":"MOGI-2026-000042","categoria":"agua","pessoas":3,"distancia_m":40}]}`, nil
	}
	return "", errors.New("sem histórico")
}

func casoDeExemplo() Contexto {
	n := int16(5)
	d := 40
	return Contexto{
		Orientacoes: []Orientacao{{Categoria: "agua", Titulo: "Quando é grave", Texto: "Cano estourado com água jorrando é crítico."}},
		Casos:       []CasoParecido{{Protocolo: "MOGI-2026-000042", Categoria: "agua", Resumo: "cano rompido na calçada", Status: "resolvida", Nivel: &n, Dias: 12, DistanciaM: &d}},
	}
}

func TestContextoEntraNaTriagemENoRegistro(t *testing.T) {
	s := servicoReal()
	s.Contexto = &agenteFalso{cx: casoDeExemplo()}
	var visto *Contexto
	s.Classificadores = []Classificador{classificadorQueVe{ver: func(e Entrada) { visto = e.Contexto }}, ClassificadorLocal{}}
	r := s.Triar(context.Background(), Entrada{Categoria: "agua", Texto: "cano estourado", Ponto: &Ponto{-21.07, -47.04}})
	if visto == nil || len(visto.Casos) != 1 || len(visto.Orientacoes) != 1 {
		t.Fatalf("o classificador não recebeu o contexto: %+v", visto)
	}
	if r.Registro.Contexto == nil || r.Registro.Contexto.Casos[0].Protocolo != "MOGI-2026-000042" {
		t.Fatalf("o contexto não ficou na trilha: %+v", r.Registro.Contexto)
	}
	if !temEtapa(r.Etapas, "contexto", true) {
		t.Fatalf("etapa de contexto ausente: %+v", r.Etapas)
	}
}

func TestContextoQueFalhaNaoDerrubaATriagem(t *testing.T) {
	s := servicoReal()
	s.Contexto = &agenteFalso{err: errors.New("banco fora")}
	r := s.Triar(context.Background(), Entrada{Categoria: "agua", Texto: "cano estourado jorrando"})
	if r.Nivel == nil || r.Status == "a_classificar" {
		t.Fatalf("sem contexto a triagem segue: %+v", r)
	}
	if !temEtapa(r.Etapas, "contexto", false) {
		t.Fatal("a falha do contexto deveria aparecer no log")
	}
}

func TestTextoDoContextoSemCoordenada(t *testing.T) {
	cx := casoDeExemplo()
	s := cx.Texto(0)
	if !strings.Contains(s, "MOGI-2026-000042") || !strings.Contains(s, "nível 5") || !strings.Contains(s, "resolvido") {
		t.Fatalf("texto: %s", s)
	}
	if strings.Contains(s, "-21.") || strings.Contains(s, "-47.") {
		t.Fatal("coordenada não pode ir no texto")
	}
	if len([]rune(cx.Texto(30))) > 31 {
		t.Fatal("o limite corta o texto")
	}
	var nada *Contexto
	if nada.Texto(100) != "" {
		t.Fatal("contexto nulo vira texto vazio")
	}
}

func TestJevRecebeOContexto(t *testing.T) {
	srv, vistos := servidorJev(t, func(int) (int, any) {
		return 200, respostaFalsa("agua", 0.95, map[string]float64{"agua_jorrando": 0.93})
	})
	j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL})
	cx := casoDeExemplo()
	if _, err := j.Classificar(context.Background(), Entrada{Categoria: "agua", Texto: "cano", Contexto: &cx, Ponto: &Ponto{-21.0756, -47.0486}}); err != nil {
		t.Fatal(err)
	}
	estado := (*vistos)[0].json["state"].(map[string]any)
	got, _ := estado["contexto_da_prefeitura"].(string)
	if !strings.Contains(got, "MOGI-2026-000042") || !strings.Contains(got, "crítico") {
		t.Fatalf("contexto no Jev: %q", got)
	}
	cru, _ := json.Marshal((*vistos)[0].json)
	if strings.Contains(string(cru), "-21.0756") || strings.Contains(string(cru), "-47.0486") {
		t.Fatal("o ponto do relato não pode sair para o Jev")
	}
}

// A IA pede uma ferramenta, recebe o resultado e só então responde.
func TestIAChamaFerramentaEDepoisResponde(t *testing.T) {
	var corpos []map[string]any
	final, _ := json.Marshal(map[string]any{
		"categoria": "agua", "resumo": "cano rompido jorrando água na calçada", "foto_util": true,
		"sinais": []any{map[string]any{"nome": "agua_jorrando", "probabilidade": 0.95}},
		"g":      nota5(), "u": nota5(), "t": nota5(), "confianca": 0.9,
	})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bruto, _ := io.ReadAll(r.Body)
		var c map[string]any
		_ = json.Unmarshal(bruto, &c)
		corpos = append(corpos, c)
		w.Header().Set("Content-Type", "application/json")
		if len(corpos) == 1 {
			_, _ = io.WriteString(w, `{"id":"m1","type":"message","role":"assistant","model":"claude-opus-5-5",
				"content":[{"type":"text","text":"Vou ver se já relataram aqui."},
				           {"type":"tool_use","id":"tu1","name":"chamados_abertos_perto","input":{}},
				           {"type":"tool_use","id":"tu2","name":"buscar_casos_parecidos","input":{"descricao":"cano estourado"}}],
				"stop_reason":"tool_use","usage":{"input_tokens":900,"output_tokens":60}}`)
			return
		}
		texto, _ := json.Marshal(string(final))
		_, _ = io.WriteString(w, `{"id":"m2","type":"message","role":"assistant","model":"claude-opus-5-5",
			"content":[{"type":"text","text":`+string(texto)+`}],
			"stop_reason":"end_turn","usage":{"input_tokens":1100,"output_tokens":200}}`)
	}))
	defer srv.Close()

	ag := &agenteFalso{}
	ia := &IA{cli: anthropic.NewClient(option.WithAPIKey("k"), option.WithBaseURL(srv.URL), option.WithMaxRetries(0)), modelo: "claude-opus-5-5", cambio: 5, Agente: ag}
	cx := Contexto{}
	d, uso, err := ia.Descrever(context.Background(), Entrada{Categoria: "agua", Foto: []byte{0xff, 0xd8, 0xff}, Contexto: &cx, Ponto: &Ponto{-21.0756, -47.0486}})
	if err != nil {
		t.Fatal(err)
	}
	if d.Categoria != "agua" || d.Sugestao == nil || d.Sugestao.Confianca != 0.9 {
		t.Fatalf("descrição: %+v", d)
	}
	if strings.Join(ag.chamadas, ",") != "chamados_abertos_perto,buscar_casos_parecidos" {
		t.Fatalf("ferramentas chamadas: %v", ag.chamadas)
	}
	if ag.pontos[0] == nil {
		t.Fatal("a ferramenta precisa do ponto, que fica no servidor")
	}
	if len(cx.Ferramentas) != 2 || cx.Ferramentas[1].Erro == "" || cx.Ferramentas[0].Erro != "" {
		t.Fatalf("registro das chamadas: %+v", cx.Ferramentas)
	}
	if uso.TokensEntrada != 2000 || uso.TokensSaida != 260 {
		t.Fatalf("o uso soma as duas idas: %+v", uso)
	}
	if len(corpos) != 2 {
		t.Fatalf("idas ao modelo: %d", len(corpos))
	}
	if ferramentas, _ := corpos[0]["tools"].([]any); len(ferramentas) != len(Ferramentas) {
		t.Fatalf("ferramentas oferecidas: %v", corpos[0]["tools"])
	}
	segunda, _ := json.Marshal(corpos[1]["messages"])
	if !strings.Contains(string(segunda), `"tool_result"`) || !strings.Contains(string(segunda), "MOGI-2026-000042") || !strings.Contains(string(segunda), `"is_error":true`) {
		t.Fatalf("a segunda ida devolve os resultados: %s", segunda)
	}
	if strings.Contains(string(segunda), "-21.0756") {
		t.Fatal("o ponto não pode ir ao modelo")
	}
}

func TestIASemAgenteNaoOfereceFerramentas(t *testing.T) {
	var corpo map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&corpo)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"m","type":"message","role":"assistant","model":"m","content":[{"type":"text","text":"{}"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer srv.Close()
	ia := &IA{cli: anthropic.NewClient(option.WithAPIKey("k"), option.WithBaseURL(srv.URL), option.WithMaxRetries(0)), modelo: "m", cambio: 5}
	_, _ = ia.Classificar(context.Background(), Entrada{Texto: "x"})
	if _, ok := corpo["tools"]; ok {
		t.Fatal("sem agente não há ferramentas")
	}
}

func nota5() map[string]any { return map[string]any{"n1": 0, "n2": 0, "n3": 0.1, "n4": 0.3, "n5": 0.6} }

type classificadorQueVe struct{ ver func(Entrada) }

func (c classificadorQueVe) Classificar(ctx context.Context, e Entrada) (Classificacao, error) {
	c.ver(e)
	return ClassificadorLocal{}.Classificar(ctx, e)
}

func temEtapa(l []Etapa, nome string, ok bool) bool {
	for _, e := range l {
		if e.Nome == nome && e.OK == ok {
			return true
		}
	}
	return false
}
