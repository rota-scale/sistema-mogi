package morador

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

// Cifra guarda o documento do morador fora do texto puro (ADR 0024):
// AES-256-GCM para poder abrir quando o gestor precisar, e HMAC-SHA256
// para achar o cadastro pelo documento sem decifrar nada. As duas chaves
// saem do segredo DOCUMENTO_CHAVE, cada uma com o seu rótulo.
type Cifra struct {
	aead      cipher.AEAD
	chaveHash []byte
}

// dadosAssociados amarra o texto cifrado a este uso: o mesmo segredo
// aplicado a outro campo não abre o documento.
var dadosAssociados = []byte("mogi/morador/documento/v1")

// ErrCifra: o texto cifrado está corrompido ou foi feito com outra chave.
var ErrCifra = errors.New("documento cifrado ilegível")

// NovaCifra deriva as chaves do segredo. Segredo curto é recusado.
func NovaCifra(segredo []byte) (*Cifra, error) {
	if len(segredo) < 32 {
		return nil, errors.New("DOCUMENTO_CHAVE precisa de 32 caracteres ou mais")
	}
	bloco, err := aes.NewCipher(derivar(segredo, "mogi/documento/cifra"))
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(bloco)
	if err != nil {
		return nil, err
	}
	return &Cifra{aead: aead, chaveHash: derivar(segredo, "mogi/documento/hash")}, nil
}

func derivar(segredo []byte, rotulo string) []byte {
	m := hmac.New(sha256.New, segredo)
	m.Write([]byte(rotulo))
	return m.Sum(nil)
}

// Cifrar devolve o nonce seguido do texto cifrado. Cada chamada sorteia um
// nonce novo: o mesmo documento cifrado duas vezes dá bytes diferentes.
func (c *Cifra) Cifrar(doc string) ([]byte, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return c.aead.Seal(nonce, nonce, []byte(doc), dadosAssociados), nil
}

// Decifrar abre o que Cifrar gravou.
func (c *Cifra) Decifrar(b []byte) (string, error) {
	n := c.aead.NonceSize()
	if len(b) < n+c.aead.Overhead() {
		return "", ErrCifra
	}
	claro, err := c.aead.Open(nil, b[:n], b[n:], dadosAssociados)
	if err != nil {
		return "", ErrCifra
	}
	return string(claro), nil
}

// Hash é o HMAC do documento só com dígitos. Sem a chave, não dá para
// testar CPFs um a um contra a coluna do banco.
func (c *Cifra) Hash(doc string) string {
	m := hmac.New(sha256.New, c.chaveHash)
	m.Write([]byte(doc))
	return hex.EncodeToString(m.Sum(nil))
}
