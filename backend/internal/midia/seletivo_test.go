package midia

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"net/url"
	"testing"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// cena desenha uma rua simples com uma "placa" (retângulo claro com
// caracteres escuros) no meio.
func cena(comPlaca bool) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 960, 720))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{96, 140, 190, 255}}, image.Point{}, draw.Src)
	draw.Draw(img, image.Rect(0, 400, 960, 720), &image.Uniform{color.RGBA{90, 90, 92, 255}}, image.Point{}, draw.Src)
	draw.Draw(img, image.Rect(300, 300, 660, 520), &image.Uniform{color.RGBA{170, 30, 30, 255}}, image.Point{}, draw.Src)
	if comPlaca {
		placa := image.Rect(400, 450, 560, 500)
		draw.Draw(img, placa, &image.Uniform{color.RGBA{235, 235, 235, 255}}, image.Point{}, draw.Src)
		// Caracteres grossos: barras verticais escuras como letras em negrito.
		for i := 0; i < 7; i++ {
			x := 410 + i*21
			draw.Draw(img, image.Rect(x, 458, x+5, 492), &image.Uniform{color.RGBA{15, 15, 15, 255}}, image.Point{}, draw.Src)
			draw.Draw(img, image.Rect(x+9, 458, x+14, 492), &image.Uniform{color.RGBA{15, 15, 15, 255}}, image.Point{}, draw.Src)
		}
		d := &font.Drawer{Dst: img, Src: image.NewUniform(color.Black), Face: basicfont.Face7x13, Dot: fixed.P(445, 449)}
		d.DrawString("BRASIL")
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95})
	return buf.Bytes()
}

func contraste(img image.Image, r image.Rectangle) int {
	mn, mx := 255, 0
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			v, _, _, _ := img.At(x, y).RGBA()
			mn, mx = min(mn, int(v>>8)), max(mx, int(v>>8))
		}
	}
	return mx - mn
}

func TestBorradorSeletivoApagaPlacaEPreservaOResto(t *testing.T) {
	b := BorradorSeletivo{Reserva: BorradorConservador{}}
	saida, regioes, err := b.BorrarComRegioes(cena(true))
	if err != nil {
		t.Fatal(err)
	}
	achou := false
	for _, r := range regioes {
		if r.Tipo == "placa" && r.Overlaps(image.Rect(400, 450, 560, 500)) {
			achou = true
		}
	}
	if !achou {
		t.Fatalf("a placa não foi detectada: %+v", regioes)
	}
	img, err := jpeg.Decode(bytes.NewReader(saida))
	if err != nil {
		t.Fatal(err)
	}
	if c := contraste(img, image.Rect(410, 460, 550, 490)); c > 90 {
		t.Fatalf("os caracteres da placa ainda têm contraste %d: seguem legíveis", c)
	}
	// O carro e a rua continuam nítidos: a borda do carro segue com contraste alto.
	if c := contraste(img, image.Rect(290, 320, 310, 340)); c < 60 {
		t.Fatalf("a foto fora da placa não pode ser borrada (contraste %d)", c)
	}
}

func TestBorradorSeletivoNaoInventaRegiaoEmCenaLimpa(t *testing.T) {
	_, regioes, err := BorradorSeletivo{}.BorrarComRegioes(cena(false))
	if err != nil {
		t.Fatal(err)
	}
	if len(regioes) != 0 {
		t.Fatalf("cena sem rosto nem placa não deveria ter regiões: %+v", regioes)
	}
}

func TestBorradorSeletivoRecusaNaoImagem(t *testing.T) {
	if _, err := (BorradorSeletivo{Reserva: BorradorConservador{}}).Borrar([]byte("não sou imagem")); err != ErrImagemInvalida {
		t.Fatalf("esperado ErrImagemInvalida, veio %v", err)
	}
}

func TestLinkDeMidiaAssinado(t *testing.T) {
	agora := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	a := Assinador{Segredo: []byte("segredo-de-teste-com-32-caracteres!"), Agora: func() time.Time { return agora }}
	q, _ := url.ParseQuery(a.Consulta("ocorrencias/abc/publica.jpg", time.Hour))
	if chave, restrita, err := a.Conferir(q); err != nil || restrita || chave != "ocorrencias/abc/publica.jpg" {
		t.Fatalf("link válido recusado: %v", err)
	}
	// A foto original nunca tem link, mesmo com assinatura correta.
	orig, _ := url.ParseQuery(a.Consulta("ocorrencias/abc/original.jpg", time.Hour))
	if _, _, err := a.Conferir(orig); err == nil {
		t.Fatal("link para a foto original deveria ser recusado")
	}
	troca := url.Values{"c": {"ocorrencias/outro/publica.jpg"}, "exp": q["exp"], "s": q["s"]}
	if _, _, err := a.Conferir(troca); err == nil {
		t.Fatal("assinatura de uma chave não pode abrir outra")
	}
	agora = agora.Add(2 * time.Hour)
	if _, _, err := a.Conferir(q); err == nil {
		t.Fatal("link vencido deveria ser recusado")
	}
}

