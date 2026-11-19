package ocorrencias

import (
	"errors"
	"testing"
)

func TestDemoNuncaLevaDadoDeMorador(t *testing.T) {
	casos := []struct {
		nome string
		n    Nova
		erro bool
	}{
		{"relato real com cadastro e aparelho", Nova{MoradorID: "a", Aparelho: "b", IDCliente: "c"}, false},
		{"relato real sem cadastro (módulo desligado)", Nova{}, false},
		{"semente da demo", Nova{Demo: true}, false},
		{"demo com cadastro", Nova{Demo: true, MoradorID: "a"}, true},
		{"demo com aparelho", Nova{Demo: true, Aparelho: "b"}, true},
		{"demo com chave de idempotência", Nova{Demo: true, IDCliente: "c"}, true},
	}
	for _, c := range casos {
		err := conferirOrigem(c.n)
		if (err != nil) != c.erro || (err != nil && !errors.Is(err, ErrOrigemMisturada)) {
			t.Errorf("%s: erro = %v, esperado erro = %v", c.nome, err, c.erro)
		}
	}
}

func TestFiltroDemoDaLista(t *testing.T) {
	casos := map[string]FiltroDemo{
		"incluir": DemoIncluir, "OCULTAR": DemoOcultar, " so ": DemoSo,
		"": DemoOcultar, "1; DROP TABLE ocorrencias": DemoOcultar,
	}
	for entrada, esperado := range casos {
		if got := LerFiltroDemo(entrada, DemoOcultar); got != esperado {
			t.Errorf("LerFiltroDemo(%q) = %q, esperado %q", entrada, got, esperado)
		}
	}
	if DemoIncluir.clausula() != "" || DemoOcultar.clausula() != " AND NOT demo" || DemoSo.clausula() != " AND demo" {
		t.Fatal("cláusula do filtro mudou")
	}
	if FiltroDemo("x").clausula() != "" {
		t.Fatal("valor fora da lista não pode entrar no SQL")
	}
}

func TestPadraoDaListaSegueDemoChamados(t *testing.T) {
	if (&Handlers{OcultarDemo: true}).filtroDemoPadrao() != DemoOcultar {
		t.Fatal("com DEMO_CHAMADOS=0 a central abre só com relatos reais")
	}
	if (&Handlers{}).filtroDemoPadrao() != DemoIncluir {
		t.Fatal("com demo ligada a lista traz os simulados")
	}
}
