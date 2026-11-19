// Package httpx reúne utilidades de resposta HTTP.
package httpx

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Erro(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, map[string]string{"erro": msg})
}

// ErroCodigo acrescenta um código estável, para o app escolher a frase que
// mostra ao morador sem depender do texto do servidor.
func ErroCodigo(w http.ResponseWriter, status int, codigo, msg string) {
	JSON(w, status, map[string]string{"erro": msg, "codigo": codigo})
}

// Limitador é um limite simples de requisições por cliente numa janela de
// tempo. Protege o envio aberto do cidadão quando o servidor fica exposto
// por túnel ou domínio.
type Limitador struct {
	Maximo int
	Janela time.Duration
	// MaximoAtual, quando existe, substitui Maximo a cada consulta: é como o
	// limite acompanha um parâmetro que o gestor muda sem reiniciar.
	MaximoAtual func() int

	mu     sync.Mutex
	vistos map[string][]time.Time
}

// Permitir registra a tentativa e diz se o cliente ainda está no limite.
func (l *Limitador) Permitir(cliente string, agora time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.vistos == nil {
		l.vistos = map[string][]time.Time{}
	}
	corte := agora.Add(-l.Janela)
	if len(l.vistos) > 10000 { // não deixa a tabela crescer sem fim
		for k, v := range l.vistos {
			if len(v) == 0 || v[len(v)-1].Before(corte) {
				delete(l.vistos, k)
			}
		}
	}
	validos := l.vistos[cliente][:0]
	for _, t := range l.vistos[cliente] {
		if t.After(corte) {
			validos = append(validos, t)
		}
	}
	if len(validos) >= l.maximo() {
		l.vistos[cliente] = validos
		return false
	}
	l.vistos[cliente] = append(validos, agora)
	return true
}

// Cheio diz se o cliente já está no limite, sem contar esta consulta. Serve
// para limites que só contam falhas, como senha errada no login.
func (l *Limitador) Cheio(cliente string, agora time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	corte := agora.Add(-l.Janela)
	n := 0
	for _, t := range l.vistos[cliente] {
		if t.After(corte) {
			n++
		}
	}
	return n >= l.maximo()
}

func (l *Limitador) maximo() int {
	if l.MaximoAtual != nil {
		if n := l.MaximoAtual(); n > 0 {
			return n
		}
	}
	return l.Maximo
}

// Limitar devolve 429 quando quem chama passa do limite. A função chave diz
// quem é quem (IP, aparelho, login); chave vazia não é limitada.
func (l *Limitador) Limitar(chave func(*http.Request) string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c := chave(r); c != "" && !l.Permitir(c, time.Now()) {
			ErroCodigo(w, http.StatusTooManyRequests, "muitos_envios", "muitas tentativas em pouco tempo, aguarde alguns minutos")
			return
		}
		h(w, r)
	}
}

// Origem identifica o IP de quem chama. Os cabeçalhos de proxy só valem
// quando o servidor está mesmo atrás de um proxy ou túnel de confiança
// (PROXY_CONFIAVEL): aceitos de qualquer um, bastaria trocar o cabeçalho a
// cada pedido para escapar do limite.
type Origem struct{ ProxyConfiavel bool }

func (o Origem) IP(r *http.Request) string {
	if o.ProxyConfiavel {
		for _, c := range []string{"CF-Connecting-IP", "X-Forwarded-For"} {
			if v := r.Header.Get(c); v != "" {
				return strings.TrimSpace(strings.Split(v, ",")[0])
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Aparelho devolve o identificador aleatório que o app do morador manda em
// X-Mogi-Aparelho, ou vazio se ausente ou fora do formato. Não identifica a
// pessoa; serve para o limite de envios não punir vizinhos que saem pelo
// mesmo IP da operadora.
func Aparelho(r *http.Request) string {
	v := strings.TrimSpace(r.Header.Get("X-Mogi-Aparelho"))
	if len(v) < 16 || len(v) > 64 {
		return ""
	}
	for _, c := range v {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F' || c == '-') {
			return ""
		}
	}
	return "aparelho:" + strings.ToLower(v)
}
