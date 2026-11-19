package triagem

import (
	"context"
	"sort"
	"strings"
)

type perfil struct {
	g, u, t Distribuicao
	// gatilhos: palavra no texto (sem acento) leva o sinal a P alta.
	gatilhos map[string]string
	// sinais com P de base quando não há gatilho.
	sinais map[string]float64
}

// perfis do classificador local, calibrados para cair nos níveis esperados
// do roteiro do teste de campo (docs/escala-de-prioridade.md). Não são
// dados reais: são a última rede da cadeia de fallback (RF12), usada quando
// não há chave de IA ou quando o provedor externo falha.
var perfis = map[string]perfil{
	"agua": {
		g:        Distribuicao{0, 0, 0, .2, .8},
		u:        Distribuicao{0, 0, 0, .3, .7},
		t:        Distribuicao{0, 0, .2, .6, .2},
		gatilhos: map[string]string{"jorr": "agua_jorrando", "estour": "agua_jorrando", "alag": "alagamento", "escola": "perto_de_escola", "creche": "perto_de_escola"},
		sinais:   map[string]float64{"agua_jorrando": .3, "alagamento": .1, "perto_de_escola": .05},
	},
	"iluminacao": {
		g:        Distribuicao{0, .1, .8, .1, 0},
		u:        Distribuicao{0, 0, .5, .5, 0},
		t:        Distribuicao{0, 0, .5, .5, 0},
		gatilhos: map[string]string{"fio": "fio_exposto", "choque": "fio_exposto"},
		sinais:   map[string]float64{"fio_exposto": .05},
	},
	"limpeza": {
		g:        Distribuicao{.2, .6, .2, 0, 0},
		u:        Distribuicao{.2, .6, .2, 0, 0},
		t:        Distribuicao{.2, .6, .2, 0, 0},
		gatilhos: map[string]string{"calcada": "bloqueio_calcada", "entulho": "bloqueio_calcada"},
		sinais:   map[string]float64{"bloqueio_calcada": .2},
	},
	"vias": {
		g:        Distribuicao{0, 0, .5, .5, 0},
		u:        Distribuicao{0, 0, .6, .4, 0},
		t:        Distribuicao{0, 0, .4, .6, 0},
		gatilhos: map[string]string{"grande": "risco_moto", "moto": "risco_moto", "curva": "risco_moto"},
		sinais:   map[string]float64{"risco_moto": .3},
	},
	"arvores": {
		g:        Distribuicao{0, .5, .5, 0, 0},
		u:        Distribuicao{0, .6, .4, 0, 0},
		t:        Distribuicao{0, .5, .5, 0, 0},
		gatilhos: map[string]string{"cai": "via_bloqueada", "tomb": "via_bloqueada", "fio": "sobre_fios"},
		sinais:   map[string]float64{"via_bloqueada": .05, "sobre_fios": .05},
	},
	"sinalizacao": {
		g:        Distribuicao{0, 0, 0, .6, .4},
		u:        Distribuicao{0, 0, 0, .7, .3},
		t:        Distribuicao{0, 0, .5, .5, 0},
		gatilhos: map[string]string{"cruzamento": "cruzamento_movimentado"},
		sinais:   map[string]float64{"cruzamento_movimentado": .4},
	},
	"calcadas": {
		g:        Distribuicao{0, .5, .5, 0, 0},
		u:        Distribuicao{0, .6, .4, 0, 0},
		t:        Distribuicao{0, .5, .5, 0, 0},
		gatilhos: map[string]string{"rampa": "acessibilidade"},
		sinais:   map[string]float64{"acessibilidade": .2},
	},
	"animais": {
		g:      Distribuicao{0, .1, .8, .1, 0},
		u:      Distribuicao{0, 0, .5, .5, 0},
		t:      Distribuicao{0, 0, .5, .5, 0},
		sinais: map[string]float64{},
	},
}

// perfilIncerto é usado para categoria desconhecida: confiança baixa leva a
// GUT pessimista e à revisão humana.
var perfilIncerto = perfil{
	g:      Distribuicao{.1, .3, .3, .2, .1},
	u:      Distribuicao{.1, .3, .3, .2, .1},
	t:      Distribuicao{.1, .3, .3, .2, .1},
	sinais: map[string]float64{},
}

// Categorias lista as categorias conhecidas pela triagem.
func Categorias() []string {
	return []string{"agua", "iluminacao", "vias", "limpeza", "arvores", "sinalizacao", "calcadas", "animais", "outros"}
}

