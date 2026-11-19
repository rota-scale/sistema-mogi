package triagem

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/texto"
)

// LimiarConfianca abaixo do qual o chamado vai para revisão (RF07).
const LimiarConfianca = 0.6

// Resultado é o que a triagem decide para um chamado.
type Resultado struct {
	Status     string // revisao, aberta ou a_classificar
	Categoria  string // categoria final; vazio quando a classificar
	Secretaria string
	Nivel      *int16 // nulo quando a classificar
	PrazoAte   *time.Time
	PrazoFonte string
	Registro   Registro // gravado em ocorrencias.triagem
	Etapas     []Etapa  // gravadas em triagem_etapas (RF11)
	// ForaDoEscopo: a foto parece de local privado. O chamado vai para a
	// conferência e não aparece para os outros moradores.
	ForaDoEscopo bool
}

// Etapa é uma linha do log de custo e latência (RF11).
type Etapa struct {
	Nome          string  `json:"etapa"`
	Provedor      string  `json:"provedor,omitempty"`
	MS            int64   `json:"ms"`
	CustoBRL      float64 `json:"custo_brl"`
	TokensEntrada int     `json:"tokens_entrada"`
	TokensSaida   int     `json:"tokens_saida"`
	OK            bool    `json:"ok"`
	Erro          string  `json:"erro,omitempty"`
}

// Registro é a trilha auditável da decisão (o que o operador vê no detalhe).
type Registro struct {
	Descricao     *Descricao     `json:"descricao,omitempty"`
	Contexto      *Contexto      `json:"contexto,omitempty"`
	Classificacao *Classificacao `json:"classificacao,omitempty"`
	GUTEsperada   float64        `json:"gut_esperada"`
	GUTP90        float64        `json:"gut_p90"`
	GUT           *GUT           `json:"gut,omitempty"`
	Regra         *Regra         `json:"regra,omitempty"`
	Motivo        string         `json:"motivo"`
	Revisao       bool           `json:"revisao"`
	LatenciaMS    int64          `json:"latencia_ms"`
	Falha         string         `json:"falha,omitempty"`
	// Relatos é quantos relatos entraram na última avaliação (RF08).
	Relatos int `json:"relatos,omitempty"`
	// ForaDoEscopo marca a foto que parece de local privado. O repositório
	// lê este campo para tirar o chamado do agrupamento e do "Perto de você".
	ForaDoEscopo bool `json:"fora_do_escopo,omitempty"`
}

type Servico struct {
	Descritor       Descritor       // etapa 1; nulo desliga a visão
	Classificadores []Classificador // etapa 2, em ordem; o seguinte é o fallback (RF12)
	// Contexto recupera orientações e casos parecidos antes da classificação
	// e atende as ferramentas da IA (ADR 0023). Nulo desliga.
	Contexto Contextualizador
	// TempoContexto limita a recuperação: contexto é ajuda, nunca espera.
	TempoContexto time.Duration
	Motor         MotorLua
	// Secretaria resolve a secretaria responsável pela categoria (T7).
	Secretaria   func(ctx context.Context, categoria string) string
	TempoVisao   time.Duration
	TempoClassif time.Duration
	Log          *slog.Logger
	Agora        func() time.Time
}

