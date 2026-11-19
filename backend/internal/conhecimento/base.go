// Package conhecimento é o agente de contexto da triagem (ADR 0023): busca na
// base de orientações da prefeitura e no histórico de chamados da cidade o que
// ajuda a IA a classificar um relato (RAG), e atende as funções que a IA chama
// durante a triagem (function calling). Tudo só lê.
package conhecimento

import (
	"embed"
	"io/fs"
	"math"
	"path"
	"sort"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// A base fica em arquivos Markdown, um por categoria: um técnico da prefeitura
// edita sem programar. É proposta a validar com a prefeitura de Itamogi.
//
//go:embed base/*.md
var arquivos embed.FS

// Trecho é uma seção da base: categoria, título da seção e texto.
type Trecho struct {
	Categoria string
	Nome      string // nome da categoria, do título do arquivo
	Titulo    string
	Texto     string
	termos    map[string]int
	tamanho   int
}

// Base é o índice de busca lexical (BM25) sobre os trechos.
type Base struct {
	trechos []Trecho
	df      map[string]int
	media   float64
}

// Carregar lê e indexa a base embutida.
func Carregar() (*Base, error) { return CarregarDe(arquivos, "base") }

// CarregarDe indexa os .md de uma pasta. Cada "## " abre um trecho.
func CarregarDe(sistema fs.FS, pasta string) (*Base, error) {
	nomes, err := fs.Glob(sistema, path.Join(pasta, "*.md"))
	if err != nil {
		return nil, err
	}
	sort.Strings(nomes)
	b := &Base{df: map[string]int{}}
	for _, nome := range nomes {
		dados, err := fs.ReadFile(sistema, nome)
		if err != nil {
			return nil, err
		}
		b.trechos = append(b.trechos, dividir(strings.TrimSuffix(path.Base(nome), ".md"), string(dados))...)
	}
	total := 0
	for i := range b.trechos {
		t := &b.trechos[i]
		t.termos = map[string]int{}
		// O título da categoria e da seção também contam na busca.
		for _, termo := range termos(t.Nome + " " + t.Titulo + " " + t.Texto) {
			t.termos[termo]++
			t.tamanho++
		}
		for termo := range t.termos {
			b.df[termo]++
		}
		total += t.tamanho
	}
	if len(b.trechos) > 0 {
		b.media = float64(total) / float64(len(b.trechos))
	}
	return b, nil
}

func dividir(categoria, md string) []Trecho {
	var l []Trecho
	nome := categoria
	var atual *Trecho
	for _, linha := range strings.Split(md, "\n") {
		linha = strings.TrimSpace(linha)
		switch {
		case strings.HasPrefix(linha, "## "):
			l = append(l, Trecho{Categoria: categoria, Nome: nome, Titulo: strings.TrimPrefix(linha, "## ")})
			atual = &l[len(l)-1]
		case strings.HasPrefix(linha, "# "):
			nome = strings.TrimPrefix(linha, "# ")
		case linha != "" && atual != nil:
			if atual.Texto != "" {
				atual.Texto += " "
			}
			atual.Texto += linha
		}
	}
	return l
}

// Buscar devolve os n trechos mais parecidos com a consulta. A categoria,
// quando vier, pesa a favor dos trechos dela; sem consulta, devolve os
// trechos da categoria na ordem do arquivo.
func (b *Base) Buscar(consulta, categoria string, n int) []Trecho {
	if b == nil || n <= 0 {
		return nil
	}
	q := termos(consulta)
	if len(q) == 0 {
		var l []Trecho
		for _, t := range b.trechos {
			if t.Categoria == categoria && len(l) < n {
				l = append(l, t)
			}
		}
		return l
	}
	const k1, bb = 1.4, 0.75
	type nota struct {
		i     int
		valor float64
	}
	var notas []nota
	N := float64(len(b.trechos))
	for i, t := range b.trechos {
		v := 0.0
		for _, termo := range q {
			f := float64(t.termos[termo])
			if f == 0 {
				continue
			}
			df := float64(b.df[termo])
			idf := math.Log(1 + (N-df+0.5)/(df+0.5))
			v += idf * f * (k1 + 1) / (f + k1*(1-bb+bb*float64(t.tamanho)/b.media))
		}
		if v == 0 {
			continue
		}
		if categoria != "" && t.Categoria == categoria {
			v *= 1.5
		}
		notas = append(notas, nota{i, v})
	}
	sort.SliceStable(notas, func(a, c int) bool { return notas[a].valor > notas[c].valor })
	var l []Trecho
	for _, x := range notas[:min(n, len(notas))] {
		l = append(l, b.trechos[x.i])
	}
	return l
}

// palavrasVazias não ajudam a achar o trecho certo.
var palavrasVazias = map[string]bool{}

func init() {
	for _, p := range strings.Fields(`a o as os um uma uns umas de da do das dos em na no nas nos por para pra com sem
		que e ou mas se ja nao sim mais muito muita pouco tem ter esta estao esse essa isso aqui ali la ao aos
		como quando onde porque ate entre sobre sob seu sua meu minha ele ela eles elas eu voce gente rua frente`) {
		palavrasVazias[p] = true
	}
}

var semAcento = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

// termos normaliza o texto: minúsculas, sem acento, sem palavras vazias, e um
// radical simples (tira o plural e a terminação de gênero) para "postes" achar
// "poste" e "caída" achar "caido".
func termos(s string) []string {
	s, _, _ = transform.String(semAcento, strings.ToLower(s))
	var l []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }) {
		if len([]rune(p)) < 3 || palavrasVazias[p] {
			continue
		}
		l = append(l, radical(p))
	}
	return l
}

func radical(p string) string {
	for _, fim := range []string{"oes", "aes", "ais", "eis", "res", "es", "s"} {
		if len(p) > len(fim)+3 && strings.HasSuffix(p, fim) {
			p = strings.TrimSuffix(p, fim)
			break
		}
	}
	if len(p) > 4 && (strings.HasSuffix(p, "a") || strings.HasSuffix(p, "o") || strings.HasSuffix(p, "e")) {
		p = p[:len(p)-1]
	}
	return p
}
