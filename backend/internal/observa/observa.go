// Package observa é a observabilidade mínima do MOGI (ADR 0019): contadores
// e tempos por rota guardados na memória do processo, sem serviço externo.
// Serve para o gestor ver na aba Operação se o teste de campo está saudável.
// Os números zeram quando o servidor reinicia; o que precisa durar (triagem,
// telemetria dos aparelhos) fica no banco.
package observa

import (
	"sort"
	"sync"
	"time"
)

// faixasMS são os limites do histograma de tempo de resposta.
var faixasMS = []int64{50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000}

const (
	errosGuardados = 50
	// minutosGuardados é a janela do gráfico de pedidos por minuto.
	minutosGuardados = 60
)

type rota struct {
	pedidos  int64
	porFaixa []int64 // um contador por faixa, mais um para o que passou da última
	somaMS   int64
	status   map[int]int64
}

// Falha é um pedido que terminou em erro do servidor ou em recusa.
type Falha struct {
	Quando time.Time `json:"quando"`
	Metodo string    `json:"metodo"`
	Rota   string    `json:"rota"`
	Status int       `json:"status"`
	MS     int64     `json:"ms"`
	ID     string    `json:"id"`
}

// Metricas acumula o que passou pelo servidor desde que subiu.
type Metricas struct {
	mu      sync.Mutex
	inicio  time.Time
	rotas   map[string]*rota
	falhas  []Falha
	minutos map[int64]*minuto
	agora   func() time.Time
}

type minuto struct{ pedidos, erros5xx, recusas4xx int64 }

func Novas() *Metricas {
	return &Metricas{inicio: time.Now(), rotas: map[string]*rota{}, minutos: map[int64]*minuto{}, agora: time.Now}
}

// Registrar conta um pedido atendido. A rota é o padrão do roteador (por
// exemplo "POST /ocorrencias/{id}/despacho"), nunca o caminho com o id.
func (m *Metricas) Registrar(metodo, padrao string, status int, duracao time.Duration, id string) {
	if padrao == "" {
		padrao = metodo + " (outras)"
	}
	ms := duracao.Milliseconds()
	agora := m.agora()
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.rotas[padrao]
	if r == nil {
		r = &rota{porFaixa: make([]int64, len(faixasMS)+1), status: map[int]int64{}}
		m.rotas[padrao] = r
	}
	r.pedidos++
	r.somaMS += ms
	r.status[status]++
	r.porFaixa[sort.Search(len(faixasMS), func(i int) bool { return ms <= faixasMS[i] })]++

	chave := agora.Unix() / 60
	mi := m.minutos[chave]
	if mi == nil {
		mi = &minuto{}
		m.minutos[chave] = mi
		for k := range m.minutos {
			if k < chave-minutosGuardados {
				delete(m.minutos, k)
			}
		}
	}
	mi.pedidos++
	switch {
	case status >= 500:
		mi.erros5xx++
	case status >= 400 && status != 401 && status != 404:
		mi.recusas4xx++
	}
	// 401 e 404 são rotina (sessão vencida, link antigo); o resto interessa.
	if status >= 500 || status == 429 || status == 413 || status == 415 || status == 422 {
		m.falhas = append(m.falhas, Falha{agora, metodo, padrao, status, ms, id})
		if len(m.falhas) > errosGuardados {
			m.falhas = m.falhas[len(m.falhas)-errosGuardados:]
		}
	}
}

// ResumoRota é a linha de uma rota na aba Operação.
type ResumoRota struct {
	Rota     string `json:"rota"`
	Pedidos  int64  `json:"pedidos"`
	MediaMS  int64  `json:"media_ms"`
	P95MS    int64  `json:"p95_ms"`
	Erros5xx int64  `json:"erros_5xx"`
	Recusas  int64  `json:"recusas_4xx"`
}

// PontoNoTempo é um minuto do gráfico de pedidos.
type PontoNoTempo struct {
	Minuto   time.Time `json:"minuto"`
	Pedidos  int64     `json:"pedidos"`
	Erros5xx int64     `json:"erros_5xx"`
	Recusas  int64     `json:"recusas_4xx"`
}

// Resumo é a fotografia das métricas em memória.
type Resumo struct {
	NoArDesde time.Time      `json:"no_ar_desde"`
	Pedidos   int64          `json:"pedidos"`
	Erros5xx  int64          `json:"erros_5xx"`
	Recusas   int64          `json:"recusas_4xx"`
	Rotas     []ResumoRota   `json:"rotas"`
	PorMinuto []PontoNoTempo `json:"por_minuto"`
	Falhas    []Falha        `json:"falhas"`
}

// Resumir devolve a fotografia atual, com as rotas mais pedidas primeiro.
func (m *Metricas) Resumir() Resumo {
	agora := m.agora()
	m.mu.Lock()
	defer m.mu.Unlock()
	res := Resumo{NoArDesde: m.inicio, Rotas: []ResumoRota{}, PorMinuto: []PontoNoTempo{}, Falhas: []Falha{}}
	for nome, r := range m.rotas {
		linha := ResumoRota{Rota: nome, Pedidos: r.pedidos, P95MS: percentil(r.porFaixa, 0.95)}
		if r.pedidos > 0 {
			linha.MediaMS = r.somaMS / r.pedidos
		}
		for status, n := range r.status {
			switch {
			case status >= 500:
				linha.Erros5xx += n
			case status >= 400 && status != 401 && status != 404:
				linha.Recusas += n
			}
		}
		res.Pedidos += linha.Pedidos
		res.Erros5xx += linha.Erros5xx
		res.Recusas += linha.Recusas
		res.Rotas = append(res.Rotas, linha)
	}
	sort.Slice(res.Rotas, func(i, j int) bool {
		if res.Rotas[i].Pedidos != res.Rotas[j].Pedidos {
			return res.Rotas[i].Pedidos > res.Rotas[j].Pedidos
		}
		return res.Rotas[i].Rota < res.Rotas[j].Rota
	})
	atual := agora.Unix() / 60
	for k := atual - minutosGuardados + 1; k <= atual; k++ {
		p := PontoNoTempo{Minuto: time.Unix(k*60, 0).UTC()}
		if mi := m.minutos[k]; mi != nil {
			p.Pedidos, p.Erros5xx, p.Recusas = mi.pedidos, mi.erros5xx, mi.recusas4xx
		}
		res.PorMinuto = append(res.PorMinuto, p)
	}
	for i := len(m.falhas) - 1; i >= 0; i-- { // mais recentes primeiro
		res.Falhas = append(res.Falhas, m.falhas[i])
	}
	return res
}

// percentil estima o tempo abaixo do qual fica a fração p dos pedidos, pelo
// limite superior da faixa do histograma em que ela cai.
func percentil(porFaixa []int64, p float64) int64 {
	var total int64
	for _, n := range porFaixa {
		total += n
	}
	if total == 0 {
		return 0
	}
	alvo := int64(float64(total)*p + 0.999999)
	var acumulado int64
	for i, n := range porFaixa {
		acumulado += n
		if acumulado >= alvo {
			if i < len(faixasMS) {
				return faixasMS[i]
			}
			return faixasMS[len(faixasMS)-1] * 2
		}
	}
	return faixasMS[len(faixasMS)-1] * 2
}
