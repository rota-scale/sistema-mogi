package geo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Cep é o que o cadastro precisa de um CEP: a cidade, o estado e o bairro.
type Cep struct {
	Cep    string `json:"cep"`
	Cidade string `json:"cidade"`
	UF     string `json:"uf"`
	Bairro string `json:"bairro"`
	IBGE   string `json:"ibge"`
}

var (
	ErrCepInvalido      = errors.New("cep inválido")
	ErrCepNaoEncontrado = errors.New("cep não encontrado")
)

type BuscaCep interface {
	Buscar(ctx context.Context, cep string) (Cep, error)
}

// SoDigitosCep devolve os 8 dígitos do CEP ou ErrCepInvalido.
func SoDigitosCep(bruto string) (string, error) {
	var b strings.Builder
	for _, r := range bruto {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if r != '-' && r != '.' && r != ' ' {
			return "", ErrCepInvalido
		}
	}
	if b.Len() != 8 || b.String() == "00000000" {
		return "", ErrCepInvalido
	}
	return b.String(), nil
}

// CepDesligado é usado quando CEP_URL está vazio: nenhum CEP é achado.
type CepDesligado struct{}

func (CepDesligado) Buscar(context.Context, string) (Cep, error) { return Cep{}, ErrCepNaoEncontrado }

// ViaCep consulta o ViaCEP (viacep.com.br) e guarda a resposta em cepcache.
// Sem pool (testes), consulta sempre.
type ViaCep struct {
	base string
	pool *pgxpool.Pool
	cli  *http.Client
}

func NovoViaCep(base string, pool *pgxpool.Pool) *ViaCep {
	return &ViaCep{base: strings.TrimRight(base, "/"), pool: pool, cli: &http.Client{Timeout: 5 * time.Second}}
}

func (v *ViaCep) Buscar(ctx context.Context, bruto string) (Cep, error) {
	cep, err := SoDigitosCep(bruto)
	if err != nil {
		return Cep{}, err
	}
	c := Cep{Cep: cep}
	if v.pool != nil {
		var bairro, ibge *string
		err = v.pool.QueryRow(ctx, `SELECT cidade, uf, bairro, ibge FROM cepcache WHERE cep = $1`, cep).Scan(&c.Cidade, &c.UF, &bairro, &ibge)
		if err == nil {
			c.Bairro, c.IBGE = texto(bairro), texto(ibge)
			return c, nil
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/%s/json/", v.base, cep), nil)
	if err != nil {
		return Cep{}, err
	}
	resp, err := v.cli.Do(req)
	if err != nil {
		return Cep{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusNotFound {
		return Cep{}, ErrCepNaoEncontrado
	}
	if resp.StatusCode != http.StatusOK {
		return Cep{}, fmt.Errorf("viacep respondeu %d", resp.StatusCode)
	}
	var r struct {
		Localidade string `json:"localidade"`
		UF         string `json:"uf"`
		Bairro     string `json:"bairro"`
		IBGE       string `json:"ibge"`
		Erro       any    `json:"erro"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return Cep{}, err
	}
	// O ViaCEP responde 200 com {"erro": true} (ou "true") para CEP que não existe.
	if r.Erro != nil || r.Localidade == "" {
		return Cep{}, ErrCepNaoEncontrado
	}
	c.Cidade, c.UF, c.Bairro, c.IBGE = r.Localidade, r.UF, r.Bairro, r.IBGE
	if v.pool == nil {
		return c, nil
	}
	_, _ = v.pool.Exec(ctx, `INSERT INTO cepcache (cep, cidade, uf, bairro, ibge) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
		ON CONFLICT (cep) DO NOTHING`, c.Cep, c.Cidade, c.UF, c.Bairro, c.IBGE)
	return c, nil
}
