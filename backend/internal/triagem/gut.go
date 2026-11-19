package triagem

import "sort"

// GUT resume as distribuições: a esperada ordena a fila e a pessimista (p90)
// define o nível sob incerteza (ADR 0010).
type GUT struct {
	Esperada   float64 `json:"esperada"`
	Pessimista float64 `json:"p90"`
	G          float64 `json:"g"`
	U          float64 `json:"u"`
	T          float64 `json:"t"`
}

// CalcularGUT supõe G, U e T independentes, como no exemplo do cano
// estourado em docs/inovacao-e-diferenciais.md.
func CalcularGUT(g, u, t Distribuicao) GUT {
	r := GUT{G: g.Esperado(), U: u.Esperado(), T: t.Esperado()}
	r.Esperada = r.G * r.U * r.T
	r.Pessimista = percentilProduto(g, u, t, 0.9)
	return r
}

func percentilProduto(g, u, t Distribuicao, q float64) float64 {
	type ponto struct{ valor, prob float64 }
	pontos := make([]ponto, 0, 125)
	total := 0.0
	for i, pg := range g {
		for j, pu := range u {
			for k, pt := range t {
				p := pg * pu * pt
				if p == 0 {
					continue
				}
				pontos = append(pontos, ponto{float64((i + 1) * (j + 1) * (k + 1)), p})
				total += p
			}
		}
	}
	if total == 0 {
		return 0
	}
	sort.Slice(pontos, func(a, b int) bool { return pontos[a].valor < pontos[b].valor })
	acumulada := 0.0
	for _, pt := range pontos {
		acumulada += pt.prob / total
		if acumulada >= q-1e-9 {
			return pt.valor
		}
	}
	return pontos[len(pontos)-1].valor
}