// Triar descreve, classifica, aplica a regra Lua e decide o caminho. Nunca
// devolve erro: qualquer falha vira "a classificar" para revisão humana (RF12).
func (s *Servico) Triar(ctx context.Context, e Entrada) Resultado {
	inicio := time.Now()
	e.Texto = SemDadosPessoais(e.Texto)
	var etapas []Etapa
	falha := func(motivo string, reg Registro) Resultado {
		reg.Motivo, reg.Falha, reg.Revisao = "a classificar: "+motivo, motivo, true
		reg.LatenciaMS = time.Since(inicio).Milliseconds()
		return Resultado{Status: "a_classificar", Registro: reg, Etapas: etapas}
	}

	var reg Registro
	if s.Contexto != nil {
		// Já existe antes da visão: a IA de visão registra nele as
		// ferramentas que chamar.
		e.Contexto = &Contexto{}
		reg.Contexto = e.Contexto
	}
	if s.Descritor != nil && len(e.Foto) > 0 {
		t0 := time.Now()
		cctx, cancelar := context.WithTimeout(ctx, duracao(s.TempoVisao, 20*time.Second))
		d, uso, err := s.Descritor.Descrever(cctx, e)
		cancelar()
		et := Etapa{Nome: "visao", Provedor: d.Provedor, MS: time.Since(t0).Milliseconds(),
			CustoBRL: uso.CustoBRL, TokensEntrada: uso.TokensEntrada, TokensSaida: uso.TokensSaida, OK: err == nil}
		if err != nil {
			// Sem visão a triagem segue só com a categoria e o texto (RF12).
			et.Erro = resumirErro(err)
			s.log().Warn("visão falhou, seguindo sem descrição", "erro", err)
		} else {
			e.Descricao, reg.Descricao = &d, &d
		}
		etapas = append(etapas, et)
	}

	if s.Contexto != nil {
		// A recuperação vem depois da visão, para buscar também pelo que a
		// foto mostrou. Falha ou demora seguem sem contexto (RF12).
		t0 := time.Now()
		cctx, cancelar := context.WithTimeout(ctx, duracao(s.TempoContexto, 800*time.Millisecond))
		cx, err := s.Contexto.Contextualizar(cctx, e)
		cancelar()
		e.Contexto.Orientacoes, e.Contexto.Casos = cx.Orientacoes, cx.Casos
		et := Etapa{Nome: "contexto", Provedor: "base da prefeitura e histórico", MS: time.Since(t0).Milliseconds(), OK: err == nil, Erro: resumirErro(err)}
		if err != nil {
			s.log().Warn("contexto falhou, seguindo sem", "erro", err)
		}
		etapas = append(etapas, et)
	}

	c, tentativas, err := s.classificar(ctx, e)
	etapas = append(etapas, tentativas...)
	if err != nil {
		return falha("classificador indisponível", reg)
	}
	if s.Secretaria != nil {
		c.Secretaria = s.Secretaria(ctx, c.Categoria)
	}
	reg.Classificacao = &c

	t0 := time.Now()
	regra, nivel, err := s.aplicarRegra(ctx, &reg, 1)
	etapas = append(etapas, Etapa{Nome: "regra_lua", Provedor: regra.Script, MS: time.Since(t0).Milliseconds(), OK: err == nil, Erro: resumirErro(err)})
	if err != nil {
		s.log().Warn("regra Lua falhou", "erro", err)
		return falha("regra da prefeitura falhou", reg)
	}

	status := "aberta"
	fotoRuim := reg.Descricao != nil && !reg.Descricao.FotoUtil
	// Só um "não" claro manda para a revisão; a dúvida segue a regra.
	semProblema := c.ProblemaUrbano != nil && *c.ProblemaUrbano < limiarNao
	// Dentro de casa, quintal ou comércio por dentro não é zeladoria pública:
	// a central confere antes de qualquer equipe sair.
	privado := c.LocalPublico != nil && *c.LocalPublico < limiarNao
	reg.ForaDoEscopo = privado
	if nivel >= 4 || c.Confianca < LimiarConfianca || fotoRuim || semProblema || privado {
		status, reg.Revisao = "revisao", true
	}
	if privado {
		reg.Motivo += "; parece local privado, confira se é espaço público"
	}
	if fotoRuim {
		reg.Motivo += "; a foto não mostra o problema com clareza, peça nova foto ou confira"
	} else if semProblema {
		reg.Motivo += "; o relato pode não ser um problema urbano, confira"
	}
	prazo, fonte := Prazo(int(nivel), s.agora())
	reg.LatenciaMS = time.Since(inicio).Milliseconds()
	return Resultado{Status: status, Categoria: c.Categoria, Secretaria: c.Secretaria, Nivel: &nivel,
		PrazoAte: prazo, PrazoFonte: fonte, Registro: reg, Etapas: etapas, ForaDoEscopo: privado}
}

// Reavaliar recalcula a tendência e reaplica a regra quando chega mais um
// relato do mesmo problema (RF08). Devolve o registro atualizado e o novo
// nível; o chamador decide se o nível do chamado sobe.
func (s *Servico) Reavaliar(ctx context.Context, reg Registro, relatos int) (Registro, int16, error) {
	if reg.Classificacao == nil {
		return reg, 0, errors.New("chamado sem classificação para reavaliar")
	}
	_, nivel, err := s.aplicarRegra(ctx, &reg, relatos)
	return reg, nivel, err
}

// aplicarRegra calcula a GUT (com a tendência reforçada pelos relatos
// repetidos) e roda o script Lua da prefeitura, preenchendo o registro.
func (s *Servico) aplicarRegra(ctx context.Context, reg *Registro, relatos int) (Regra, int16, error) {
	c := reg.Classificacao
	if relatos < 1 {
		relatos = 1
	}
	gut := CalcularGUT(c.G, c.U, c.T.Reforcada(relatos-1))
	reg.GUT, reg.GUTEsperada, reg.GUTP90, reg.Relatos = &gut, gut.Esperada, gut.Pessimista, relatos
	regra, err := s.Motor.Avaliar(ctx, c.Categoria, map[string]any{
		"categoria": c.Categoria,
		"sinais":    c.Sinais,
		"confianca": c.Confianca,
		"relatos":   relatos,
		"gut": map[string]any{
			"esperado": gut.Esperada, "p90": gut.Pessimista,
			"g": gut.G, "u": gut.U, "t": gut.T,
		},
	})
	if err != nil {
		return regra, 0, err
	}
	reg.Regra, reg.Motivo = &regra, regra.Motivo
	return regra, int16(regra.Nivel), nil
}

