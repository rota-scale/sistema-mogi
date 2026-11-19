package midia

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"testing"
)

// Limite honesto destes testes: as imagens são sintéticas. Eles conferem que
// a cascata embutida carrega, que o borrão de uma região apaga o detalhe e
// que a foto sai no tamanho de publicação. A detecção de rosto de verdade
// (Pigo) e a heurística de placa ainda precisam ser validadas com fotos
// reais de Itamogi, com autorização de quem aparece nelas.

func TestCascataDeRostosCarregaENaoInventaRosto(t *testing.T) {
	const w, h = 320, 240
	cinza := make([]uint8, w*h)
	for i := range cinza {
		cinza[i] = 128
	}
	rostos, err := detectarRostos(cinza, w, h)
	if err != nil {
		t.Fatalf("a cascata embutida deveria carregar: %v", err)
	}
	if len(rostos) != 0 {
		t.Fatalf("imagem lisa não tem rosto: %+v", rostos)
	}
}

// xadrez fino imita detalhe de rosto (olhos, boca): contraste alto em pouco espaço.
func xadrez(img *image.RGBA, r image.Rectangle) {
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			c := color.RGBA{20, 20, 20, 255}
			if (x/3+y/3)%2 == 0 {
				c = color.RGBA{235, 235, 235, 255}
			}
			img.SetRGBA(x, y, c)
		}
	}
}

func TestBorrarRegiaoApagaDetalheSoDentroDaRegiao(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 400, 300))
	xadrez(img, img.Bounds())
	rosto := image.Rect(100, 80, 220, 220)
	borrarRegiao(img, rosto)
	// O mosaico pode manter cores fortes nos blocos; o que importa é não
	// sobrar traço fino. Mede a diferença média entre pixels vizinhos.
	if d := detalhe(img, rosto.Inset(10)); d > 8 {
		t.Fatalf("o detalhe dentro da região segue alto (%d): rosto legível", d)
	}
	if d := detalhe(img, image.Rect(300, 20, 340, 60)); d < 50 {
		t.Fatalf("fora da região a foto não pode ser borrada (detalhe %d)", d)
	}
}

func TestBorradorSeletivoReduzParaPublicar(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 3000, 2000))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{96, 140, 190, 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	saida, err := BorradorSeletivo{Reserva: BorradorConservador{}}.Borrar(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(saida))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 1280 || cfg.Height != 853 {
		t.Fatalf("esperado 1280x853 para publicar, veio %dx%d", cfg.Width, cfg.Height)
	}
}

// detalhe é a diferença média de brilho entre pixels vizinhos na horizontal.
func detalhe(img *image.RGBA, r image.Rectangle) int {
	soma, n := 0, 0
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X-1; x++ {
			a, b := int(img.RGBAAt(x, y).R), int(img.RGBAAt(x+1, y).R)
			soma += max(a-b, b-a)
			n++
		}
	}
	return soma / max(1, n)
}
