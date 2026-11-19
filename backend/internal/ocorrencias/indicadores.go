package ocorrencias

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Indicadores é o resumo da tela do gestor (T8): volume, tempo de resposta,
// acerto da triagem nos casos revisados e custo e latência por ocorrência.
type Indicadores struct {
	Dias         int           `json:"dias"`
	Desde        time.Time     `json:"desde"`
	SoReais      bool          `json:"so_reais"`
	Total        int           `json:"total"`
	Simulados    int           `json:"simulados"`
	Relatos      int           `json:"relatos"`
	Agrupados    int           `json:"agrupados"` // chamados com mais de um relato
	PorStatus    []Contagem    `json:"por_status"`
	PorNivel     []Contagem    `json:"por_nivel"`
	PorCategoria []Contagem    `json:"por_categoria"`
	PorDia       []Contagem    `json:"por_dia"`
	Resposta     []TempoNivel  `json:"resposta"`
	Acerto       Acerto        `json:"acerto"`
	Triagem      ResumoTriagem `json:"triagem"`
	Etapas       []ResumoEtapa `json:"etapas"`
}

type Contagem struct {
	Chave string `json:"chave"`
	N     int    `json:"n"`
}

// TempoNivel mede, por nível, quanto tempo leva do relato ao despacho e à
// resolução, e quantos chamados fecharam dentro do prazo do nível.
type TempoNivel struct {
	Nivel           int      `json:"nivel"`
	Chamados        int      `json:"chamados"`
	Resolvidos      int      `json:"resolvidos"`
	NoPrazo         int      `json:"no_prazo"`
	ComPrazo        int      `json:"com_prazo"`
	MinAteDespacho  *float64 `json:"min_ate_despacho"`
	MinAteResolucao *float64 `json:"min_ate_resolucao"`
}

// Acerto compara o nível da triagem automática com o confirmado na revisão humana.
type Acerto struct {
	Revisados int `json:"revisados"`
	Exatos    int `json:"exatos"`
	Ate1Nivel int `json:"ate_1_nivel"`
	Subiu     int `json:"subiu"`  // o operador subiu o nível
	Desceu    int `json:"desceu"` // o operador baixou o nível
}

type ResumoTriagem struct {
	LatenciaMediaMS *float64 `json:"latencia_media_ms"`
	LatenciaP95MS   *float64 `json:"latencia_p95_ms"`
	CustoMedioBRL   *float64 `json:"custo_medio_brl"`
	CustoTotalBRL   float64  `json:"custo_total_brl"`
	AClassificar    int      `json:"a_classificar"` // caíram no último fallback
	// Metas do piloto na SPEC, a calibrar.
	MetaLatenciaMS int     `json:"meta_latencia_ms"`
	MetaCustoBRL   float64 `json:"meta_custo_brl"`
}

type ResumoEtapa struct {
	Etapa    string  `json:"etapa"`
	Provedor string  `json:"provedor"`
	Chamadas int     `json:"chamadas"`
	Falhas   int     `json:"falhas"`
	MediaMS  float64 `json:"media_ms"`
	P95MS    float64 `json:"p95_ms"`
	CustoBRL float64 `json:"custo_brl"`
}

func contagens(ctx context.Context, q pgx.Tx, sql string, args ...any) ([]Contagem, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	l, err := pgx.CollectRows(rows, pgx.RowToStructByPos[Contagem])
	if l == nil {
		l = []Contagem{}
	}
	return l, err
}

