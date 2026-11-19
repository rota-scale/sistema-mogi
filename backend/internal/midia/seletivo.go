package midia

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"sync"

	pigo "github.com/esimov/pigo/core"
	"golang.org/x/image/draw"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/imagem"
)

// cascata é o detector de rostos do projeto Pigo (MIT, Endre Simo), em Go
// puro, sem OpenCV nem cgo (ADR 0012).
//
//go:embed cascata/facefinder
var cascata []byte

var (
	detectorUmaVez sync.Once
	detector       *pigo.Pigo
	detectorErro   error
)

// BorradorSeletivo borra só rostos e regiões com cara de placa de veículo
// (RF03), para a foto continuar servindo à triagem. Se a detecção falhar,
// cai no Reserva (borrão total), que nunca deixa nada legível.
//
// Limites conhecidos, a validar com fotos reais de Itamogi antes de abrir
// para cidadãos: o detector de rostos pega rosto de frente (perfil e rosto
// muito pequeno escapam) e o de placas é uma heurística de bordas, que
// prefere borrar a mais. Com BORRADOR=total a foto volta a sair toda borrada.
type BorradorSeletivo struct {
	Reserva Borrador
	// LarguraFinal limita o tamanho da imagem publicada.
	LarguraFinal int
}

// Regiao é um retângulo a borrar, com a origem da detecção.
type Regiao struct {
	image.Rectangle
	Tipo string // rosto ou placa
}

func (b BorradorSeletivo) Borrar(dados []byte) ([]byte, error) {
	saida, _, err := b.BorrarComRegioes(dados)
	return saida, err
}

// BorrarComRegioes devolve também o que foi borrado, para teste e auditoria.
func (b BorradorSeletivo) BorrarComRegioes(dados []byte) (saida []byte, regioes []Regiao, err error) {
	img, errDec := imagem.Decodificar(dados)
	if errDec != nil || img.Bounds().Dx() == 0 || img.Bounds().Dy() == 0 {
		return nil, nil, ErrImagemInvalida
	}
	// Qualquer pane na detecção vira borrão total: privacidade primeiro.
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("detecção falhou: %v", r)
		}
		if err != nil && b.Reserva != nil {
			saida, err = b.Reserva.Borrar(dados)
			regioes = []Regiao{{Tipo: "total"}}
		}
	}()

	lf := b.LarguraFinal
	if lf <= 0 {
		lf = 1280
	}
	r := img.Bounds()
	if lf > r.Dx() {
		lf = r.Dx()
	}
	tela := image.NewRGBA(image.Rect(0, 0, lf, max(1, r.Dy()*lf/r.Dx())))
	draw.CatmullRom.Scale(tela, tela.Bounds(), img, r, draw.Src, nil)

	cinza := paraCinza(tela)
	rostos, err := detectarRostos(cinza, tela.Bounds().Dx(), tela.Bounds().Dy())
	if err != nil {
		return nil, nil, err
	}
	regioes = append(rostos, detectarPlacas(tela, cinza)...)
	for _, reg := range regioes {
		borrarRegiao(tela, reg.Rectangle)
	}

	// Reencodar também descarta o EXIF (GPS do aparelho, modelo, horário).
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, tela, &jpeg.Options{Quality: 82}); err != nil {
		return nil, nil, err
	}
	return buf.Bytes(), regioes, nil
}

func paraCinza(img *image.RGBA) []uint8 {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	g := make([]uint8, w*h)
	for y := 0; y < h; y++ {
		linha := img.Pix[y*img.Stride:]
		for x := 0; x < w; x++ {
			p := linha[x*4:]
			g[y*w+x] = uint8((299*int(p[0]) + 587*int(p[1]) + 114*int(p[2])) / 1000)
		}
	}
	return g
}

