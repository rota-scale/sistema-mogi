package observa

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/httpx"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/texto"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

// Handlers atende a aba Operação, a telemetria dos aparelhos e o relatório.
type Handlers struct {
	Pool     *pgxpool.Pool
	Metricas *Metricas
	// Pronto confere o armazenamento de mídia.
	Pronto func(context.Context) error
	Log    *slog.Logger
	// Vigia guarda os alertas abertos, mostrados no topo da aba Operação.
	Vigia *Vigia
}

// Etapas do funil do relato, na ordem. O app manda cada uma no máximo uma
// vez por sessão, pela telemetria (sem dado pessoal).
var etapasDoFunil = []string{"funil_abriu", "funil_cadastro", "funil_foto", "funil_enviou"}

type contagem struct {
	Chave string `json:"chave"`
	N     int    `json:"n"`
}

type hora struct {
	Hora     time.Time `json:"hora"`
	Relatos  int       `json:"relatos"`
	TambemVi int       `json:"tambem_vi"`
}

type etapa struct {
	Etapa       string     `json:"etapa"`
	Provedor    string     `json:"provedor"`
	Chamadas    int        `json:"chamadas"`
	Falhas      int        `json:"falhas"`
	MediaMS     float64    `json:"media_ms"`
	P95MS       float64    `json:"p95_ms"`
	UltimaFalha *time.Time `json:"ultima_falha"`
	UltimoErro  string     `json:"ultimo_erro,omitempty"`
}

type sinal struct {
	Quando    time.Time `json:"quando"`
	Tipo      string    `json:"tipo"`
	Detalhe   *string   `json:"detalhe"`
	Tela      *string   `json:"tela"`
	Navegador *string   `json:"navegador"`
}

