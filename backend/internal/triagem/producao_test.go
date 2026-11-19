package triagem

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type descritorFixo struct {
	d   Descricao
	err error
}

func (f descritorFixo) Descrever(context.Context, Entrada) (Descricao, Uso, error) {
	return f.d, Uso{TokensEntrada: 1500, TokensSaida: 300, CustoBRL: 0.04}, f.err
}

type classificadorFixo struct{ c Classificacao }

func (f classificadorFixo) Classificar(context.Context, Entrada) (Classificacao, error) {
	return f.c, nil
}

// C7: derrubar a IA aciona o fallback e o chamado continua classificado.
func TestVisaoEDecisaoCaemEChamadoContinua(t *testing.T) {
	s := servicoReal()
	s.Descritor = descritorFixo{err: errors.New("IA fora do ar")}
	s.Classificadores = []Classificador{classificadorQuebrado{}, ClassificadorLocal{}}
	r := s.Triar(context.Background(), Entrada{Categoria: "agua", Texto: "cano estourado jorrando", Foto: []byte{1}})
	if r.Nivel == nil || *r.Nivel != 5 || r.Status != "revisao" {
		t.Fatalf("esperado nível 5 em revisão pelo fallback local, veio %v %s", r.Nivel, r.Status)
	}
	var nomes []string
	for _, e := range r.Etapas {
		nomes = append(nomes, e.Nome+":"+map[bool]string{true: "ok", false: "falhou"}[e.OK])
	}
	if got := strings.Join(nomes, " "); got != "visao:falhou classificacao:falhou classificacao:ok regra_lua:ok" {
		t.Fatalf("etapas do log (RF11): %s", got)
	}
	if r.Etapas[0].CustoBRL != 0.04 || r.Etapas[0].TokensEntrada != 1500 {
		t.Fatalf("custo da visão não foi para o log: %+v", r.Etapas[0])
	}
}

// Sem categoria escolhida, a descrição da visão decide (relato sem teclado).
func TestDescricaoDaVisaoAlimentaOClassificadorLocal(t *testing.T) {
	s := servicoReal()
	s.Descritor = descritorFixo{d: Descricao{Categoria: "iluminacao", Resumo: "fio caído sobre a calçada", Sinais: []string{"fio_exposto"}, FotoUtil: true}}
	r := s.Triar(context.Background(), Entrada{Foto: []byte{1}})
	if r.Categoria != "iluminacao" || r.Nivel == nil || *r.Nivel != 5 {
		t.Fatalf("esperado iluminação nível 5 pelo sinal fio_exposto, veio %s %v", r.Categoria, r.Nivel)
	}
	if r.Registro.Descricao == nil || r.Registro.Descricao.Resumo == "" {
		t.Fatal("a descrição da visão deveria ficar no registro auditável")
	}
}

func TestFotoSemProblemaVisivelVaiParaRevisao(t *testing.T) {
	s := servicoReal()
	s.Descritor = descritorFixo{d: Descricao{Categoria: "limpeza", FotoUtil: false}}
	r := s.Triar(context.Background(), Entrada{Categoria: "limpeza", Texto: "lixo parado", Foto: []byte{1}})
	if r.Status != "revisao" {
		t.Fatalf("foto que não mostra o problema pede revisão (RF07), veio %s", r.Status)
	}
}

// Saída fora do esquema conta como falha e aciona o próximo da cadeia.
func TestSaidaForaDoEsquemaAcionaFallback(t *testing.T) {
	casos := map[string]Classificacao{
		"categoria inventada": {Categoria: "disco_voador", G: Distribuicao{1}, U: Distribuicao{1}, T: Distribuicao{1}, Confianca: .9},
		"distribuição vazia":  {Categoria: "vias", U: Distribuicao{1}, T: Distribuicao{1}, Confianca: .9},
		"confiança absurda":   {Categoria: "vias", G: Distribuicao{1}, U: Distribuicao{1}, T: Distribuicao{1}, Confianca: 7},
	}
	for nome, ruim := range casos {
		t.Run(nome, func(t *testing.T) {
			s := servicoReal()
			s.Classificadores = []Classificador{classificadorFixo{ruim}, ClassificadorLocal{}}
			r := s.Triar(context.Background(), Entrada{Categoria: "vias", Texto: "buraco"})
			if r.Registro.Classificacao == nil || r.Registro.Classificacao.Provedor != "local-por-categoria" {
				t.Fatalf("deveria ter caído no classificador local: %+v", r.Registro.Classificacao)
			}
		})
	}
}

func TestDistribuicaoQueNaoSomaUmENormalizada(t *testing.T) {
	s := servicoReal()
	s.Classificadores = []Classificador{classificadorFixo{Classificacao{
		Categoria: "vias", G: Distribuicao{0, 0, 2, 2, 0}, U: Distribuicao{0, 0, 1, 1, 0}, T: Distribuicao{0, 0, 4, 4, 0},
		Confianca: .9, Sinais: map[string]float64{"risco_moto": 3, "nome com espaço": .5},
	}}}
	c := s.Triar(context.Background(), Entrada{Categoria: "vias"}).Registro.Classificacao
	if c.G != (Distribuicao{0, 0, .5, .5, 0}) {
		t.Fatalf("G não foi normalizada: %v", c.G)
	}
	if c.Sinais["risco_moto"] != 1 || len(c.Sinais) != 1 {
		t.Fatalf("sinais deveriam ser limitados a 0..1 e a nomes seguros: %v", c.Sinais)
	}
}