// SinaisDe devolve os sinais de risco perguntados em cada categoria
// (docs/escala-de-prioridade.md). É o vocabulário que a IA pode usar.
func SinaisDe(categoria string) []string {
	p, ok := perfis[categoria]
	if !ok {
		return nil
	}
	vistos := map[string]bool{}
	var l []string
	for s := range p.sinais {
		if !vistos[s] {
			vistos[s] = true
			l = append(l, s)
		}
	}
	for _, s := range p.gatilhos {
		if !vistos[s] {
			vistos[s] = true
			l = append(l, s)
		}
	}
	sort.Strings(l)
	return l
}

// palavrasDeCategoria deduz a categoria pela fala quando o cidadão não
// escolheu nenhuma (relato sem teclado, RF01). A ordem importa: o primeiro
// termo encontrado vence.
var palavrasDeCategoria = []struct{ termo, categoria string }{
	{"cano", "agua"}, {"vazamento", "agua"}, {"esgoto", "agua"}, {"agua", "agua"}, {"bueiro", "agua"},
	{"semaforo", "sinalizacao"}, {"sinal de transito", "sinalizacao"}, {"placa", "sinalizacao"}, {"faixa", "sinalizacao"},
	{"poste", "iluminacao"}, {"lampada", "iluminacao"}, {"luz", "iluminacao"}, {"fio", "iluminacao"}, {"escur", "iluminacao"},
	{"arvore", "arvores"}, {"galho", "arvores"}, {"poda", "arvores"},
	{"buraco", "vias"}, {"asfalto", "vias"}, {"cratera", "vias"}, {"lombada", "vias"},
	{"lixo", "limpeza"}, {"entulho", "limpeza"}, {"cacamba", "limpeza"}, {"mato", "limpeza"}, {"sujeira", "limpeza"},
	{"calcada", "calcadas"}, {"praca", "calcadas"}, {"rampa", "calcadas"},
	{"animal", "animais"}, {"cachorro", "animais"}, {"cavalo", "animais"}, {"gato", "animais"},
}

// CategoriaPorTexto devolve a categoria sugerida pelas palavras do relato,
// ou vazio quando nenhuma aparece.
func CategoriaPorTexto(texto string) string {
	t := semAcento(strings.ToLower(texto))
	for _, p := range palavrasDeCategoria {
		if strings.Contains(t, p.termo) {
			return p.categoria
		}
	}
	return ""
}

// ClassificadorLocal decide pela categoria (escolhida, vista pela IA de
// visão ou deduzida da fala) e por palavras do texto. Não usa rede nem
// custa nada: é o último degrau antes de "a classificar".
type ClassificadorLocal struct{}

func (ClassificadorLocal) Classificar(_ context.Context, e Entrada) (Classificacao, error) {
	cat, texto := e.Categoria, e.Texto
	if d := e.Descricao; d != nil {
		if _, ok := perfis[cat]; !ok && d.Categoria != "" {
			cat = d.Categoria
		}
		texto += " " + d.Resumo
	}
	if _, ok := perfis[cat]; !ok {
		if c := CategoriaPorTexto(texto); c != "" {
			cat = c
		}
	}
	p, conhecido := perfis[cat]
	confianca := 0.85
	if !conhecido {
		p, confianca, cat = perfilIncerto, 0.4, "outros"
	} else if cat != e.Categoria {
		// Categoria deduzida, não escolhida: um pouco menos de certeza.
		confianca = 0.7
	}
	sinais := map[string]float64{}
	for s, v := range p.sinais {
		sinais[s] = v
	}
	limpo := semAcento(strings.ToLower(texto))
	for palavra, sinal := range p.gatilhos {
		if strings.Contains(limpo, palavra) {
			sinais[sinal] = 0.93
		}
	}
	if d := e.Descricao; d != nil {
		for _, s := range d.Sinais {
			if _, ok := sinais[s]; ok {
				sinais[s] = 0.93
			}
		}
	}
	return Classificacao{
		Categoria: cat, Sinais: sinais,
		G: p.g, U: p.u, T: p.t, Confianca: confianca, Provedor: "local-por-categoria",
	}, nil
}

func semAcento(s string) string {
	return strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "é", "e", "ê", "e", "í", "i",
		"ó", "o", "ô", "o", "õ", "o", "ú", "u", "ü", "u", "ç", "c",
	).Replace(s)
}