// Operacao trata GET /operacao: a saúde do sistema agora, para o gestor
// acompanhar o teste de campo. Só relatos reais entram nos números.
func (h *Handlers) Operacao(w http.ResponseWriter, r *http.Request) {
	ctx, cancelar := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancelar()
	agora := time.Now()
	saude := map[string]string{"banco": "ok", "midia": "ok"}
	if err := h.Pool.Ping(ctx); err != nil {
		saude["banco"] = "indisponível"
	}
	if h.Pronto != nil {
		if err := h.Pronto(ctx); err != nil {
			saude["midia"] = "indisponível"
		}
	}
	est := h.Pool.Stat()
	resp := map[string]any{
		"agora":    agora,
		"saude":    saude,
		"servidor": h.Metricas.Resumir(),
		"banco":    map[string]any{"conexoes_em_uso": est.AcquiredConns(), "conexoes_max": est.MaxConns()},
	}
	falhou := func(err error) {
		h.Log.Error("operação", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao montar o quadro da operação")
	}

	fila := map[string]int{}
	var revisao, classificar, abertas, atendimento, criticos, vencidos int
	if err := h.Pool.QueryRow(ctx, `SELECT
			count(*) FILTER (WHERE status = 'revisao'), count(*) FILTER (WHERE status = 'a_classificar'),
			count(*) FILTER (WHERE status = 'aberta'), count(*) FILTER (WHERE status = 'em_atendimento'),
			count(*) FILTER (WHERE status = 'revisao' AND nivel = 5),
			count(*) FILTER (WHERE status <> 'resolvida' AND prazo_ate < now())
		FROM ocorrencias WHERE NOT demo`).Scan(&revisao, &classificar, &abertas, &atendimento, &criticos, &vencidos); err != nil {
		falhou(err)
		return
	}
	fila["revisao"], fila["a_classificar"], fila["abertas"], fila["em_atendimento"] = revisao, classificar, abertas, atendimento
	fila["nivel5_em_revisao"], fila["prazo_vencido"] = criticos, vencidos
	resp["fila"] = fila

	var ultimaHora, hoje int
	var ultimo *time.Time
	if err := h.Pool.QueryRow(ctx, `SELECT count(*) FILTER (WHERE x.criado_em > now() - interval '1 hour'),
			count(*) FILTER (WHERE x.criado_em > now() - interval '24 hours'), max(x.criado_em)
		FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id WHERE NOT o.demo`).Scan(&ultimaHora, &hoje, &ultimo); err != nil {
		falhou(err)
		return
	}
	rows, err := h.Pool.Query(ctx, `SELECT g.h, count(x.id) FILTER (WHERE x.tipo = 'relato'), count(x.id) FILTER (WHERE x.tipo = 'tambem_vi')
		FROM generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') g(h)
		LEFT JOIN (SELECT x.id, x.tipo, x.criado_em FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id WHERE NOT o.demo) x
		  ON date_trunc('hour', x.criado_em) = g.h
		GROUP BY g.h ORDER BY g.h`)
	if err != nil {
		falhou(err)
		return
	}
	porHora, err := pgx.CollectRows(rows, pgx.RowToStructByPos[hora])
	if err != nil {
		falhou(err)
		return
	}
	resp["relatos"] = map[string]any{"ultima_hora": ultimaHora, "ultimas_24h": hoje, "ultimo_em": ultimo, "por_hora": porHora}

	// Etapas da triagem na última hora: é aqui que aparece o Jev fora do ar.
	rows, err = h.Pool.Query(ctx, `SELECT e.etapa, COALESCE(e.provedor, ''), count(*)::int, count(*) FILTER (WHERE NOT e.ok)::int,
			COALESCE(avg(e.ms), 0)::float8, COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY e.ms), 0)::float8,
			max(e.criado_em) FILTER (WHERE NOT e.ok),
			COALESCE((array_agg(e.erro ORDER BY e.criado_em DESC) FILTER (WHERE NOT e.ok))[1], '')
		FROM triagem_etapas e JOIN ocorrencias o ON o.id = e.ocorrencia_id
		WHERE NOT o.demo AND e.criado_em > now() - interval '1 hour'
		GROUP BY 1, 2 ORDER BY 1, 2`)
	if err != nil {
		falhou(err)
		return
	}
	etapas, err := pgx.CollectRows(rows, pgx.RowToStructByPos[etapa])
	if err != nil {
		falhou(err)
		return
	}
	if etapas == nil {
		etapas = []etapa{}
	}
	resp["triagem"] = etapas

	// O funil também chega pela telemetria, mas não é problema de aparelho.
	rows, err = h.Pool.Query(ctx, `SELECT tipo, count(*)::int FROM telemetria
		WHERE criado_em > now() - interval '24 hours' AND tipo NOT LIKE 'funil\_%' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 30`)
	if err != nil {
		falhou(err)
		return
	}
	porTipo, err := pgx.CollectRows(rows, pgx.RowToStructByPos[contagem])
	if err != nil {
		falhou(err)
		return
	}
	rows, err = h.Pool.Query(ctx, `SELECT criado_em, tipo, detalhe, tela, navegador FROM telemetria
		WHERE tipo NOT LIKE 'funil\_%' ORDER BY id DESC LIMIT 30`)
	if err != nil {
		falhou(err)
		return
	}
	recentes, err := pgx.CollectRows(rows, pgx.RowToStructByPos[sinal])
	if err != nil {
		falhou(err)
		return
	}
	if porTipo == nil {
		porTipo = []contagem{}
	}
	if recentes == nil {
		recentes = []sinal{}
	}
	resp["aparelhos"] = map[string]any{"por_tipo": porTipo, "recentes": recentes}

	// Funil dos últimos 7 dias: onde o morador desiste. Conta eventos, não pessoas.
	rows, err = h.Pool.Query(ctx, `SELECT tipo, count(*)::int FROM telemetria
		WHERE tipo = ANY($1) AND criado_em > now() - interval '7 days' GROUP BY 1`, etapasDoFunil)
	if err != nil {
		falhou(err)
		return
	}
	porEtapa, err := pgx.CollectRows(rows, pgx.RowToStructByPos[contagem])
	if err != nil {
		falhou(err)
		return
	}
	resp["funil"] = montarFunil(porEtapa)
	alertas := []Alerta{}
	if h.Vigia != nil {
		alertas = h.Vigia.Ativos()
	}
	resp["alertas"] = alertas

	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, resp)
}

