package midia

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func TestBorradorConservadorApagaDetalhe(t *testing.T) {
	// Tabuleiro de 1 px: detalhe máximo, que o borrado precisa apagar.
	img := image.NewRGBA(image.Rect(0, 0, 400, 300))
	for y := 0; y < 300; y++ {
		for x := 0; x < 400; x++ {
			c := color.RGBA{0, 0, 0, 255}
			if (x+y)%2 == 0 {
				c = color.RGBA{255, 255, 255, 255}
			}
			img.Set(x, y, c)
		}
	}
	var entrada bytes.Buffer
	if err := jpeg.Encode(&entrada, img, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatal(err)
	}
	saida, err := BorradorConservador{}.Borrar(entrada.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	borrada, err := jpeg.Decode(bytes.NewReader(saida))
	if err != nil {
		t.Fatal(err)
	}
	if borrada.Bounds().Dx() != 400 {
		t.Fatalf("largura %d, esperada 400", borrada.Bounds().Dx())
	}
	// Vizinhos não podem mais alternar entre preto e branco.
	r1, _, _, _ := borrada.At(100, 100).RGBA()
	r2, _, _, _ := borrada.At(101, 100).RGBA()
	if d := int(r1>>8) - int(r2>>8); d > 40 || d < -40 {
		t.Fatalf("detalhe sobreviveu ao borrado: %d contra %d", r1>>8, r2>>8)
	}
}

func TestBorradorRecusaNaoImagem(t *testing.T) {
	if _, err := (BorradorConservador{}).Borrar([]byte("não sou imagem")); err != ErrImagemInvalida {
		t.Fatalf("esperado ErrImagemInvalida, veio %v", err)
	}
}