// Indicadores calcula tudo numa transação de leitura, para os números
// baterem entre si. Com soReais, os chamados simulados ficam de fora. Tempo
// e custo da triagem contam sempre só relatos reais: chamado simulado não
// passou pela foto, pela rede nem pela IA.
func (r *Repositorio) Indicadores(ctx context.Context, dias int, soReais bool) (Indicadores, error) {
	ind := Indicadores{Dias: dias, SoReais: soReais, Desde: time.Now().AddDate(0, 0, -dias)}
	ind.Triagem.MetaLatenciaMS, ind.Triagem.MetaCustoBRL = 30000, 0.05
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly, IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return ind, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// $1 é o início do período e $2 liga o filtro de dados reais.
	const filtro = ` criado_em >= $1 AND (NOT $2 OR NOT demo) `
	a := []any{ind.Desde, soReais}

	if err := tx.QueryRow(ctx, `SELECT count(*), count(*) FILTER (WHERE demo), COALESCE(sum(relatos), 0),
			count(*) FILTER (WHERE relatos > 1), count(*) FILTER (WHERE status = 'a_classificar' OR triagem ? 'falha'),
			avg(latencia_ms) FILTER (WHERE NOT demo)::float8,
			(percentile_cont(0.95) WITHIN GROUP (ORDER BY latencia_ms) FILTER (WHERE NOT demo))::float8,
			avg(custo_brl / relatos) FILTER (WHERE NOT demo)::float8, COALESCE(sum(custo_brl) FILTER (WHERE NOT demo), 0)::float8
		FROM ocorrencias WHERE`+filtro, a...).Scan(&ind.Total, &ind.Simulados, &ind.Relatos, &ind.Agrupados,
		&ind.Triagem.AClassificar, &ind.Triagem.LatenciaMediaMS, &ind.Triagem.LatenciaP95MS,
		&ind.Triagem.CustoMedioBRL, &ind.Triagem.CustoTotalBRL); err != nil {
		return ind, err
	}
	if ind.PorStatus, err = contagens(ctx, tx, `SELECT status, count(*)::int FROM ocorrencias WHERE`+filtro+`GROUP BY 1 ORDER BY 2 DESC`, a...); err != nil {
		return ind, err
	}
	if ind.PorNivel, err = contagens(ctx, tx, `SELECT COALESCE(nivel::text, '0'), count(*)::int FROM ocorrencias WHERE`+filtro+`GROUP BY 1 ORDER BY 1`, a...); err != nil {
		return ind, err
	}
	if ind.PorCategoria, err = contagens(ctx, tx, `SELECT categoria, count(*)::int FROM ocorrencias WHERE`+filtro+`GROUP BY 1 ORDER BY 2 DESC`, a...); err != nil {
		return ind, err
	}
	if ind.PorDia, err = contagens(ctx, tx, `SELECT to_char(d, 'YYYY-MM-DD'), count(o.id)::int
		FROM generate_series(date_trunc('day', $1::timestamptz AT TIME ZONE 'America/Sao_Paulo'),
		                     date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo'), interval '1 day') d
		LEFT JOIN ocorrencias o ON date_trunc('day', o.criado_em AT TIME ZONE 'America/Sao_Paulo') = d AND (NOT $2 OR NOT o.demo)
		GROUP BY d ORDER BY d`, a...); err != nil {
		return ind, err
	}

	rows, err := tx.Query(ctx, `SELECT nivel::int, count(*)::int, count(resolvido_em)::int,
			count(*) FILTER (WHERE resolvido_em IS NOT NULL AND prazo_ate IS NOT NULL AND resolvido_em <= prazo_ate)::int,
			count(*) FILTER (WHERE resolvido_em IS NOT NULL AND prazo_ate IS NOT NULL)::int,
			(avg(extract(epoch FROM despachado_em - criado_em)) / 60)::float8,
			(avg(extract(epoch FROM resolvido_em - criado_em)) / 60)::float8
		FROM ocorrencias WHERE nivel IS NOT NULL AND`+filtro+`GROUP BY nivel ORDER BY nivel DESC`, a...)
	if err != nil {
		return ind, err
	}
	if ind.Resposta, err = pgx.CollectRows(rows, pgx.RowToStructByPos[TempoNivel]); err != nil {
		return ind, err
	}
	if ind.Resposta == nil {
		ind.Resposta = []TempoNivel{}
	}

	if err := tx.QueryRow(ctx, `SELECT count(*)::int, count(*) FILTER (WHERE nivel = nivel_ia)::int,
			count(*) FILTER (WHERE abs(nivel - nivel_ia) <= 1)::int,
			count(*) FILTER (WHERE nivel > nivel_ia)::int, count(*) FILTER (WHERE nivel < nivel_ia)::int
		FROM ocorrencias WHERE revisado_em IS NOT NULL AND nivel_ia IS NOT NULL AND nivel IS NOT NULL AND`+filtro, a...).
		Scan(&ind.Acerto.Revisados, &ind.Acerto.Exatos, &ind.Acerto.Ate1Nivel, &ind.Acerto.Subiu, &ind.Acerto.Desceu); err != nil {
		return ind, err
	}

	rows, err = tx.Query(ctx, `SELECT e.etapa, COALESCE(e.provedor, ''), count(*)::int, count(*) FILTER (WHERE NOT e.ok)::int,
			avg(e.ms)::float8, percentile_cont(0.95) WITHIN GROUP (ORDER BY e.ms)::float8, sum(e.custo_brl)::float8
		FROM triagem_etapas e JOIN ocorrencias o ON o.id = e.ocorrencia_id
		WHERE o.criado_em >= $1 AND NOT o.demo AND ($2 OR NOT $2)
		GROUP BY 1, 2 ORDER BY min(e.id)`, a...)
	if err != nil {
		return ind, err
	}
	if ind.Etapas, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ResumoEtapa]); err != nil {
		return ind, err
	}
	if ind.Etapas == nil {
		ind.Etapas = []ResumoEtapa{}
	}
	return ind, tx.Commit(ctx)
}