func (s *Servico) classificar(ctx context.Context, e Entrada) (Classificacao, []Etapa, error) {
	var etapas []Etapa
	var ultimo error
	for _, c := range s.Classificadores {
		t0 := time.Now()
		cctx, cancelar := context.WithTimeout(ctx, duracao(s.TempoClassif, 15*time.Second))
		r, err := c.Classificar(cctx, e)
		cancelar()
		if err == nil {
			r, err = conferir(r)
		}
		etapas = append(etapas, Etapa{Nome: "classificacao", Provedor: r.Provedor, MS: time.Since(t0).Milliseconds(),
			CustoBRL: r.Uso.CustoBRL, TokensEntrada: r.Uso.TokensEntrada, TokensSaida: r.Uso.TokensSaida,
			OK: err == nil, Erro: resumirErro(err)})
		if err == nil {
			return r, etapas, nil
		}
		ultimo = err
		s.log().Warn("classificador falhou, tentando o próximo", "erro", err)
	}
	if ultimo == nil {
		ultimo = errors.New("nenhum classificador configurado")
	}
	return Classificacao{}, etapas, ultimo
}

// conferir valida a saída de qualquer classificador antes de ela chegar à
// regra: categoria conhecida, distribuições que somam 1 e probabilidades
// dentro de 0 a 1. Saída fora do esquema conta como falha e aciona o fallback.
func conferir(c Classificacao) (Classificacao, error) {
	conhecida := false
	for _, k := range Categorias() {
		if k == c.Categoria {
			conhecida = true
		}
	}
	if !conhecida {
		return c, errors.New("categoria fora do esquema: " + c.Categoria)
	}
	var ok bool
	for _, d := range []*Distribuicao{&c.G, &c.U, &c.T} {
		if *d, ok = d.Normalizada(); !ok {
			return c, errors.New("distribuição G, U ou T vazia")
		}
	}
	if c.Confianca != c.Confianca || c.Confianca < 0 || c.Confianca > 1 {
		return c, errors.New("confiança fora de 0 a 1")
	}
	limpos := map[string]float64{}
	for k, p := range c.Sinais {
		if p == p && nomeSeguro.MatchString(k) {
			limpos[k] = min(max(p, 0), 1)
		}
	}
	c.Sinais = limpos
	for _, p := range []**float64{&c.ProblemaUrbano, &c.LocalPublico} {
		if *p != nil {
			if v := **p; v != v {
				*p = nil // NaN: a pergunta fica sem resposta
			} else {
				v = min(max(v, 0), 1)
				*p = &v
			}
		}
	}
	return c, nil
}

func duracao(d, padrao time.Duration) time.Duration {
	if d > 0 {
		return d
	}
	return padrao
}

func resumirErro(err error) string {
	if err == nil {
		return ""
	}
	return texto.Cortar(err.Error(), 200)
}

func (s *Servico) agora() time.Time {
	if s.Agora != nil {
		return s.Agora()
	}
	return time.Now()
}

func (s *Servico) log() *slog.Logger {
	if s.Log != nil {
		return s.Log
	}
	return slog.Default()
}

// FontePadrao marca o prazo que não veio de regra local da prefeitura
// (SPEC v2, RF13 e C8). Prazos são proposta a validar com Itamogi.
const FontePadrao = "prazo padrão do nível, sem regra local"

// Prazo devolve o tempo máximo proposto em docs/escala-de-prioridade.md.
// Nível 1 segue a rotina da equipe e não tem prazo fixo.
func Prazo(nivel int, agora time.Time) (*time.Time, string) {
	var t time.Time
	switch nivel {
	case 5:
		t = agora.Add(2 * time.Hour)
	case 4:
		t = agora.Add(24 * time.Hour)
	case 3:
		t = diasUteis(agora, 3)
	case 2:
		t = diasUteis(agora, 7)
	default:
		return nil, FontePadrao + " (rotina da equipe)"
	}
	return &t, FontePadrao
}

func diasUteis(de time.Time, n int) time.Time {
	t := de
	for n > 0 {
		t = t.AddDate(0, 0, 1)
		if t.Weekday() != time.Saturday && t.Weekday() != time.Sunday {
			n--
		}
	}
	return t
}
