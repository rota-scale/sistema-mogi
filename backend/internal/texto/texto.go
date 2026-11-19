// Package texto guarda utilidades de texto usadas por mais de um pacote.
package texto

import "strings"

// Cortar limita s a no máximo n caracteres sem partir um caractere
// acentuado no meio. Cortar por bytes gera UTF-8 inválido, que o Postgres
// recusa.
func Cortar(s string, n int) string {
	if n <= 0 {
		return ""
	}
	s = strings.ToValidUTF8(s, "")
	if len(s) <= n {
		return s
	}
	i := 0
	for pos := range s {
		if i == n {
			return s[:pos]
		}
		i++
	}
	return s
}
