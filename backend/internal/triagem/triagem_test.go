package triagem

import (
	"context"
	"errors"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestGUTDoExemploDoCanoEstourado(t *testing.T) {
	// docs/inovacao-e-diferenciais.md: esperada 90, p90 igual a 125.
	g := CalcularGUT(Distribuicao{0, 0, 0, .2, .8}, Distribuicao{0, 0, 0, .3, .7}, Distribuicao{0, 0, .2, .6, .2})
	if math.Abs(g.Esperada-90.24) > 0.01 {
		t.Fatalf("GUT esperada %.2f, queria 90,24", g.Esperada)
	}
	if g.Pessimista != 125 {
		t.Fatalf("GUT p90 %.0f, queria 125", g.Pessimista)
	}
}

func servicoReal() *Servico {
	return &Servico{
		Classificadores: []Classificador{ClassificadorLocal{}},
		Motor:           MotorLua{Dir: "../../regras", Cidade: "itamogi"},
		Agora:           func() time.Time { return time.Date(2026, 11, 2, 10, 0, 0, 0, time.UTC) },
	}
}

// Roteiro do teste de campo (docs/teste-de-campo-itamogi.md, na SPEC v2).
func TestRoteiroDoTesteDeCampo(t *testing.T) {
	casos := []struct {
		nome    string
		entrada Entrada
		niveis  []int16
		status  string
	}{
		{"cano estourado jorrando", Entrada{Categoria: "agua", Texto: "Cano estourado jorrando água"}, []int16{5}, "revisao"},
		{"buraco em via", Entrada{Categoria: "vias", Texto: "buraco na rua"}, []int16{3, 4}, ""},
		{"buraco grande", Entrada{Categoria: "vias", Texto: "buraco grande perto da curva"}, []int16{4}, "revisao"},
		{"poste apagado", Entrada{Categoria: "iluminacao", Texto: "poste apagado"}, []int16{3}, "aberta"},
		{"lixo na calçada", Entrada{Categoria: "limpeza", Texto: "lixo parado"}, []int16{1, 2}, "aberta"},
		{"categoria desconhecida vai para revisão", Entrada{Categoria: "xyz"}, nil, "revisao"},
	}
	s := servicoReal()
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			r := s.Triar(context.Background(), c.entrada)
			if r.Nivel == nil {
				t.Fatalf("sem nível: %+v", r.Registro)
			}
			if c.niveis != nil && !contem(c.niveis, *r.Nivel) {
				t.Fatalf("nível %d, esperado um de %v (motivo: %s)", *r.Nivel, c.niveis, r.Registro.Motivo)
			}
			if c.status != "" && r.Status != c.status {
				t.Fatalf("status %s, esperado %s", r.Status, c.status)
			}
			if *r.Nivel >= 4 && r.Status != "revisao" {
				t.Fatalf("nível %d precisa de revisão humana", *r.Nivel)
			}
		})
	}
}

func contem(l []int16, v int16) bool {
	for _, x := range l {
		if x == v {
			return true
		}
	}
	return false
}

type classificadorQuebrado struct{}

func (classificadorQuebrado) Classificar(context.Context, Entrada) (Classificacao, error) {
	return Classificacao{}, errors.New("fora do ar")
}

func TestFallbackQuandoClassificadorFalha(t *testing.T) {
	s := servicoReal()
	s.Classificadores = []Classificador{classificadorQuebrado{}}
	r := s.Triar(context.Background(), Entrada{Categoria: "agua"})
	if r.Status != "a_classificar" || r.Nivel != nil {
		t.Fatalf("esperado a_classificar sem nível, veio %s %v", r.Status, r.Nivel)
	}
	// Com um reserva na cadeia, o chamado segue classificado (RF12).
	s.Classificadores = []Classificador{classificadorQuebrado{}, ClassificadorLocal{}}
	if r := s.Triar(context.Background(), Entrada{Categoria: "agua"}); r.Nivel == nil {
		t.Fatal("o reserva deveria classificar")
	}
}

