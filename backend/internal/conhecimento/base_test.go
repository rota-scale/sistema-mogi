package conhecimento

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

func TestBaseCobreTodasAsCategorias(t *testing.T) {
	b, err := Carregar()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range triagem.Categorias() {
		l := b.Buscar("", c, 4)
		if len(l) < 3 {
			t.Errorf("%s: %d trechos, quero ao menos 3", c, len(l))
		}
		if len(l) > 0 && l[0].Titulo != "Quando é grave" {
			t.Errorf("%s: primeiro trecho %q", c, l[0].Titulo)
		}
	}
}

func TestBuscaAchaOTrechoCerto(t *testing.T) {
	b, _ := Carregar()
	casos := []struct{ consulta, categoria, quer string }{
		{"fio caído soltando faísca na calçada", "", "iluminacao"},
		{"cano estourado jorrando água", "", "agua"},
		{"buraco enorme na avenida, moto caiu", "", "vias"},
		{"semáforo apagado no cruzamento", "", "sinalizacao"},
		{"árvore tombou em cima dos fios", "", "arvores"},
		{"cavalo solto na pista", "", "animais"},
		// A categoria desempata: "poste" só aparece em iluminação, mas a
		// pessoa escolheu vias.
		{"buraco", "vias", "vias"},
	}
	for _, c := range casos {
		l := b.Buscar(c.consulta, c.categoria, 2)
		if len(l) == 0 || l[0].Categoria != c.quer {
			got := ""
			if len(l) > 0 {
				got = l[0].Categoria + "/" + l[0].Titulo
			}
			t.Errorf("%q: quero %s, veio %s", c.consulta, c.quer, got)
		}
	}
}

func TestTermosSemAcentoEPlural(t *testing.T) {
	a, b := termos("Postes caídos"), termos("poste caido")
	if strings.Join(a, " ") != strings.Join(b, " ") {
		t.Fatalf("%v != %v", a, b)
	}
	if len(termos("de na com que")) != 0 {
		t.Fatal("palavras vazias deveriam sair")
	}
}

func TestAgenteSemBancoUsaSoABase(t *testing.T) {
	b, _ := Carregar()
	a := &Agente{Base: b}
	cx, err := a.Contextualizar(context.Background(), triagem.Entrada{Texto: "fio caído na rua", Categoria: "iluminacao"})
	if err != nil || len(cx.Orientacoes) == 0 || cx.Orientacoes[0].Categoria != "iluminacao" {
		t.Fatalf("contexto %+v, erro %v", cx, err)
	}
	if len(cx.Casos) != 0 {
		t.Fatal("sem banco não há casos")
	}
	saida, err := a.Executar(context.Background(), "consultar_orientacao", map[string]any{"categoria": "agua", "pergunta": "esgoto perto de escola"}, triagem.Entrada{})
	if err != nil {
		t.Fatal(err)
	}
	var r struct{ Orientacoes []triagem.Orientacao }
	if err := json.Unmarshal([]byte(saida), &r); err != nil || len(r.Orientacoes) == 0 || r.Orientacoes[0].Categoria != "agua" {
		t.Fatalf("saída %s", saida)
	}
	if _, err := a.Executar(context.Background(), "apagar_tudo", nil, triagem.Entrada{}); err == nil {
		t.Fatal("ferramenta desconhecida deveria falhar")
	}
	// Sem ponto, a ferramenta de perto responde vazio em vez de falhar.
	if s, err := a.Executar(context.Background(), "chamados_abertos_perto", nil, triagem.Entrada{}); err != nil || !strings.Contains(s, "chamados") {
		t.Fatalf("perto sem ponto: %s %v", s, err)
	}
}

func TestBaseDizOQueAPrefeituraAtende(t *testing.T) {
	b, _ := Carregar()
	l := b.Buscar("foto do quintal, dentro de casa, imóvel particular", "", 1)
	if len(l) == 0 || l[0].Categoria != "outros" || l[0].Titulo != "O que a prefeitura atende" {
		t.Fatalf("veio %+v", l)
	}
}
