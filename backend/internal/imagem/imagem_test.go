package imagem

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/png"
	"testing"
)

// pngDeclarado monta só o cabeçalho de um PNG que diz ter w x h pixels.
func pngDeclarado(w, h uint32) []byte {
	var b bytes.Buffer
	b.Write([]byte("\x89PNG\r\n\x1a\n"))
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], w)
	binary.BigEndian.PutUint32(ihdr[4:], h)
	ihdr[8], ihdr[9] = 8, 2 // 8 bits, RGB
	_ = binary.Write(&b, binary.BigEndian, uint32(len(ihdr)))
	trecho := append([]byte("IHDR"), ihdr...)
	b.Write(trecho)
	_ = binary.Write(&b, binary.BigEndian, crc32.ChecksumIEEE(trecho))
	return b.Bytes()
}

func TestRecusaImagemGigante(t *testing.T) {
	if _, err := Decodificar(pngDeclarado(30000, 30000)); !errors.Is(err, ErrGrande) {
		t.Fatalf("esperava ErrGrande, veio %v", err)
	}
}

func TestRecusaLixo(t *testing.T) {
	if _, err := Decodificar([]byte("isto não é imagem")); !errors.Is(err, ErrInvalida) {
		t.Fatalf("esperava ErrInvalida, veio %v", err)
	}
}

func TestAceitaImagemNormal(t *testing.T) {
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 64, 48))); err != nil {
		t.Fatal(err)
	}
	img, err := Decodificar(b.Bytes())
	if err != nil || img.Bounds().Dx() != 64 {
		t.Fatalf("imagem normal recusada: %v", err)
	}
}
