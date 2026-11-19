// Package geo converte GPS em endereço e bairro (RF02) atrás da porta
// Geocodificador. O adaptador Nominatim respeita a política de uso do
// servidor público (1 requisição por segundo, agente identificado) e guarda
// cada resposta no cache do banco.
package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Endereco struct {
	Endereco string
	Bairro   string
	Cidade   string
	UF       string
}

type Geocodificador interface {
	Reverso(ctx context.Context, lat, lng float64) (Endereco, error)
}

// Desligado é usado quando NOMINATIM_URL está vazio.
type Desligado struct{}

func (Desligado) Reverso(context.Context, float64, float64) (Endereco, error) {
	return Endereco{}, nil
}

type Nominatim struct {
	base   string
	agente string
	pool   *pgxpool.Pool
	cli    *http.Client

	mu     sync.Mutex
	ultima time.Time
}

func NovoNominatim(base, agente string, pool *pgxpool.Pool) *Nominatim {
	return &Nominatim{base: base, agente: agente, pool: pool, cli: &http.Client{Timeout: 4 * time.Second}}
}

func (n *Nominatim) Reverso(ctx context.Context, lat, lng float64) (Endereco, error) {
	chave := fmt.Sprintf("%.4f,%.4f", lat, lng)
	var e Endereco
	var end, bai, cid, uf *string
	err := n.pool.QueryRow(ctx, `SELECT endereco, bairro, cidade, uf FROM geocache WHERE chave = $1`, chave).Scan(&end, &bai, &cid, &uf)
	// Cache anterior à v0.3.1 não tem a cidade: consulta de novo e completa.
	if err == nil && cid != nil {
		e.Endereco, e.Bairro, e.Cidade, e.UF = texto(end), texto(bai), *cid, texto(uf)
		return e, nil
	}

	e, err = n.consultar(ctx, lat, lng)
	if err != nil {
		return Endereco{}, err
	}
	_, _ = n.pool.Exec(ctx, `INSERT INTO geocache (chave, endereco, bairro, cidade, uf)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))
		ON CONFLICT (chave) DO UPDATE SET endereco = EXCLUDED.endereco, bairro = EXCLUDED.bairro,
			cidade = EXCLUDED.cidade, uf = EXCLUDED.uf`, chave, e.Endereco, e.Bairro, e.Cidade, e.UF)
	return e, nil
}

func texto(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (n *Nominatim) consultar(ctx context.Context, lat, lng float64) (Endereco, error) {
	n.mu.Lock()
	if espera := time.Second - time.Since(n.ultima); espera > 0 {
		time.Sleep(espera)
	}
	n.ultima = time.Now()
	n.mu.Unlock()

	q := url.Values{
		"format":          {"jsonv2"},
		"lat":             {fmt.Sprintf("%f", lat)},
		"lon":             {fmt.Sprintf("%f", lng)},
		"zoom":            {"18"},
		"addressdetails":  {"1"},
		"accept-language": {"pt-BR"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, n.base+"/reverse?"+q.Encode(), nil)
	if err != nil {
		return Endereco{}, err
	}
	req.Header.Set("User-Agent", n.agente)
	resp, err := n.cli.Do(req)
	if err != nil {
		return Endereco{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Endereco{}, fmt.Errorf("nominatim respondeu %d", resp.StatusCode)
	}
	var r struct {
		DisplayName string            `json:"display_name"`
		Address     map[string]string `json:"address"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return Endereco{}, err
	}
	return montar(r.DisplayName, r.Address), nil
}

func montar(exibicao string, a map[string]string) Endereco {
	primeiro := func(chaves ...string) string {
		for _, k := range chaves {
			if v := a[k]; v != "" {
				return v
			}
		}
		return ""
	}
	rua := primeiro("road", "pedestrian", "footway", "path")
	if rua != "" {
		if n := a["house_number"]; n != "" {
			rua += ", " + n
		}
	}
	cidade := primeiro("town", "city", "village", "municipality")
	partes := []string{}
	for _, p := range []string{rua, cidade} {
		if p != "" {
			partes = append(partes, p)
		}
	}
	end := strings.Join(partes, ", ")
	if end == "" {
		end = exibicao
	}
	// "ISO3166-2-lvl4" vem como "BR-MG": o estado é o que vem depois do traço.
	uf := ""
	if iso := a["ISO3166-2-lvl4"]; strings.HasPrefix(iso, "BR-") {
		uf = strings.TrimPrefix(iso, "BR-")
	}
	return Endereco{
		Endereco: end,
		Bairro:   primeiro("suburb", "neighbourhood", "quarter", "city_district", "hamlet"),
		Cidade:   cidade,
		UF:       uf,
	}
}
