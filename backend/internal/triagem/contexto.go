package triagem

import (
	"context"
	"fmt"
	"strings"
)

// Contexto é o que o agente de contexto recuperou antes da classificação
// (RAG, ADR 0023): orientações da base da prefeitura e casos parecidos do
// histórico da cidade. Também guarda as ferramentas que a IA chamou
// (function calling), para o operador ver o que ela consultou.
type Contexto struct {
	Orientacoes []Orientacao        `json:"orientacoes,omitempty"`
	Casos       []CasoParecido      `json:"casos,omitempty"`
	Ferramentas []ChamadaFerramenta `json:"ferramentas,omitempty"`
}

// Orientacao é um trecho da base de conhecimento da prefeitura.
type Orientacao struct {
	Categoria string `json:"categoria"`
	Titulo    string `json:"titulo"`
	Texto     string `json:"texto"`
}

// CasoParecido é um chamado do histórico da cidade parecido com o relato.
// Sem coordenada nem texto bruto do morador: só o resumo já sem dado pessoal.
type CasoParecido struct {
	Protocolo  string `json:"protocolo"`
	Categoria  string `json:"categoria"`
	Resumo     string `json:"resumo"`
	Bairro     string `json:"bairro,omitempty"`
	Status     string `json:"status"`
	Nivel      *int16 `json:"nivel,omitempty"`
	Dias       int    `json:"dias"`
	DistanciaM *int   `json:"distancia_m,omitempty"`
}

// ChamadaFerramenta registra uma chamada de função feita pela IA.
type ChamadaFerramenta struct {
	Nome       string         `json:"nome"`
	Argumentos map[string]any `json:"argumentos,omitempty"`
	Resultado  string         `json:"resultado"`
	MS         int64          `json:"ms"`
	Erro       string         `json:"erro,omitempty"`
}

// Ponto é a coordenada do relato. Fica no servidor: as ferramentas usam
// para buscar chamados perto, e ela nunca vai a um provedor externo.
type Ponto struct{ Lat, Lng float64 }

// Contextualizador é o agente de contexto. Contextualizar faz a recuperação
// antes da classificação; Executar atende as ferramentas que a IA chamar.
type Contextualizador interface {
	Contextualizar(ctx context.Context, e Entrada) (Contexto, error)
	Executar(ctx context.Context, nome string, args map[string]any, e Entrada) (string, error)
}

// Ferramenta descreve uma função que a IA pode chamar.
type Ferramenta struct {
	Nome         string
	Descricao    string
	Parametros   map[string]any
	Obrigatorios []string
}

// Ferramentas são as funções oferecidas à IA na triagem. Todas só leem.
var Ferramentas = []Ferramenta{
	{
		Nome: "chamados_abertos_perto",
		Descricao: "Lista os chamados ainda abertos a até 150 metros do relato, com categoria, urgência, " +
			"quantas pessoas relataram e a distância. Use para saber se o problema já é conhecido e se está se espalhando.",
		Parametros: map[string]any{},
	},
	{
		Nome: "buscar_casos_parecidos",
		Descricao: "Busca no histórico da cidade os chamados mais parecidos com uma descrição curta do problema, " +
			"com a urgência que a prefeitura deu e se já foram resolvidos.",
		Parametros: map[string]any{
			"descricao": map[string]any{"type": "string", "description": "O problema em poucas palavras, por exemplo: cano estourado jorrando água"},
		},
		Obrigatorios: []string{"descricao"},
	},
	{
		Nome:      "consultar_orientacao",
		Descricao: "Consulta a orientação da prefeitura para uma categoria: quando é grave, primeiro atendimento e quem atende.",
		Parametros: map[string]any{
			"categoria": map[string]any{"type": "string", "enum": Categorias()},
			"pergunta":  map[string]any{"type": "string", "description": "O que você quer saber, por exemplo: fio caído é crítico?"},
		},
		Obrigatorios: []string{"categoria"},
	},
}

// Texto monta o contexto em linhas curtas, para entrar no pedido ao modelo.
// Corta em limite caracteres: contexto demais encarece e distrai.
func (c *Contexto) Texto(limite int) string {
	if c == nil {
		return ""
	}
	var b strings.Builder
	for _, o := range c.Orientacoes {
		fmt.Fprintf(&b, "- Orientação da prefeitura (%s, %s): %s\n", o.Categoria, strings.ToLower(o.Titulo), o.Texto)
	}
	for _, k := range c.Casos {
		fmt.Fprintf(&b, "- %s\n", k.Linha())
	}
	s := b.String()
	if limite > 0 && len([]rune(s)) > limite {
		s = string([]rune(s)[:limite]) + "…"
	}
	return strings.TrimRight(s, "\n")
}

// Linha descreve o caso em uma frase.
func (k CasoParecido) Linha() string {
	var b strings.Builder
	fmt.Fprintf(&b, "Caso parecido %s (%s", k.Protocolo, k.Categoria)
	if k.Nivel != nil {
		fmt.Fprintf(&b, ", nível %d", *k.Nivel)
	}
	fmt.Fprintf(&b, ", %s, há %d dias", nomeDoStatus(k.Status), k.Dias)
	if k.DistanciaM != nil {
		fmt.Fprintf(&b, ", a %d m", *k.DistanciaM)
	}
	b.WriteString(")")
	if k.Resumo != "" {
		b.WriteString(": " + k.Resumo)
	}
	return b.String()
}

func nomeDoStatus(s string) string {
	switch s {
	case "resolvida":
		return "resolvido"
	case "aberta", "em_atendimento":
		return "em aberto"
	case "revisao":
		return "em conferência"
	}
	return s
}
