package geo

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSoDigitosCep(t *testing.T) {
	for _, c := range []struct {
		entrada, saida string
		ok             bool
	}{
		{"37530-000", "37530000", true},
		{"37.530-000", "37530000", true},
		{"3753000", "", false},
		{"00000-000", "", false},
		{"3753a000", "", false},
	} {
		got, err := SoDigitosCep(c.entrada)
		if (err == nil) != c.ok || got != c.saida {
			t.Errorf("%q: %q, %v", c.entrada, got, err)
		}
	}
}

func TestViaCep(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/37530000/json/":
			_, _ = w.Write([]byte(`{"cep":"37530-000","localidade":"Itamogi","uf":"MG","bairro":"","ibge":"3132909"}`))
		case "/99999999/json/":
			_, _ = w.Write([]byte(`{"erro": "true"}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()
	v := NovoViaCep(srv.URL+"/", nil)
	c, err := v.Buscar(context.Background(), "37530-000")
	if err != nil || c.Cidade != "Itamogi" || c.UF != "MG" || c.IBGE != "3132909" || c.Cep != "37530000" {
		t.Fatalf("Itamogi: %+v, %v", c, err)
	}
	if _, err := v.Buscar(context.Background(), "99999-999"); !errors.Is(err, ErrCepNaoEncontrado) {
		t.Fatalf("inexistente devia dar não encontrado: %v", err)
	}
	if _, err := v.Buscar(context.Background(), "123"); !errors.Is(err, ErrCepInvalido) {
		t.Fatalf("curto devia dar inválido: %v", err)
	}
	if _, err := v.Buscar(context.Background(), "11111-111"); err == nil || errors.Is(err, ErrCepNaoEncontrado) {
		t.Fatalf("erro do servidor devia virar erro de rede: %v", err)
	}
}

func TestMontarDevolveCidadeEUF(t *testing.T) {
	e := montar("x", map[string]string{"road": "Rua A", "suburb": "Centro", "town": "Itamogi", "ISO3166-2-lvl4": "BR-MG"})
	if e.Cidade != "Itamogi" || e.UF != "MG" || e.Bairro != "Centro" {
		t.Fatalf("%+v", e)
	}
}