// RF08: relatos repetidos reforçam a tendência e podem subir o nível.
func TestRelatosRepetidosSobemATendencia(t *testing.T) {
	s := servicoReal()
	r := s.Triar(context.Background(), Entrada{Categoria: "iluminacao", Texto: "poste apagado"})
	if *r.Nivel != 3 {
		t.Fatalf("poste apagado começa no nível 3, veio %d", *r.Nivel)
	}
	antes := r.Registro.GUTEsperada
	reg, nivel, err := s.Reavaliar(context.Background(), r.Registro, 4)
	if err != nil {
		t.Fatal(err)
	}
	if reg.GUTEsperada <= antes || reg.Relatos != 4 {
		t.Fatalf("GUT esperada deveria subir com 4 relatos: %.1f para %.1f", antes, reg.GUTEsperada)
	}
	if nivel < 3 {
		t.Fatalf("o nível nunca desce por relato repetido, veio %d", nivel)
	}
	// A classificação original não muda: a tendência reforçada é recalculada do zero a cada relato.
	if reg.Classificacao.T != r.Registro.Classificacao.T {
		t.Fatal("Reavaliar não pode acumular o reforço na distribuição guardada")
	}
	if d := (Distribuicao{1, 0, 0, 0, 0}).Reforcada(50); d[4] < 0.99 {
		t.Fatalf("muitos relatos levam a tendência ao topo: %v", d)
	}
}

// C6: nenhum dado pessoal no payload que sai para a IA.
func TestSemDadosPessoais(t *testing.T) {
	entrada := "Buraco em frente a casa, falar com Maria no (35) 99876-5432 ou maria@exemplo.com, CPF 123.456.789-09, carro ABC1D23 caiu nele"
	limpo := SemDadosPessoais(entrada)
	for _, proibido := range []string{"99876", "maria@", "123.456", "ABC1D23"} {
		if strings.Contains(limpo, proibido) {
			t.Errorf("sobrou dado pessoal %q em: %s", proibido, limpo)
		}
	}
	if !strings.Contains(limpo, "Buraco em frente a casa") {
		t.Errorf("o relato em si precisa sobreviver: %s", limpo)
	}
	if r := montarRelato(Entrada{Texto: limpo, Bairro: "Centro"}, true); strings.Contains(r, "99876") || !strings.Contains(r, "<relato_do_morador>") {
		t.Errorf("payload da IA: %s", r)
	}
}

func TestCategoriaPelaFala(t *testing.T) {
	casos := map[string]string{
		"tem um buraco enorme na minha rua":   "vias",
		"o poste está apagado faz uma semana": "iluminacao",
		"cano estourado jorrando água":        "agua",
		"árvore caiu na via":                  "arvores",
		"bom dia":                             "",
	}
	for fala, quer := range casos {
		if got := CategoriaPorTexto(fala); got != quer {
			t.Errorf("%q: categoria %q, queria %q", fala, got, quer)
		}
	}
}

func TestEsquemaDaIACobreCategoriasESinais(t *testing.T) {
	e := esquemaDeSaida()
	props := e["properties"].(map[string]any)
	if len(props["categoria"].(map[string]any)["enum"].([]string)) != len(Categorias()) {
		t.Fatal("o esquema precisa listar todas as categorias")
	}
	sinais := strings.Join(todosOsSinais(), ",")
	for _, s := range []string{"agua_jorrando", "fio_exposto", "via_bloqueada", "risco_moto"} {
		if !strings.Contains(sinais, s) {
			t.Errorf("sinal crítico %s fora do esquema", s)
		}
	}
	if _, ok := props["local_publico"]; !ok || !strings.Contains(instrucoesDoSistema(), "local_publico") {
		t.Error("o esquema e as instruções precisam pedir local_publico")
	}
	if !strings.Contains(instrucoesDoSistema(), "- agua: agua_jorrando, alagamento, perto_de_escola") {
		t.Error("as instruções precisam listar os sinais por categoria")
	}
}

// T7: a simulação mostra o efeito de um limiar antes de salvar e recusa script quebrado.
func TestSimularRegraAntesDeSalvar(t *testing.T) {
	m := MotorLua{Dir: "../../regras", Cidade: "itamogi"}
	sim, err := m.Simular(context.Background(), "agua.lua", "function avaliar(t) return avaliar_padrao(t, {}) end")
	if err != nil || len(sim) != 2 {
		t.Fatalf("esperados os 2 cenários de água, vieram %d (%v)", len(sim), err)
	}
	if sim[0].Nivel != 4 {
		t.Fatalf("sem o sinal crítico o cano estourado cai para a faixa da GUT (4), veio %d", sim[0].Nivel)
	}
	sim, _ = m.Simular(context.Background(), "_comum.lua", "function avaliar_padrao() error('quebrei') end")
	if len(sim) != len(Cenarios()) || sim[0].Erro == "" {
		t.Fatalf("regra comum quebrada deveria falhar em todos os cenários: %+v", sim[0])
	}
}
