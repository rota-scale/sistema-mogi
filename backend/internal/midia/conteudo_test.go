package midia

import (
	"context"
	"errors"
	"os"
	"testing"
)

// cenaFalsa devolve a categoria combinada, sem chamar IA.
type cenaFalsa struct {
	resposta string
	erro     error
	chamadas int
}

func (c *cenaFalsa) Cena(_ context.Context, _ []byte) (string, error) {
	c.chamadas++
	return c.resposta, c.erro
}

func fotoDeTeste(t *testing.T) []byte {
	t.Helper()
	dados, err := os.ReadFile("../../../scripts/fixtures/foto-teste.jpg")
	if err != nil {
		t.Fatalf("fixture: %v", err)
	}
	return dados
}

func TestConteudoRecusaInteriorPessoalEIntimo(t *testing.T) {
	foto := fotoDeTeste(t)
	for _, cena := range []string{"interior", "pessoal", "intimo", "qualquer coisa"} {
		c := &cenaFalsa{resposta: cena}
		v, err := Conteudo{Cena: c}.Verificar(context.Background(), foto, foto)
		if err != nil {
			t.Fatalf("%s: erro inesperado: %v", cena, err)
		}
		if v.Aceita {
			t.Fatalf("%s: foto devia ser recusada", cena)
		}
	}
}

func TestConteudoAceitaSoLugarPublico(t *testing.T) {
	foto := fotoDeTeste(t)
	c := &cenaFalsa{resposta: "publico"}
	v, err := Conteudo{Cena: c}.Verificar(context.Background(), foto, foto)
	if err != nil || !v.Aceita {
		t.Fatalf("lugar público devia ser aceito: %+v, %v", v, err)
	}
}

func TestConteudoErroDaIANaoAceitaEmSilencio(t *testing.T) {
	foto := fotoDeTeste(t)
	c := &cenaFalsa{erro: errors.New("fora do ar")}
	v, err := Conteudo{Cena: c}.Verificar(context.Background(), foto, foto)
	if err == nil || v.Aceita {
		t.Fatalf("erro da IA devia impedir a aceitação: %+v, %v", v, err)
	}
}

func TestConteudoSemIASoRegraLocal(t *testing.T) {
	foto := fotoDeTeste(t)
	v, err := Conteudo{}.Verificar(context.Background(), foto, foto)
	if err != nil || !v.Aceita {
		t.Fatalf("sem IA e sem rosto em destaque, a regra local aceita: %+v, %v", v, err)
	}
}