func detectarRostos(cinza []uint8, w, h int) ([]Regiao, error) {
	detectorUmaVez.Do(func() {
		detector, detectorErro = pigo.NewPigo().Unpack(cascata)
	})
	if detectorErro != nil {
		return nil, errors.New("cascata de rostos inválida")
	}
	if min(w, h) < 32 {
		return nil, nil
	}
	achados := detector.RunCascade(pigo.CascadeParams{
		MinSize:     24,
		MaxSize:     min(w, h),
		ShiftFactor: 0.1,
		ScaleFactor: 1.1,
		ImageParams: pigo.ImageParams{Pixels: cinza, Rows: h, Cols: w, Dim: w},
	}, 0)
	achados = detector.ClusterDetections(achados, 0.2)
	var regioes []Regiao
	for _, a := range achados {
		// Limiar baixo de propósito: melhor borrar um falso rosto do que
		// deixar passar um verdadeiro.
		if a.Q < 5 {
			continue
		}
		meio := a.Scale * 13 / 20 // margem de 30% para pegar testa e queixo
		ret := image.Rect(a.Col-meio, a.Row-meio, a.Col+meio, a.Row+meio).Intersect(image.Rect(0, 0, w, h))
		if !ret.Empty() {
			regioes = append(regioes, Regiao{ret, "rosto"})
		}
	}
	return regioes, nil
}

// detectarPlacas procura retângulos largos, claros ou cinzas, pouco
// coloridos e cheios de traços verticais, que é como uma placa aparece numa
// foto. É heurística: erra para o lado de borrar a mais (letreiros, grades).
func detectarPlacas(img *image.RGBA, cinza []uint8) []Regiao {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	if w < 120 || h < 60 {
		return nil
	}
	// Imagens integrais: traços verticais, pixels pouco saturados, soma e
	// soma dos quadrados do cinza (para o contraste).
	larg := w + 1
	iBorda := make([]int32, larg*(h+1))
	iNeutro := make([]int32, larg*(h+1))
	// Placa é fundo claro com letras escuras: conta os dois.
	iClaro := make([]int32, larg*(h+1))
	iEscuro := make([]int32, larg*(h+1))
	iSoma := make([]int64, larg*(h+1))
	iQuad := make([]int64, larg*(h+1))
	for y := 0; y < h; y++ {
		var b, n, cl, es int32
		var s, q int64
		for x := 0; x < w; x++ {
			if x > 0 && x < w-1 {
				d := int(cinza[y*w+x+1]) - int(cinza[y*w+x-1])
				if d > 48 || d < -48 {
					b++
				}
			}
			p := img.Pix[y*img.Stride+x*4:]
			mx, mn := max(p[0], p[1], p[2]), min(p[0], p[1], p[2])
			if int(mx)-int(mn) < 42 {
				n++
			}
			if c := cinza[y*w+x]; c > 160 {
				cl++
			} else if c < 90 {
				es++
			}
			v := int64(cinza[y*w+x])
			s += v
			q += v * v
			i := (y+1)*larg + x + 1
			iBorda[i] = iBorda[i-larg] + b
			iNeutro[i] = iNeutro[i-larg] + n
			iClaro[i] = iClaro[i-larg] + cl
			iEscuro[i] = iEscuro[i-larg] + es
			iSoma[i] = iSoma[i-larg] + s
			iQuad[i] = iQuad[i-larg] + q
		}
	}
	area32 := func(t []int32, r image.Rectangle) int32 {
		return t[r.Max.Y*larg+r.Max.X] - t[r.Min.Y*larg+r.Max.X] - t[r.Max.Y*larg+r.Min.X] + t[r.Min.Y*larg+r.Min.X]
	}
	area64 := func(t []int64, r image.Rectangle) int64 {
		return t[r.Max.Y*larg+r.Max.X] - t[r.Min.Y*larg+r.Max.X] - t[r.Max.Y*larg+r.Min.X] + t[r.Min.Y*larg+r.Min.X]
	}

	var candidatas []image.Rectangle
	for _, fracao := range []float64{0.05, 0.075, 0.11, 0.16, 0.24, 0.34} {
		pw := int(float64(w) * fracao)
		ph := pw * 10 / 32 // placa brasileira: 40 x 13 cm
		if pw < 40 || ph < 12 || ph >= h {
			continue
		}
		for y := 0; y+ph <= h; y += max(2, ph/4) {
			for x := 0; x+pw <= w; x += max(2, pw/8) {
				r := image.Rect(x, y, x+pw, y+ph)
				n := float64(pw * ph)
				densidade := float64(area32(iBorda, r)) / n
				if densidade < 0.10 || densidade > 0.55 {
					continue
				}
				if float64(area32(iNeutro, r))/n < 0.75 {
					continue
				}
				// Céu e parede clara quase não têm escuro; saco de lixo e
				// asfalto quase não têm claro. Placa tem os dois.
				claro, escuro := float64(area32(iClaro, r))/n, float64(area32(iEscuro, r))/n
				if claro < 0.40 || claro > 0.88 || escuro < 0.08 || escuro > 0.50 {
					continue
				}
				media := float64(area64(iSoma, r)) / n
				desvio2 := float64(area64(iQuad, r))/n - media*media
				if desvio2 < 45*45 {
					continue // sem contraste de letra escura em fundo claro
				}
				// Os traços precisam atravessar a largura toda, como os
				// sete caracteres de uma placa.
				fatias, cheias := 6, 0
				for k := 0; k < fatias; k++ {
					f := image.Rect(x+pw*k/fatias, y, x+pw*(k+1)/fatias, y+ph)
					if float64(area32(iBorda, f))/float64(f.Dx()*f.Dy()) > 0.06 {
						cheias++
					}
				}
				if cheias < fatias {
					continue
				}
				candidatas = append(candidatas, r)
			}
		}
	}

	// Junta as janelas que se tocam e aplica margem.
	var regioes []Regiao
	usada := make([]bool, len(candidatas))
	for i := range candidatas {
		if usada[i] {
			continue
		}
		u := candidatas[i]
		usada[i] = true
		for mudou := true; mudou; {
			mudou = false
			for j := range candidatas {
				if !usada[j] && candidatas[j].Overlaps(u) {
					u = u.Union(candidatas[j])
					usada[j], mudou = true, true
				}
			}
		}
		// Placa é um retângulo pequeno e deitado (40 x 13 cm). Junções
		// grandes ou quadradas são textura (respingo d'água, paralelepípedo,
		// asfalto rachado) e borrá-las apagaria o próprio problema da foto.
		if !formaDePlaca(u, w, h) {
			continue
		}
		u = u.Inset(-u.Dy() / 4).Intersect(image.Rect(0, 0, w, h))
		regioes = append(regioes, Regiao{u, "placa"})
	}
	return regioes
}

