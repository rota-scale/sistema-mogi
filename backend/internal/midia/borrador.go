package midia

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"

	"golang.org/x/image/draw"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/imagem"
)

// Borrador é a porta do RF03: devolve a versão publicável da foto, sem
// rostos nem placas legíveis. A versão original fica só para operadores.
type Borrador interface {
	Borrar(dados []byte) ([]byte, error)
}

// BorradorConservador borra a imagem inteira. Enquanto não houver detector
// aberto de rostos e placas (OpenCV, prototipo/README.md), esta é a forma de
// garantir o RF03 e o C6: nada legível sai, ao custo de perder detalhe.
// O problema (cano, buraco, poste) continua reconhecível pela forma e cor.
type BorradorConservador struct {
	// LarguraBorrada é a largura intermediária; menor é mais borrado.
	LarguraBorrada int
	// LarguraFinal limita o tamanho da imagem publicada.
	LarguraFinal int
}

var ErrImagemInvalida = errors.New("imagem inválida: envie JPEG ou PNG")

func (b BorradorConservador) Borrar(dados []byte) ([]byte, error) {
	img, err := imagem.Decodificar(dados)
	if err != nil {
		return nil, ErrImagemInvalida
	}
	lb, lf := b.LarguraBorrada, b.LarguraFinal
	if lb <= 0 {
		lb = 48
	}
	if lf <= 0 {
		lf = 960
	}
	r := img.Bounds()
	if r.Dx() == 0 || r.Dy() == 0 {
		return nil, ErrImagemInvalida
	}
	if lf > r.Dx() {
		lf = r.Dx()
	}
	altura := func(l int) int { return max(1, r.Dy()*l/r.Dx()) }

	pequena := image.NewRGBA(image.Rect(0, 0, lb, altura(lb)))
	draw.CatmullRom.Scale(pequena, pequena.Bounds(), img, r, draw.Src, nil)
	final := image.NewRGBA(image.Rect(0, 0, lf, altura(lf)))
	draw.BiLinear.Scale(final, final.Bounds(), pequena, pequena.Bounds(), draw.Src, nil)

	// Reencodar também descarta o EXIF (GPS do aparelho, modelo, horário).
	var saida bytes.Buffer
	if err := jpeg.Encode(&saida, final, &jpeg.Options{Quality: 80}); err != nil {
		return nil, err
	}
	return saida.Bytes(), nil
}
