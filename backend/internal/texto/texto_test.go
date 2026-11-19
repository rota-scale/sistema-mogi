package texto

import (
	"testing"
	"unicode/utf8"
)

func TestCortarNaoParteAcento(t *testing.T) {
	s := "ação água calçada"
	for n := 0; n <= 20; n++ {
		c := Cortar(s, n)
		if !utf8.ValidString(c) {
			t.Fatalf("Cortar(%d) gerou UTF-8 inválido: %q", n, c)
		}
		if utf8.RuneCountInString(c) > n {
			t.Fatalf("Cortar(%d) devolveu %d caracteres", n, utf8.RuneCountInString(c))
		}
	}
	if got := Cortar(s, 3); got != "açã" {
		t.Fatalf("esperava açã, veio %q", got)
	}
	if got := Cortar("curto", 100); got != "curto" {
		t.Fatalf("texto curto mudou: %q", got)
	}
}

func TestCortarLimpaBytesInvalidos(t *testing.T) {
	if got := Cortar("ok\xffok", 10); got != "okok" {
		t.Fatalf("esperava okok, veio %q", got)
	}
}
