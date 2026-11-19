// Package imagem decodifica fotos com um teto de tamanho. Toda foto que vem
// de fora passa por aqui antes de virar pixels na memória.
package imagem

import (
	"bytes"
	"errors"
	"image"
	_ "image/jpeg" // formatos aceitos na entrada
	_ "image/png"
)

// PixelsMaximos é o teto de largura x altura. Uma foto de celular reduzida
// pelo app tem 2 a 3 megapixels; 40 cobre a câmera sem redução. Acima disso
// um arquivo de poucos KB pode pedir gigabytes de memória ao ser aberto.
const PixelsMaximos = 40_000_000

var (
	ErrInvalida = errors.New("imagem inválida: envie JPEG ou PNG")
	ErrGrande   = errors.New("imagem grande demais")
)

// Conferir lê só o cabeçalho e recusa o que não é imagem ou passa do teto.
func Conferir(dados []byte) (image.Config, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(dados))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return cfg, ErrInvalida
	}
	if int64(cfg.Width)*int64(cfg.Height) > PixelsMaximos {
		return cfg, ErrGrande
	}
	return cfg, nil
}

// Decodificar abre a imagem depois de conferir o tamanho.
func Decodificar(dados []byte) (image.Image, error) {
	if _, err := Conferir(dados); err != nil {
		return nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(dados))
	if err != nil {
		return nil, ErrInvalida
	}
	return img, nil
}
