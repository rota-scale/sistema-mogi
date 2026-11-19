// Package temporeal entrega eventos de domínio ao painel por WebSocket,
// alimentado por LISTEN/NOTIFY do Postgres (ADR 0009, RF09).
package temporeal

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5"
)

// Hub guarda os clientes conectados e distribui as mensagens.
//
// Cada cliente pode ter um filtro de secretaria: a equipe de campo só recebe
// os eventos dos chamados da própria secretaria (ADR 0016). Filtro vazio
// recebe tudo (operador e gestor).
type Hub struct {
	mu       sync.Mutex
	clientes map[chan []byte]string
}

func NovoHub() *Hub { return &Hub{clientes: map[chan []byte]string{}} }

// Enviar distribui a mensagem. Com secretaria vazia vai para todos (avisos
// de conexão); senão, só para quem vê aquela secretaria.
func (h *Hub) Enviar(msg []byte, secretaria string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c, filtro := range h.clientes {
		if filtro != "" && secretaria != "" && filtro != secretaria {
			continue
		}
		select {
		case c <- msg:
		default: // cliente lento: descarta; ele refaz a consulta ao reconectar
		}
	}
}

func (h *Hub) entrar(filtro string) chan []byte {
	c := make(chan []byte, 64)
	h.mu.Lock()
	h.clientes[c] = filtro
	h.mu.Unlock()
	return c
}

func (h *Hub) sair(c chan []byte) {
	h.mu.Lock()
	delete(h.clientes, c)
	h.mu.Unlock()
}

// Conferidor valida o token e devolve o filtro de secretaria do usuário
// (vazio para quem vê tudo).
type Conferidor func(ctx context.Context, token string) (filtro string, err error)

// Handler trata GET /ao-vivo?token=. O navegador não envia cabeçalho
// Authorization no WebSocket, por isso o token vai na consulta.
func (h *Hub) Handler(conferir Conferidor, origens []string, log *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filtro, err := conferir(r.Context(), r.URL.Query().Get("token"))
		if err != nil {
			http.Error(w, "token inválido", http.StatusUnauthorized)
			return
		}
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: origens})
		if err != nil {
			log.Warn("aceitar websocket", "erro", err)
			return
		}
		defer conn.CloseNow()

		fila := h.entrar(filtro)
		defer h.sair(fila)
		ctx := conn.CloseRead(r.Context())
		_ = escrever(ctx, conn, []byte(`{"tipo":"Conectado"}`))

		ping := time.NewTicker(25 * time.Second)
		defer ping.Stop()
		for {
			select {
			case <-ctx.Done():
				conn.Close(websocket.StatusNormalClosure, "")
				return
			case msg := <-fila:
				if err := escrever(ctx, conn, msg); err != nil {
					return
				}
			case <-ping.C:
				pctx, cancelar := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Ping(pctx)
				cancelar()
				if err != nil {
					return
				}
			}
		}
	}
}

func escrever(ctx context.Context, c *websocket.Conn, msg []byte) error {
	ctx, cancelar := context.WithTimeout(ctx, 5*time.Second)
	defer cancelar()
	return c.Write(ctx, websocket.MessageText, msg)
}

// Carregador transforma o id do NOTIFY no objeto completo enviado ao painel
// e diz de qual secretaria ele é, para o filtro do hub.
type Carregador func(ctx context.Context, id string) (obj any, secretaria string, err error)

// Escutar mantém um LISTEN no canal ocorrencias e repassa cada evento ao hub.
// Reconecta sozinho se a conexão cair.
func Escutar(ctx context.Context, bancoURL string, hub *Hub, carregar Carregador, log *slog.Logger) {
	espera := time.Second
	for ctx.Err() == nil {
		err := escutarUmaVez(ctx, bancoURL, hub, carregar, log)
		if ctx.Err() != nil {
			return
		}
		log.Warn("LISTEN caiu, reconectando", "erro", err, "em", espera)
		select {
		case <-ctx.Done():
			return
		case <-time.After(espera):
		}
		espera = min(espera*2, 30*time.Second)
	}
}

func escutarUmaVez(ctx context.Context, bancoURL string, hub *Hub, carregar Carregador, log *slog.Logger) error {
	conn, err := pgx.Connect(ctx, bancoURL)
	if err != nil {
		return err
	}
	defer conn.Close(context.Background())
	if _, err := conn.Exec(ctx, "LISTEN ocorrencias"); err != nil {
		return err
	}
	// Avisa os clientes que podem ter perdido eventos durante a queda.
	hub.Enviar([]byte(`{"tipo":"Ressincronizar"}`), "")
	for {
		n, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var ev struct {
			Tipo string `json:"tipo"`
			ID   string `json:"id"`
		}
		if err := json.Unmarshal([]byte(n.Payload), &ev); err != nil {
			log.Warn("NOTIFY inválido", "payload", n.Payload)
			continue
		}
		obj, secretaria, err := carregar(ctx, ev.ID)
		if err != nil {
			log.Warn("carregar ocorrência do evento", "id", ev.ID, "erro", err)
			continue
		}
		msg, err := json.Marshal(map[string]any{"tipo": ev.Tipo, "ocorrencia": obj})
		if err != nil {
			continue
		}
		hub.Enviar(msg, secretaria)
	}
}
