package httpx

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestLimitadorPorCliente(t *testing.T) {
	l := &Limitador{Maximo: 2, Janela: time.Minute}
	t0 := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	if !l.Permitir("a", t0) || !l.Permitir("a", t0.Add(time.Second)) {
		t.Fatal("as duas primeiras passam")
	}
	if l.Permitir("a", t0.Add(2*time.Second)) {
		t.Fatal("a terceira na janela é barrada")
	}
	if !l.Permitir("b", t0.Add(2*time.Second)) {
		t.Fatal("outro cliente não é afetado")
	}
	if !l.Permitir("a", t0.Add(61*time.Second)) {
		t.Fatal("passada a janela, libera de novo")
	}
}

func TestOrigemSoConfiaNoCabecalhoAtrasDeProxy(t *testing.T) {
	r := httptest.NewRequest("POST", "/ocorrencias", nil)
	r.RemoteAddr = "203.0.113.9:5555"
	r.Header.Set("X-Forwarded-For", "10.1.1.1")
	if got := (Origem{}).IP(r); got != "203.0.113.9" {
		t.Fatalf("sem proxy de confiança vale o IP da conexão, veio %q", got)
	}
	if got := (Origem{ProxyConfiavel: true}).IP(r); got != "10.1.1.1" {
		t.Fatalf("com proxy de confiança vale o cabeçalho, veio %q", got)
	}
}

func TestAparelho(t *testing.T) {
	r := httptest.NewRequest("POST", "/ocorrencias", nil)
	if Aparelho(r) != "" {
		t.Fatal("sem cabeçalho não há aparelho")
	}
	r.Header.Set("X-Mogi-Aparelho", "3F2504E0-4F89-41D3-9A0C-0305E82C3301")
	if got := Aparelho(r); got != "aparelho:3f2504e0-4f89-41d3-9a0c-0305e82c3301" {
		t.Fatalf("veio %q", got)
	}
	r.Header.Set("X-Mogi-Aparelho", "'; drop table relatos; --")
	if Aparelho(r) != "" {
		t.Fatal("formato estranho é ignorado")
	}
}

func TestCheioNaoConta(t *testing.T) {
	l := &Limitador{Maximo: 2, Janela: time.Minute}
	t0 := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	for range 5 {
		if l.Cheio("a", t0) {
			t.Fatal("consultar não pode contar como tentativa")
		}
	}
	l.Permitir("a", t0)
	l.Permitir("a", t0)
	if !l.Cheio("a", t0.Add(time.Second)) {
		t.Fatal("com duas tentativas na janela, está cheio")
	}
	if l.Cheio("a", t0.Add(2*time.Minute)) {
		t.Fatal("passada a janela, esvazia")
	}
}
