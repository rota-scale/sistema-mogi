package midia

import (
	"context"
	"image"
	"image/draw"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/imagem"
)

// Foto de morador só entra no relato se for de lugar público, visto da rua.
// A checagem roda antes de qualquer gravação: foto recusada não chega ao S3.

// LimiteRostoEmDestaque: rosto que ocupa essa fração da imagem é foto pessoal
// (selfie, retrato), não passante ao fundo.
const LimiteRostoEmDestaque = 0.15

// Veredito é o resultado da checagem de conteúdo.
type Veredito struct {
	Aceita bool
	// Motivo quando recusada: "pessoal", "interior", "intimo" ou "outro".
	Motivo string
}

// Verificador decide se a foto pode entrar no relato.
type Verificador interface {
	// original: com rostos, para a regra local. publica: já borrada, a que a
	// IA vê (a original não sai do servidor).
	Verificar(ctx context.Context, original, publica []byte) (Veredito, error)
}

// ClassificadorDeCena é a parte que vê a imagem (IA com visão). Devolve a
// categoria da cena: "publico", "interior", "pessoal", "intimo" ou "outro".
type ClassificadorDeCena interface {
	Cena(ctx context.Context, dados []byte) (string, error)
}

// Conteudo junta a regra local (rosto em destaque, sem IA) com a classificação
// de cena. Sem classificador, vale só a regra local.
type Conteudo struct {
	Cena ClassificadorDeCena
}

// Verificar recusa a foto se ela mostra uma pessoa em destaque ou se a IA não
// a reconhece como lugar público. Erro da IA não aceita a foto em silêncio:
// quem recebe o erro pode tentar de novo.
func (c Conteudo) Verificar(ctx context.Context, original, publica []byte) (Veredito, error) {
	img, err := imagem.Decodificar(original)
	if err != nil || img.Bounds().Dx() == 0 || img.Bounds().Dy() == 0 {
		return Veredito{}, ErrImagemInvalida
	}
	b := img.Bounds()
	rgba := image.NewRGBA(b)
	draw.Draw(rgba, b, img, b.Min, draw.Src)

	regioes, err := detectarRostos(paraCinza(rgba), b.Dx(), b.Dy())
	if err != nil {
		return Veredito{}, err
	}
	area := float64(b.Dx() * b.Dy())
	for _, r := range regioes {
		if float64(r.Dx()*r.Dy())/area >= LimiteRostoEmDestaque {
			return Veredito{Aceita: false, Motivo: "pessoal"}, nil
		}
	}

	if c.Cena == nil {
		return Veredito{Aceita: true}, nil
	}
	cena, err := c.Cena.Cena(ctx, publica)
	if err != nil {
		return Veredito{}, err
	}
	if cena == "publico" {
		return Veredito{Aceita: true}, nil
	}
	if cena != "pessoal" && cena != "intimo" && cena != "interior" {
		cena = "outro"
	}
	return Veredito{Aceita: false, Motivo: cena}, nil
}
