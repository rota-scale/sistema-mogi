// Package triagem implementa a Triagem Urbana (ADR 0007 e 0010) em três
// etapas: a visão descreve a foto já borrada, um classificador devolve
// categoria, sinais de risco e distribuições de G, U e T, e o script Lua da
// prefeitura aplica a regra e decide o nível de 1 a 5.
package triagem

import (
	"context"
	"regexp"
	"strings"
)

// Entrada é o que vai aos classificadores. Nunca leva nome, telefone nem a
// coordenada exata (ADR 0007, RNF03). O texto é a fala ou o relato digitado,
// já sem dados pessoais (veja SemDadosPessoais).
type Entrada struct {
	Categoria string // escolhida pelo cidadão; vazio ou "outros" deixa a triagem decidir
	Texto     string
	Bairro    string
	// Foto é a versão já borrada (RF03). Só a etapa de visão a recebe.
	Foto     []byte
	FotoTipo string
	// FotosExtras são as outras fotos do relato, também já borradas (JPEG).
	// Só a IA de visão as usa; o Jev recebe uma imagem por pedido.
	FotosExtras [][]byte
	// Descricao é preenchida pela etapa de visão antes da classificação.
	Descricao *Descricao
	// Ponto fica no servidor: só as ferramentas do agente de contexto usam,
	// e nenhum adaptador o envia a um provedor externo.
	Ponto *Ponto
	// Contexto é o que o agente de contexto recuperou (RAG, ADR 0023). As
	// chamadas de função da IA também são registradas nele.
	Contexto *Contexto
}

// Descricao é a saída estruturada da etapa 1 (RF04).
type Descricao struct {
	Categoria string   `json:"categoria"`
	Resumo    string   `json:"resumo"`
	Sinais    []string `json:"sinais_visiveis"`
	// FotoUtil é falso quando a foto não mostra um problema urbano
	// reconhecível; a triagem então pede revisão (RF07).
	FotoUtil bool   `json:"foto_util"`
	Provedor string `json:"provedor"`
	// Sugestao é a decisão que o próprio modelo de visão já devolveu na mesma
	// chamada. Um classificador dedicado (Jev) pode ignorá-la.
	Sugestao *Classificacao `json:"-"`
	// origem é o adaptador que fez a descrição, para ele reaproveitar a
	// própria decisão sem pagar outra chamada.
	origem any
}

// Distribuicao é P(nota = 1..5); índice 0 é a nota 1.
type Distribuicao [5]float64

func (d Distribuicao) Esperado() float64 {
	var e float64
	for i, p := range d {
		e += float64(i+1) * p
	}
	return e
}

// Normalizada devolve a distribuição sem negativos e somando 1. O segundo
// valor é falso quando não sobra massa nenhuma.
func (d Distribuicao) Normalizada() (Distribuicao, bool) {
	var soma float64
	for i, p := range d {
		if p < 0 || p != p {
			d[i] = 0
		}
		soma += d[i]
	}
	if soma <= 0 {
		return d, false
	}
	for i := range d {
		d[i] /= soma
	}
	return d, true
}

// Reforcada desloca a tendência para cima a cada relato repetido do mesmo
// problema (RF08): quem relata de novo está dizendo que o problema continua
// ou piora. A cada relato extra, 35% da massa de cada nota sobe um degrau.
// A fração é proposta a calibrar no piloto.
func (d Distribuicao) Reforcada(relatosExtras int) Distribuicao {
	const fracao = 0.35
	for ; relatosExtras > 0; relatosExtras-- {
		for i := 3; i >= 0; i-- {
			sobe := d[i] * fracao
			d[i] -= sobe
			d[i+1] += sobe
		}
	}
	return d
}

// Uso é o consumo de uma chamada de IA, para o log de custo (RF11).
type Uso struct {
	TokensEntrada int     `json:"tokens_entrada"`
	TokensSaida   int     `json:"tokens_saida"`
	CustoBRL      float64 `json:"custo_brl"`
}

// Classificacao segue o esquema do ADR 0010.
type Classificacao struct {
	Categoria  string             `json:"categoria"`
	Secretaria string             `json:"secretaria"`
	Sinais     map[string]float64 `json:"sinais"`
	G          Distribuicao       `json:"g"`
	U          Distribuicao       `json:"u"`
	T          Distribuicao       `json:"t"`
	Confianca  float64            `json:"confianca"`
	Provedor   string             `json:"provedor"`
	// ProblemaUrbano é a probabilidade de o relato mostrar mesmo um problema
	// de zeladoria. Nulo quando o classificador não pergunta isso.
	ProblemaUrbano *float64 `json:"problema_urbano,omitempty"`
	// LocalPublico é a probabilidade de a foto mostrar um espaço público
	// (rua, calçada, praça, prédio público) e não o interior de casa,
	// quintal ou comércio por dentro. Nulo quando o classificador não
	// pergunta isso.
	LocalPublico *float64 `json:"local_publico,omitempty"`
	Uso          Uso      `json:"-"`
}

// Descritor é a porta da etapa 1: visão sobre a foto borrada.
type Descritor interface {
	Descrever(ctx context.Context, e Entrada) (Descricao, Uso, error)
}

// Classificador é a porta da etapa 2. A cadeia é tentada em ordem e o
// seguinte é o fallback do anterior (RF12). O adaptador do Jev entra na
// frente quando houver chave (ADR 0007).
type Classificador interface {
	Classificar(ctx context.Context, e Entrada) (Classificacao, error)
}

var (
	reEmail    = regexp.MustCompile(`[\w.+-]+@[\w-]+(\.[\w-]+)+`)
	reCPF      = regexp.MustCompile(`\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b`)
	reTelefone = regexp.MustCompile(`(\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b`)
	rePlaca    = regexp.MustCompile(`(?i)\b[a-z]{3}[\s-]?\d[a-z0-9]\d{2}\b`)
)

// SemDadosPessoais tira e-mail, CPF, telefone e placa de veículo do relato
// antes de qualquer envio a um provedor externo (C6, RNF03). É uma rede de
// segurança por padrão de texto, não uma garantia: nomes próprios passam.
func SemDadosPessoais(texto string) string {
	for _, re := range []*regexp.Regexp{reEmail, reCPF, reTelefone, rePlaca} {
		texto = re.ReplaceAllString(texto, "[removido]")
	}
	return strings.TrimSpace(texto)
}
