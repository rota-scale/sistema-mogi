package midia

import (
	"bytes"
	"encoding/binary"
	"errors"
	"testing"
)

func caixa(tipo string, corpo ...[]byte) []byte {
	c := bytes.Join(corpo, nil)
	b := make([]byte, 8, 8+len(c))
	binary.BigEndian.PutUint32(b, uint32(8+len(c)))
	copy(b[4:], tipo)
	return append(b, c...)
}

func mvhd(escala, duracao uint32) []byte {
	b := make([]byte, 100)
	binary.BigEndian.PutUint32(b[12:], escala)
	binary.BigEndian.PutUint32(b[16:], duracao)
	return caixa("mvhd", b)
}

func trilha(tipo string) []byte {
	h := make([]byte, 24)
	copy(h[8:], tipo)
	return caixa("trak", caixa("mdia", caixa("hdlr", h)))
}

func mp4(marca string, trilhas ...[]byte) []byte {
	ftyp := caixa("ftyp", []byte(marca), []byte{0, 0, 0, 0})
	moov := caixa("moov", append([][]byte{mvhd(1000, 12500)}, trilhas...)...)
	// O mdat vem antes do moov, como na gravação de celular, e contém a
	// palavra "soun" de propósito: dado comprimido não pode confundir.
	return bytes.Join([][]byte{ftyp, caixa("mdat", []byte("xxxxsounxxxx")), moov}, nil)
}

func TestInspecionaMP4SemAudio(t *testing.T) {
	dados := mp4("mp42", trilha("vide"))
	info, err := InspecionarVideo(bytes.NewReader(dados), int64(len(dados)))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mime != "video/mp4" || info.Extensao != "mp4" || info.DuracaoMS != 12500 || info.TemAudio {
		t.Fatalf("leitura errada: %+v", info)
	}
}

func TestInspecionaMP4ComAudio(t *testing.T) {
	dados := mp4("qt  ", trilha("vide"), trilha("soun"))
	info, err := InspecionarVideo(bytes.NewReader(dados), int64(len(dados)))
	if err != nil {
		t.Fatal(err)
	}
	if !info.TemAudio || info.Mime != "video/quicktime" {
		t.Fatalf("deveria achar o áudio num .mov: %+v", info)
	}
}

func TestInspecionaWebM(t *testing.T) {
	semAudio := append([]byte{0x1A, 0x45, 0xDF, 0xA3}, []byte("....webm....V_VP8....")...)
	info, err := InspecionarVideo(bytes.NewReader(semAudio), int64(len(semAudio)))
	if err != nil || info.Mime != "video/webm" || info.TemAudio {
		t.Fatalf("webm sem áudio: %+v %v", info, err)
	}
	comAudio := append(semAudio, []byte("A_OPUS")...)
	info, _ = InspecionarVideo(bytes.NewReader(comAudio), int64(len(comAudio)))
	if !info.TemAudio {
		t.Fatal("deveria achar o áudio no webm")
	}
}

func TestRecusaOQueNaoEVideo(t *testing.T) {
	for _, dados := range [][]byte{[]byte("isto não é vídeo, de jeito nenhum"), {}, []byte("\xff\xd8\xff\xe0 jpeg")} {
		if _, err := InspecionarVideo(bytes.NewReader(dados), int64(len(dados))); !errors.Is(err, ErrVideoInvalido) {
			t.Fatalf("esperava ErrVideoInvalido para %q, veio %v", dados, err)
		}
	}
	// Caixa que diz ser maior que o arquivo.
	ruim := mp4("mp42", trilha("vide"))
	binary.BigEndian.PutUint32(ruim[len(ruim)-200:], 1<<30)
	_, _ = InspecionarVideo(bytes.NewReader(ruim), int64(len(ruim))) // não pode travar nem estourar
}
