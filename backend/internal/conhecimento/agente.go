package conhecimento

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/transform"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

// RaioPertoM é o raio da ferramenta chamados_abertos_perto.
const RaioPertoM = 150

// Agente é o agente de contexto: implementa triagem.Contextualizador.
type Agente struct {
	Base   *Base
	Pool   *pgxpool.Pool // nulo: só a base, sem histórico
	Cidade string        // slug da cidade: o histórico é só dela
}

// Contextualizar recupera, para o relato, até duas orientações da base e
// até três casos parecidos do histórico da cidade.
func (a *Agente) Contextualizar(ctx context.Context, e triagem.Entrada) (triagem.Contexto, error) {
	consulta, categoria := consultaDe(e)
	var cx triagem.Contexto
	for _, t := range a.Base.Buscar(consulta, categoria, 2) {
		cx.Orientacoes = append(cx.Orientacoes, orientacao(t))
	}
	if a.Pool == nil {
		return cx, nil
	}
	casos, err := a.parecidos(ctx, consulta, categoria, e.Ponto, 3)
	cx.Casos = casos
	return cx, err
}

// consultaDe junta o que se sabe do relato: o texto, o que a foto mostrou e
// a categoria escolhida ou vista.
func consultaDe(e triagem.Entrada) (string, string) {
	partes := []string{e.Texto}
	categoria := e.Categoria
	if d := e.Descricao; d != nil {
		partes = append(partes, d.Resumo)
		if categoria == "" || categoria == "outros" {
			categoria = d.Categoria
		}
	}
	if categoria == "outros" {
		categoria = ""
	}
	return strings.TrimSpace(strings.Join(partes, " ")), categoria
}

func orientacao(t Trecho) triagem.Orientacao {
	return triagem.Orientacao{Categoria: t.Categoria, Titulo: t.Titulo, Texto: t.Texto}
}

// Executar atende uma chamada de função da IA e devolve o resultado em JSON.
func (a *Agente) Executar(ctx context.Context, nome string, args map[string]any, e triagem.Entrada) (string, error) {
	texto := func(chave string) string {
		v, _ := args[chave].(string)
		return strings.TrimSpace(v)
	}
	switch nome {
	case "consultar_orientacao":
		categoria := texto("categoria")
		var l []triagem.Orientacao
		for _, t := range a.Base.Buscar(texto("pergunta"), categoria, 2) {
			l = append(l, orientacao(t))
		}
		if len(l) == 0 {
			for _, t := range a.Base.Buscar("", categoria, 2) {
				l = append(l, orientacao(t))
			}
		}
		return emJSON(map[string]any{"orientacoes": l})
	case "buscar_casos_parecidos":
		if a.Pool == nil {
			return emJSON(map[string]any{"casos": []any{}})
		}
		_, categoria := consultaDe(e)
		casos, err := a.parecidos(ctx, texto("descricao"), categoria, e.Ponto, 3)
		if err != nil {
			return "", err
		}
		return emJSON(map[string]any{"casos": casos})
	case "chamados_abertos_perto":
		if a.Pool == nil || e.Ponto == nil {
			return emJSON(map[string]any{"chamados": []any{}, "nota": "sem localização"})
		}
		l, err := a.abertosPerto(ctx, *e.Ponto)
		if err != nil {
			return "", err
		}
		return emJSON(map[string]any{"raio_m": RaioPertoM, "chamados": l})
	}
	return "", fmt.Errorf("ferramenta desconhecida: %s", nome)
}

func emJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