var reTipo = regexp.MustCompile(`^[a-z][a-z0-9_]{1,39}$`)

// Telemetria trata POST /telemetria: o app avisa que algo falhou no aparelho
// (GPS negado, foto ilegível, envio que não saiu). Nada que identifique a
// pessoa é guardado: nem IP, nem identificador do aparelho, nem o user agent
// inteiro, e o detalhe passa pelo mesmo filtro de dados pessoais dos relatos.
func (h *Handlers) Telemetria(w http.ResponseWriter, r *http.Request) {
	var c struct {
		Tipo    string `json:"tipo"`
		Detalhe string `json:"detalhe"`
		Tela    string `json:"tela"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&c); err != nil || !reTipo.MatchString(c.Tipo) {
		httpx.Erro(w, http.StatusBadRequest, "telemetria inválida")
		return
	}
	detalhe := texto.Cortar(triagem.SemDadosPessoais(strings.TrimSpace(c.Detalhe)), 200)
	tela := texto.Cortar(strings.TrimSpace(c.Tela), 40)
	nav := Navegador(r.UserAgent())
	if _, err := h.Pool.Exec(r.Context(), `INSERT INTO telemetria (tipo, detalhe, tela, navegador)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''))`, c.Tipo, detalhe, tela, nav); err != nil {
		h.Log.Error("telemetria", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao registrar")
		return
	}
	h.Log.Info("aparelho", "tipo", c.Tipo, "tela", tela, "navegador", nav, "detalhe", detalhe)
	w.WriteHeader(http.StatusNoContent)
}

// LimparAntiga apaga a telemetria com mais de 30 dias.
func (h *Handlers) LimparAntiga(ctx context.Context) error {
	_, err := h.Pool.Exec(ctx, `DELETE FROM telemetria WHERE criado_em < now() - interval '30 days'`)
	return err
}

var (
	// Em ordem de prioridade: o Android também se diz "Linux".
	reSistemas = []*regexp.Regexp{
		regexp.MustCompile(`Android \d+`), regexp.MustCompile(`iPhone OS \d+`), regexp.MustCompile(`iPad; CPU OS \d+`),
		regexp.MustCompile(`Windows NT [\d.]+`), regexp.MustCompile(`Mac OS X`), regexp.MustCompile(`Linux`),
	}
	reNavegador = regexp.MustCompile(`(SamsungBrowser|EdgA?|EdgiOS|OPR|Firefox|FxiOS|CriOS|Chrome|Version)/(\d+)`)
)

// Navegador reduz o user agent à família do navegador e do sistema, o
// bastante para achar um problema de compatibilidade e pouco para
// identificar um aparelho.
func Navegador(ua string) string {
	nome, versao := "", ""
	// A ordem importa: o Chrome do Samsung e o Edge também dizem "Chrome".
	for _, m := range reNavegador.FindAllStringSubmatch(ua, -1) {
		n := map[string]string{"SamsungBrowser": "Samsung Internet", "Edg": "Edge", "EdgA": "Edge", "EdgiOS": "Edge",
			"OPR": "Opera", "Firefox": "Firefox", "FxiOS": "Firefox", "CriOS": "Chrome", "Chrome": "Chrome", "Version": "Safari"}[m[1]]
		if nome == "" || (nome == "Chrome" && n != "Chrome" && n != "Safari") || (nome == "Safari" && n != "Safari") {
			nome, versao = n, m[2]
		}
	}
	sistema := ""
	for _, re := range reSistemas {
		if sistema = re.FindString(ua); sistema != "" {
			break
		}
	}
	sistema = strings.NewReplacer("iPhone OS", "iOS", "iPad; CPU OS", "iPadOS", "Windows NT", "Windows", "Mac OS X", "macOS").Replace(sistema)
	return strings.TrimSpace(strings.TrimSpace(nome+" "+versao) + ", " + sistema)
}

// Relatorio trata GET /relatorio.csv?dias=N: uma linha por chamado real do
// período, sem texto do relato, sem coordenada e sem login de servidor. É a
// base do relatório depois do teste de campo.
func (h *Handlers) Relatorio(w http.ResponseWriter, r *http.Request) {
	dias, err := strconv.Atoi(r.URL.Query().Get("dias"))
	if err != nil || dias < 1 || dias > 365 {
		dias = 1
	}
	rows, err := h.Pool.Query(r.Context(), `SELECT o.protocolo, o.criado_em, o.categoria, COALESCE(o.secretaria, ''), COALESCE(o.bairro, ''),
			COALESCE(o.h3_r9, ''), o.status, o.nivel, o.nivel_ia, o.relatos,
			(SELECT count(*) FROM relatos x WHERE x.ocorrencia_id = o.id AND x.tipo = 'tambem_vi'),
			(SELECT count(*) FROM midias m WHERE m.ocorrencia_id = o.id AND m.tipo = 'foto'),
			(SELECT count(*) FROM midias m WHERE m.ocorrencia_id = o.id AND m.tipo = 'video'),
			(SELECT count(*) FROM midias m WHERE m.ocorrencia_id = o.id AND m.tipo = 'depois'),
			(SELECT bool_or(x.manual) FROM relatos x WHERE x.ocorrencia_id = o.id),
			o.precisao_m, o.latencia_ms, o.custo_brl::float8,
			(EXTRACT(EPOCH FROM o.revisado_em - o.criado_em) / 60)::float8,
			(EXTRACT(EPOCH FROM o.despachado_em - o.criado_em) / 60)::float8,
			(EXTRACT(EPOCH FROM o.resolvido_em - o.criado_em) / 60)::float8,
			o.prazo_ate, o.prazo_ate IS NOT NULL AND COALESCE(o.resolvido_em, now()) > o.prazo_ate,
			(SELECT count(*) FROM eventos e WHERE e.ocorrencia_id = o.id AND e.tipo = 'reaberta'),
			COALESCE(o.triagem->'classificacao'->>'provedor', '')
		FROM ocorrencias o WHERE NOT o.demo AND o.criado_em > now() - make_interval(days => $1) ORDER BY o.criado_em`, dias)
	if err != nil {
		h.Log.Error("relatório", "erro", err)
		httpx.Erro(w, http.StatusInternalServerError, "falha ao gerar o relatório")
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="mogi-%s-%dd.csv"`, time.Now().Format("2006-01-02"), dias))
	w.Header().Set("Cache-Control", "no-store")
	saida := csv.NewWriter(w)
	_ = saida.Write([]string{"protocolo", "criado_em", "categoria", "secretaria", "bairro", "celula_h3", "status", "nivel",
		"nivel_triagem", "relatos", "tambem_vi", "fotos", "videos", "fotos_do_depois", "ponto_marcado_a_mao", "precisao_m",
		"triagem_ms", "custo_brl", "min_ate_revisao", "min_ate_despacho", "min_ate_resolucao", "prazo_ate", "fora_do_prazo",
		"reaberturas", "classificador"})
	celula := func(v any) string {
		switch x := v.(type) {
		case nil:
			return ""
		case time.Time:
			return x.Format(time.RFC3339)
		case float64:
			return strconv.FormatFloat(x, 'f', 2, 64)
		case float32:
			return strconv.FormatFloat(float64(x), 'f', 0, 32)
		}
		return fmt.Sprint(v)
	}
	for rows.Next() {
		valores, err := rows.Values()
		if err != nil {
			h.Log.Error("relatório", "erro", err)
			return
		}
		linha := make([]string, len(valores))
		for i, v := range valores {
			linha[i] = celula(v)
		}
		_ = saida.Write(linha)
	}
	saida.Flush()
}

// montarFunil põe as etapas na ordem do fluxo, com zero onde ninguém chegou.
func montarFunil(porEtapa []contagem) []contagem {
	n := map[string]int{}
	for _, c := range porEtapa {
		n[c.Chave] = c.N
	}
	out := make([]contagem, 0, len(etapasDoFunil))
	for _, e := range etapasDoFunil {
		out = append(out, contagem{Chave: e, N: n[e]})
	}
	return out
}