func TestLimiarAlteradoValeNoProximoChamado(t *testing.T) {
	dir := t.TempDir()
	cidade := filepath.Join(dir, "teste")
	if err := os.MkdirAll(cidade, 0o755); err != nil {
		t.Fatal(err)
	}
	comum, _ := os.ReadFile("../../regras/itamogi/_comum.lua")
	escrever := func(nome, conteudo string) {
		if err := os.WriteFile(filepath.Join(cidade, nome), []byte(conteudo), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	escrever("_comum.lua", string(comum))
	escrever("padrao.lua", "function avaliar(t) return avaliar_padrao(t, {}) end")
	s := servicoReal()
	s.Motor = MotorLua{Dir: dir, Cidade: "teste"}
	e := Entrada{Categoria: "iluminacao", Texto: "poste apagado"} // GUT 36,75: nível 3
	if n := *s.Triar(context.Background(), e).Nivel; n != 3 {
		t.Fatalf("antes: nível %d, queria 3", n)
	}
	escrever("_comum.lua", strings.Replace(string(comum), "minimo = 28,  nivel = 3", "minimo = 40,  nivel = 3", 1))
	if n := *s.Triar(context.Background(), e).Nivel; n != 2 {
		t.Fatalf("depois de subir o limiar: nível %d, queria 2", n)
	}
}

func TestSandboxCortaLaçoInfinito(t *testing.T) {
	inicio := time.Now()
	_, err := ExecutarRegra(context.Background(), "function avaliar(t) while true do end end", map[string]any{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("esperado estouro de tempo, veio %v", err)
	}
	if d := time.Since(inicio); d > 500*time.Millisecond {
		t.Fatalf("demorou %v para cortar", d)
	}
}

func TestSandboxSemBibliotecasPerigosas(t *testing.T) {
	for _, codigo := range []string{
		`os.exit(1)`, `io.open("/etc/passwd")`, `require("os")`, `dofile("/etc/passwd")`,
		`load("return 1")()`, `debug.getinfo(1)`, `string.rep("a", 1e9)`,
	} {
		_, err := ExecutarRegra(context.Background(), codigo+"\nfunction avaliar(t) return {nivel=1} end", map[string]any{})
		if err == nil {
			t.Errorf("o sandbox deixou passar: %s", codigo)
		}
	}
}

func TestRegraComNivelInvalido(t *testing.T) {
	_, err := ExecutarRegra(context.Background(), "function avaliar(t) return {nivel=7} end", map[string]any{})
	if err == nil {
		t.Fatal("nível 7 deveria ser recusado")
	}
}

// classificadorDoLocal devolve sempre a mesma decisão, com local_publico dado.
type classificadorDoLocal struct{ localPublico *float64 }

func (c classificadorDoLocal) Classificar(context.Context, Entrada) (Classificacao, error) {
	return Classificacao{
		Categoria: "iluminacao", Confianca: 0.9, Provedor: "fixo",
		G: Distribuicao{0, 0, 1, 0, 0}, U: Distribuicao{0, 0, 1, 0, 0}, T: Distribuicao{0, 1, 0, 0, 0},
		LocalPublico: c.localPublico,
	}, nil
}

// Foto de dentro de casa vai para a conferência, com o motivo e a marca de
// fora do escopo; espaço público ou pergunta sem resposta seguem a regra.
func TestLocalPrivadoVaiParaRevisao(t *testing.T) {
	p := func(v float64) *float64 { return &v }
	casos := []struct {
		nome   string
		lp     *float64
		fora   bool
		status string
	}{
		{"dentro de casa", p(0.1), true, "revisao"},
		{"rua", p(0.95), false, "aberta"},
		{"dúvida segue a regra", p(0.5), false, "aberta"},
		{"classificador sem a pergunta", nil, false, "aberta"},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			s := servicoReal()
			s.Classificadores = []Classificador{classificadorDoLocal{c.lp}}
			r := s.Triar(context.Background(), Entrada{Categoria: "iluminacao", Texto: "poste apagado"})
			if r.ForaDoEscopo != c.fora || r.Registro.ForaDoEscopo != c.fora || r.Status != c.status {
				t.Fatalf("fora %v, status %s (motivo: %s)", r.ForaDoEscopo, r.Status, r.Registro.Motivo)
			}
			if c.fora != strings.Contains(r.Registro.Motivo, "parece local privado") {
				t.Fatalf("motivo: %s", r.Registro.Motivo)
			}
		})
	}
}