// borrarRegiao troca a região por um mosaico grosso suavizado: reduz a
// poucos blocos e amplia de volta, o que apaga traços e feições.
func borrarRegiao(img *image.RGBA, r image.Rectangle) {
	r = r.Intersect(img.Bounds())
	if r.Empty() {
		return
	}
	blocos := 5
	pw := max(2, blocos)
	ph := max(2, blocos*r.Dy()/max(1, r.Dx()))
	pequena := image.NewRGBA(image.Rect(0, 0, pw, ph))
	draw.ApproxBiLinear.Scale(pequena, pequena.Bounds(), img, r, draw.Src, nil)
	draw.BiLinear.Scale(img, r, pequena, pequena.Bounds(), draw.Src, nil)
}

// Limites da forma de uma placa depois de juntar as janelas candidatas. A
// proporção cobre a placa vista de frente ou um pouco de lado; a área cobre
// do carro distante ao close da traseira. Valores a calibrar com fotos reais.
const (
	placaProporcaoMin = 1.8
	placaProporcaoMax = 6.0
	placaAreaMax      = 0.05 // fração da foto
)

func formaDePlaca(r image.Rectangle, w, h int) bool {
	if r.Dy() == 0 {
		return false
	}
	proporcao := float64(r.Dx()) / float64(r.Dy())
	area := float64(r.Dx()*r.Dy()) / float64(w*h)
	return proporcao >= placaProporcaoMin && proporcao <= placaProporcaoMax && area <= placaAreaMax
}