// Textura de rua (respingos, pedras, rachaduras) não pode virar "placa":
// borrar isso apaga o problema que o morador fotografou.
func TestTexturaNaoViraPlaca(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 960, 720))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{170, 170, 168, 255}}, image.Point{}, draw.Src)
	// Grade densa de traços claros e escuros, como paralelepípedo ou respingo.
	for y := 200; y < 700; y++ {
		for x := 100; x < 900; x++ {
			if (x/6+y/9)%2 == 0 {
				img.Set(x, y, color.RGBA{30, 30, 32, 255})
			} else {
				img.Set(x, y, color.RGBA{235, 235, 235, 255})
			}
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95})
	_, regioes, err := BorradorSeletivo{}.BorrarComRegioes(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range regioes {
		if r.Tipo == "placa" && float64(r.Dx()*r.Dy()) > 0.05*960*720 {
			t.Fatalf("textura virou placa gigante: %v", r.Rectangle)
		}
	}
}

func TestFormaDePlaca(t *testing.T) {
	casos := []struct {
		r    image.Rectangle
		quer bool
	}{
		{image.Rect(0, 0, 160, 50), true},   // placa de frente
		{image.Rect(0, 0, 400, 400), false}, // quadrado: textura
		{image.Rect(0, 0, 900, 300), false}, // grande demais
		{image.Rect(0, 0, 100, 10), false},  // fina demais
	}
	for _, c := range casos {
		if got := formaDePlaca(c.r, 1280, 960); got != c.quer {
			t.Errorf("%v: %v, queria %v", c.r, got, c.quer)
		}
	}
}

func TestLinkRestritoEPublicoNaoSeMisturam(t *testing.T) {
	agora := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	a := Assinador{Segredo: []byte("segredo-de-teste-com-32-caracteres!"), Agora: func() time.Time { return agora }}
	video := "ocorrencias/abc/video.mp4"

	// O vídeo original só sai por link restrito.
	pub, _ := url.ParseQuery(a.Consulta(video, time.Hour))
	if _, _, err := a.Conferir(pub); err == nil {
		t.Fatal("link público para vídeo original deveria ser recusado")
	}
	res, _ := url.ParseQuery(a.ConsultaRestrita(video, time.Minute))
	if chave, restrita, err := a.Conferir(res); err != nil || !restrita || chave != video {
		t.Fatalf("link restrito válido recusado: %v", err)
	}
	// Tirar o r=1 não transforma o link restrito em público.
	res.Del("r")
	if _, _, err := a.Conferir(res); err == nil {
		t.Fatal("assinatura restrita não vale como pública")
	}
	// A assinatura pública de uma foto não abre a mesma chave como restrita.
	foto, _ := url.ParseQuery(a.Consulta("ocorrencias/abc/publica-2.jpg", time.Hour))
	foto.Set("r", "1")
	if _, _, err := a.Conferir(foto); err == nil {
		t.Fatal("assinatura pública não vale como restrita")
	}
	// Nem com assinatura restrita correta a foto original ganha link.
	orig, _ := url.ParseQuery(a.ConsultaRestrita("ocorrencias/abc/original.jpg", time.Minute))
	if _, _, err := a.Conferir(orig); err == nil {
		t.Fatal("a foto original nunca tem link, nem restrito")
	}
	for _, nome := range []string{"publica.jpg", "publica-2.jpg", "quadro-1.jpg", "depois.jpg", "depois-3.jpg"} {
		if !EPublica("ocorrencias/x/" + nome) {
			t.Fatalf("%s deveria ser pública", nome)
		}
	}
	for _, nome := range []string{"original.jpg", "video.mp4", "publica.jpg.exe", "quadro-1.png"} {
		if EPublica("ocorrencias/x/" + nome) {
			t.Fatalf("%s não deveria ser pública", nome)
		}
	}
}
