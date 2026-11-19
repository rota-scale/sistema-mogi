package observa

import (
	"testing"
	"time"
)

func TestResumoPorRota(t *testing.T) {
	agora := time.Date(2026, 11, 14, 12, 0, 30, 0, time.UTC)
	m := Novas()
	m.agora = func() time.Time { return agora }
	for range 18 {
		m.Registrar("POST", "POST /ocorrencias", 201, 300*time.Millisecond, "a")
	}
	m.Registrar("POST", "POST /ocorrencias", 502, 4*time.Second, "b")
	m.Registrar("POST", "POST /ocorrencias", 429, 2*time.Millisecond, "c")
	m.Registrar("GET", "GET /ocorrencias", 401, time.Millisecond, "d")
	m.Registrar("GET", "", 404, time.Millisecond, "e")

	r := m.Resumir()
	if r.Pedidos != 22 || r.Erros5xx != 1 || r.Recusas != 1 {
		t.Fatalf("totais errados: %+v", r)
	}
	envio := r.Rotas[0]
	if envio.Rota != "POST /ocorrencias" || envio.Pedidos != 20 || envio.Erros5xx != 1 || envio.Recusas != 1 {
		t.Fatalf("rota de envio errada: %+v", envio)
	}
	// 19 dos 20 pedidos ficaram em até 500 ms: é aí que cai o p95.
	if envio.P95MS != 500 {
		t.Fatalf("p95 esperado 500, veio %d", envio.P95MS)
	}
	// 401 e 404 não entram na lista de falhas; 502 e 429 entram, a mais nova primeiro.
	if len(r.Falhas) != 2 || r.Falhas[0].Status != 429 || r.Falhas[1].ID != "b" {
		t.Fatalf("falhas erradas: %+v", r.Falhas)
	}
	ultimo := r.PorMinuto[len(r.PorMinuto)-1]
	if len(r.PorMinuto) != minutosGuardados || ultimo.Pedidos != 22 || ultimo.Erros5xx != 1 {
		t.Fatalf("série por minuto errada: %+v", ultimo)
	}

	// Uma hora e meia depois, o minuto antigo saiu da janela.
	agora = agora.Add(90 * time.Minute)
	m.Registrar("GET", "GET /saude", 200, time.Millisecond, "f")
	r = m.Resumir()
	var soma int64
	for _, p := range r.PorMinuto {
		soma += p.Pedidos
	}
	if soma != 1 {
		t.Fatalf("a janela deveria ter só o pedido novo, tem %d", soma)
	}
}

func TestFalhasTemTeto(t *testing.T) {
	m := Novas()
	for range errosGuardados + 30 {
		m.Registrar("POST", "POST /ocorrencias", 500, time.Millisecond, "x")
	}
	if n := len(m.Resumir().Falhas); n != errosGuardados {
		t.Fatalf("guardou %d falhas", n)
	}
}

func TestPercentilVazio(t *testing.T) {
	if p := percentil(make([]int64, len(faixasMS)+1), 0.95); p != 0 {
		t.Fatalf("sem pedidos o p95 é 0, veio %d", p)
	}
}
