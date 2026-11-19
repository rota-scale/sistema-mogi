// Package morador é o cadastro do morador que relata (ADR 0024): tipo,
// nome, CPF ou CNPJ e o aceite do termo. O documento é validado pelos
// dígitos verificadores, guardado cifrado e mostrado só mascarado.
package morador

import (
	"errors"
	"strings"
)

// Tipos de cadastro: pessoa física, pessoa jurídica e servidor público.
// Pessoa física e servidor informam CPF; pessoa jurídica, CNPJ.
const (
	TipoPF       = "pf"
	TipoPJ       = "pj"
	TipoServidor = "servidor"
)

// ErrDocumento: o documento não é um CPF ou CNPJ válido para o tipo.
var ErrDocumento = errors.New("documento inválido")

// TipoValido diz se o tipo de cadastro existe.
func TipoValido(t string) bool {
	return t == TipoPF || t == TipoPJ || t == TipoServidor
}

// Normalizar tira a máscara (pontos, traço, barra e espaços) e confere os
// dígitos verificadores do documento esperado para o tipo. Devolve só os
// dígitos. Letras ou outros símbolos tornam o documento inválido.
func Normalizar(tipo, doc string) (string, error) {
	var b strings.Builder
	for _, r := range doc {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '.' || r == '-' || r == '/' || r == ' ':
		default:
			return "", ErrDocumento
		}
	}
	d := b.String()
	switch tipo {
	case TipoPF, TipoServidor:
		if !CPFValido(d) {
			return "", ErrDocumento
		}
	case TipoPJ:
		if !CNPJValido(d) {
			return "", ErrDocumento
		}
	default:
		return "", ErrDocumento
	}
	return d, nil
}

// todosIguais pega 111.111.111-11 e parecidos, que passam na conta dos
// dígitos verificadores mas não são documentos de ninguém.
func todosIguais(d string) bool {
	for i := 1; i < len(d); i++ {
		if d[i] != d[0] {
			return false
		}
	}
	return true
}

func soDigitos(d string) bool {
	for i := 0; i < len(d); i++ {
		if d[i] < '0' || d[i] > '9' {
			return false
		}
	}
	return true
}

// CPFValido confere os dois dígitos verificadores de um CPF de 11 dígitos.
func CPFValido(d string) bool {
	if len(d) != 11 || !soDigitos(d) || todosIguais(d) {
		return false
	}
	return digitoCPF(d[:9]) == int(d[9]-'0') && digitoCPF(d[:10]) == int(d[10]-'0')
}

// digitoCPF calcula o próximo dígito: pesos decrescentes a partir de
// len(base)+1, resto de soma*10 por 11, e 10 vira 0.
func digitoCPF(base string) int {
	soma, peso := 0, len(base)+1
	for i := 0; i < len(base); i++ {
		soma += int(base[i]-'0') * peso
		peso--
	}
	r := soma * 10 % 11
	if r == 10 {
		return 0
	}
	return r
}

// CNPJValido confere os dois dígitos verificadores de um CNPJ de 14 dígitos.
func CNPJValido(d string) bool {
	if len(d) != 14 || !soDigitos(d) || todosIguais(d) {
		return false
	}
	return digitoCNPJ(d[:12]) == int(d[12]-'0') && digitoCNPJ(d[:13]) == int(d[13]-'0')
}

// digitoCNPJ usa os pesos 2 a 9 da direita para a esquerda, em ciclo; resto
// menor que 2 vira 0, senão o dígito é 11 menos o resto.
func digitoCNPJ(base string) int {
	soma, peso := 0, 2
	for i := len(base) - 1; i >= 0; i-- {
		soma += int(base[i]-'0') * peso
		peso++
		if peso > 9 {
			peso = 2
		}
	}
	r := soma % 11
	if r < 2 {
		return 0
	}
	return 11 - r
}

// Mascarar esconde o começo e o fim do documento, que são o que identifica
// alguém com mais facilidade: ***.456.789-** e **.345.678/0001-**. Recebe
// só dígitos; outro tamanho volta vazio.
func Mascarar(d string) string {
	switch len(d) {
	case 11:
		return "***." + d[3:6] + "." + d[6:9] + "-**"
	case 14:
		return "**." + d[2:5] + "." + d[5:8] + "/" + d[8:12] + "-**"
	}
	return ""
}

// Formatar devolve o documento completo com a pontuação de costume. Só a
// rota auditada do gestor (Ver documento) usa.
func Formatar(d string) string {
	switch len(d) {
	case 11:
		return d[0:3] + "." + d[3:6] + "." + d[6:9] + "-" + d[9:11]
	case 14:
		return d[0:2] + "." + d[2:5] + "." + d[5:8] + "/" + d[8:12] + "-" + d[12:14]
	}
	return d
}