// parecidos busca no histórico da cidade (último ano) por texto, com peso
// para a mesma categoria e para o que está perto. A busca é lexical, no
// próprio Postgres (dicionário português), sem serviço externo.
func (a *Agente) parecidos(ctx context.Context, consulta, categoria string, p *triagem.Ponto, n int) ([]triagem.CasoParecido, error) {
	if strings.TrimSpace(consulta) == "" && categoria == "" {
		return nil, nil
	}
	// Palavras genéricas ("rua", "frente") casam com tudo e trazem caso fraco.
	consulta = semPalavrasVazias(consulta)
	var lat, lng *float64
	if p != nil {
		lat, lng = &p.Lat, &p.Lng
	}
	rows, err := a.Pool.Query(ctx, `
		-- Qualquer palavra do relato conta (OU), e o ranking premia quem casa mais.
		WITH q AS (SELECT NULLIF(replace(plainto_tsquery('portuguese', $1)::text, '&', '|'), '')::tsquery AS q),
		c AS (
		  SELECT o.protocolo, o.categoria,
		         COALESCE(NULLIF(o.triagem->'descricao'->>'resumo', ''), o.texto, '') AS resumo,
		         COALESCE(o.bairro, '') AS bairro, o.status, o.nivel,
		         EXTRACT(day FROM now() - o.criado_em)::int AS dias,
		         CASE WHEN $3::float8 IS NULL THEN NULL
		              ELSE ST_Distance(o.local, ST_SetSRID(ST_MakePoint($4::float8, $3::float8), 4326)::geography) END AS dist,
		         COALESCE(ts_rank(to_tsvector('portuguese', COALESCE(o.texto, '') || ' ' || COALESCE(o.triagem->'descricao'->>'resumo', '')), q.q), 0) AS rank
		    FROM ocorrencias o, q
		   WHERE o.cidade = $5 AND (q.q IS NOT NULL OR $2 <> '') AND o.status <> 'a_classificar' AND o.criado_em > now() - interval '365 days'
		     AND (o.categoria = $2 OR COALESCE(to_tsvector('portuguese', COALESCE(o.texto, '') || ' ' || COALESCE(o.triagem->'descricao'->>'resumo', '')) @@ q.q, false))
		)
		SELECT protocolo, categoria, resumo, bairro, status, nivel, dias, dist
		  FROM c
		 ORDER BY rank * 4 + (categoria = $2)::int
		          + CASE WHEN dist IS NULL THEN 0 WHEN dist < 300 THEN 1 WHEN dist < 2000 THEN 0.3 ELSE 0 END
		          + (status = 'resolvida')::int * 0.2 DESC,
		          dias
		 LIMIT $6`, consulta, categoria, lat, lng, a.Cidade, n)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (triagem.CasoParecido, error) {
		var k triagem.CasoParecido
		var dist *float64
		err := row.Scan(&k.Protocolo, &k.Categoria, &k.Resumo, &k.Bairro, &k.Status, &k.Nivel, &k.Dias, &dist)
		k.Resumo = curto(triagem.SemDadosPessoais(k.Resumo), 160)
		k.DistanciaM = arredondar(dist)
		return k, err
	})
}

// abertosPerto lista os chamados ainda abertos a até RaioPertoM do relato.
func (a *Agente) abertosPerto(ctx context.Context, p triagem.Ponto) ([]map[string]any, error) {
	rows, err := a.Pool.Query(ctx, `
		SELECT o.protocolo, o.categoria, o.nivel, o.relatos, o.status,
		       ST_Distance(o.local, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
		  FROM ocorrencias o
		 WHERE o.cidade = $3 AND o.status NOT IN ('resolvida', 'a_classificar')
		   AND ST_DWithin(o.local, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4)
		 ORDER BY 6 LIMIT 5`, p.Lat, p.Lng, a.Cidade, RaioPertoM)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (map[string]any, error) {
		var protocolo, categoria, status string
		var nivel *int16
		var relatos int
		var dist float64
		if err := row.Scan(&protocolo, &categoria, &nivel, &relatos, &status, &dist); err != nil {
			return nil, err
		}
		m := map[string]any{"protocolo": protocolo, "categoria": categoria, "pessoas": relatos, "status": status,
			"distancia_m": *arredondar(&dist)}
		if nivel != nil {
			m["nivel"] = *nivel
		}
		return m, nil
	})
}

// arredondar leva a distância a dezenas de metros: o bastante para a IA, sem
// entregar a posição exata.
func arredondar(d *float64) *int {
	if d == nil {
		return nil
	}
	v := int(math.Round(*d/10) * 10)
	return &v
}

func curto(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= n {
		return string(r)
	}
	return string(r[:n]) + "…"
}

var _ triagem.Contextualizador = (*Agente)(nil)

func semPalavrasVazias(s string) string {
	var l []string
	for _, p := range strings.Fields(s) {
		limpa := strings.Trim(strings.ToLower(p), ".,;:!?()\"'")
		norm, _, _ := transform.String(semAcento, limpa)
		if len([]rune(norm)) >= 3 && !palavrasVazias[norm] {
			l = append(l, limpa)
		}
	}
	return strings.Join(l, " ")
}
