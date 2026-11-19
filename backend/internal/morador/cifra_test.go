package morador

import (
	"bytes"
	"strings"
	"testing"
)

const segredoDeTeste = "segredo-de-teste-com-mais-de-32-caracteres"

func TestCifraIdaEVolta(t *testing.T) {
	c, err := NovaCifra([]byte(segredoDeTeste))
	if err != nil {
		t.Fatal(err)
	}
	a, err := c.Cifrar("52998224725")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := c.Cifrar("52998224725")
	if bytes.Equal(a, b) {
		t.Fatal("cada cifragem precisa de nonce novo")
	}
	if bytes.Contains(a, []byte("52998224725")) || strings.Contains(string(a), "982247") {
		t.Fatal("o documento apareceu no texto cifrado")
	}
	if doc, err := c.Decifrar(a); err != nil || doc != "52998224725" {
		t.Fatalf("decifrar: %q %v", doc, err)
	}
	a[len(a)-1] ^= 1
	if _, err := c.Decifrar(a); err == nil {
		t.Fatal("texto adulterado não pode abrir")
	}
	if _, err := c.Decifrar([]byte{1, 2, 3}); err == nil {
		t.Fatal("texto curto não pode abrir")
	}
}

func TestOutraChaveNaoAbreNemAcha(t *testing.T) {
	c1, _ := NovaCifra([]byte(segredoDeTeste))
	c2, _ := NovaCifra([]byte(segredoDeTeste + "-outra"))
	cifrado, _ := c1.Cifrar("11222333000181")
	if _, err := c2.Decifrar(cifrado); err == nil {
		t.Fatal("outra chave não pode abrir o documento")
	}
	if c1.Hash("11222333000181") != c1.Hash("11222333000181") {
		t.Fatal("o hash precisa ser estável para achar o cadastro")
	}
	if c1.Hash("11222333000181") == c2.Hash("11222333000181") {
		t.Fatal("o hash depende da chave")
	}
	if c1.Hash("52998224725") == c1.Hash("11144477735") {
		t.Fatal("documentos diferentes, hashes diferentes")
	}
	if len(c1.Hash("52998224725")) != 64 {
		t.Fatal("HMAC-SHA256 em hexadecimal")
	}
}

func TestSegredoCurtoERecusado(t *testing.T) {
	if _, err := NovaCifra([]byte("curto")); err == nil {
		t.Fatal("segredo curto deveria ser recusado")
	}
}
