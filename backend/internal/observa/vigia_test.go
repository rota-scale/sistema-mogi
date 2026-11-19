package observa

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// O alerta avisa uma vez ao abrir e uma vez ao fechar, nunca a cada volta.
func TestVigiaAbreEFechaUmaVez(t *testing.T) {
	var mu sync.Mutex
	var recebidos []map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var c map[string]string
		_ = json.NewDecoder(r.Body).Decode(&c)
		mu.Lock()
		recebidos = append(recebidos, c)
		mu.Unlock()
	}))
	defer srv.Close()
	agora := time.Date(2026, 11, 18, 8, 0, 0, 0, time.UTC)
	v := &Vigia{URL: srv.URL, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), agora: func() time.Time { return agora }}
	ctx := context.Background()

	v.aplicar(ctx, map[string]string{"midia": "Armazenamento de fotos fora do ar"})
	agora = agora.Add(time.Minute)
	v.aplicar(ctx, map[string]string{"midia": "Armazenamento de fotos fora do ar"})
	if a := v.Ativos(); len(a) != 1 || a[0].Chave != "midia" || !a[0].Desde.Equal(time.Date(2026, 11, 18, 8, 0, 0, 0, time.UTC)) {
		t.Fatalf("ativos: %+v", a)
	}
	agora = agora.Add(time.Minute)
	v.aplicar(ctx, map[string]string{})
	if a := v.Ativos(); len(a) != 0 {
		t.Fatalf("alerta não fechou: %+v", a)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(recebidos) != 2 || recebidos[0]["estado"] != "aberto" || recebidos[1]["estado"] != "fechado" {
		t.Fatalf("webhook: %+v", recebidos)
	}
	if recebidos[0]["text"] != "MOGI: Armazenamento de fotos fora do ar" || recebidos[0]["content"] == "" {
		t.Fatalf("corpo: %+v", recebidos[0])
	}
}

// Sem ALERTA_URL o vigia só registra; webhook fora do ar não derruba nada.
func TestVigiaSemWebhookOuComWebhookFora(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()
	(&Vigia{Log: log}).aplicar(ctx, map[string]string{"banco": "x"})
	v := &Vigia{Log: log, URL: "http://127.0.0.1:1", Cliente: &http.Client{Timeout: 200 * time.Millisecond}}
	v.aplicar(ctx, map[string]string{"banco": "Banco de dados fora do ar"})
	if len(v.Ativos()) != 1 {
		t.Fatal("o alerta deve abrir mesmo com o webhook fora")
	}
}

func TestFunilNaOrdemComZeros(t *testing.T) {
	f := montarFunil([]contagem{{Chave: "funil_enviou", N: 2}, {Chave: "funil_abriu", N: 10}})
	if len(f) != 4 || f[0] != (contagem{"funil_abriu", 10}) || f[1].N != 0 || f[2].N != 0 || f[3] != (contagem{"funil_enviou", 2}) {
		t.Fatalf("%+v", f)
	}
}
