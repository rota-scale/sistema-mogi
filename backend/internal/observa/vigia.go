package observa

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Alerta é um problema aberto agora: banco ou mídia fora, triagem parada ou
// muitos erros no servidor. Ninguém precisa estar olhando a tela para saber.
type Alerta struct {
	Chave string    `json:"chave"`
	Texto string    `json:"texto"`
	Desde time.Time `json:"desde"`
}

// Vigia confere a saúde a cada minuto e avisa quando um alerta abre e quando
// fecha, uma vez cada (sem repetir a cada volta): no log, na aba Operação e,
// se ALERTA_URL estiver no .env, num webhook (ntfy, Slack ou Discord). O
// aviso nunca leva dado pessoal: só o texto do problema.
type Vigia struct {
	Pool     *pgxpool.Pool
	Pronto   func(context.Context) error
	Metricas *Metricas
	Log      *slog.Logger
	// URL do webhook; vazia, o aviso fica só no log e na aba Operação.
	URL     string
	Cliente *http.Client

	agora  func() time.Time
	mu     sync.Mutex
	ativos map[string]Alerta
}

const (
	// Relato esperando a triagem há mais que isto: a triagem parou.
	triagemParadaApos = 10 * time.Minute
	// Erros 5xx nos últimos 15 minutos que abrem o alerta (mínimo e proporção).
	errosMinimos   = 5
	errosProporcao = 0.2
)

func (v *Vigia) relogio() time.Time {
	if v.agora != nil {
		return v.agora()
	}
	return time.Now()
}

// Ativos devolve os alertas abertos, os mais antigos primeiro.
func (v *Vigia) Ativos() []Alerta {
	v.mu.Lock()
	defer v.mu.Unlock()
	out := make([]Alerta, 0, len(v.ativos))
	for _, a := range v.ativos {
		out = append(out, a)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Desde.Before(out[j].Desde) })
	return out
}

// achados confere o sistema agora e devolve chave -> texto do que está errado.
func (v *Vigia) achados(ctx context.Context) map[string]string {
	ctx, cancelar := context.WithTimeout(ctx, 10*time.Second)
	defer cancelar()
	out := map[string]string{}
	bancoOk := true
	if err := v.Pool.Ping(ctx); err != nil {
		out["banco"] = "Banco de dados fora do ar"
		bancoOk = false
	}
	if v.Pronto != nil {
		if err := v.Pronto(ctx); err != nil {
			out["midia"] = "Armazenamento de fotos fora do ar"
		}
	}
	if bancoOk {
		var parados int
		if err := v.Pool.QueryRow(ctx, `SELECT count(*) FROM ocorrencias
			WHERE NOT demo AND status = 'a_classificar' AND criado_em < now() - make_interval(secs => $1)`,
			triagemParadaApos.Seconds()).Scan(&parados); err == nil && parados > 0 {
			out["triagem_parada"] = "Triagem parada: há relato esperando há mais de 10 minutos"
		}
	}
	if v.Metricas != nil {
		r := v.Metricas.Resumir()
		var pedidos, erros int64
		ultimos := r.PorMinuto
		if len(ultimos) > 15 {
			ultimos = ultimos[len(ultimos)-15:]
		}
		for _, p := range ultimos {
			pedidos += p.Pedidos
			erros += p.Erros5xx
		}
		if erros >= errosMinimos && float64(erros) >= errosProporcao*float64(pedidos) {
			out["erros_5xx"] = "Muitos erros no servidor nos últimos 15 minutos"
		}
	}
	return out
}

// aplicar compara com o que já estava aberto: abre o que é novo, fecha o
// que sumiu e avisa só nessas mudanças.
func (v *Vigia) aplicar(ctx context.Context, achados map[string]string) {
	agora := v.relogio()
	var abriu, fechou []Alerta
	v.mu.Lock()
	if v.ativos == nil {
		v.ativos = map[string]Alerta{}
	}
	for chave, texto := range achados {
		if _, ja := v.ativos[chave]; !ja {
			a := Alerta{Chave: chave, Texto: texto, Desde: agora}
			v.ativos[chave] = a
			abriu = append(abriu, a)
		}
	}
	for chave, a := range v.ativos {
		if _, segue := achados[chave]; !segue {
			delete(v.ativos, chave)
			fechou = append(fechou, a)
		}
	}
	v.mu.Unlock()
	for _, a := range abriu {
		v.Log.Warn("alerta aberto", "chave", a.Chave, "texto", a.Texto)
		v.avisar(ctx, "aberto", a)
	}
	for _, a := range fechou {
		v.Log.Info("alerta fechado", "chave", a.Chave, "durou", agora.Sub(a.Desde).Round(time.Second).String())
		v.avisar(ctx, "fechado", a)
	}
}

// avisar manda o webhook, se houver. O corpo serve para ntfy (texto), Slack
// e Discord (campos text e content); falha só vai para o log.
func (v *Vigia) avisar(ctx context.Context, estado string, a Alerta) {
	if v.URL == "" {
		return
	}
	frase := "MOGI: " + a.Texto
	if estado == "fechado" {
		frase = "MOGI resolvido: " + a.Texto
	}
	corpo, _ := json.Marshal(map[string]string{"text": frase, "content": frase, "estado": estado, "chave": a.Chave})
	ctx, cancelar := context.WithTimeout(ctx, 5*time.Second)
	defer cancelar()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.URL, bytes.NewReader(corpo))
	if err != nil {
		v.Log.Error("alerta: webhook", "erro", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	cli := v.Cliente
	if cli == nil {
		cli = &http.Client{Timeout: 5 * time.Second}
	}
	resp, err := cli.Do(req)
	if err != nil {
		v.Log.Error("alerta: webhook", "erro", err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		v.Log.Error("alerta: webhook respondeu", "status", resp.StatusCode)
	}
}

// Rodar confere a cada intervalo até o contexto acabar.
func (v *Vigia) Rodar(ctx context.Context, intervalo time.Duration) {
	t := time.NewTicker(intervalo)
	defer t.Stop()
	for {
		v.aplicar(ctx, v.achados(ctx))
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
