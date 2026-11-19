package midia

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
)

// InfoVideo é o que se lê do contêiner sem decodificar o vídeo: o servidor
// não tem ffmpeg (a imagem é distroless), então só confere o formato, a
// duração declarada e se veio trilha de áudio.
type InfoVideo struct {
	Mime      string // video/mp4, video/quicktime ou video/webm
	Extensao  string
	DuracaoMS int64 // 0 quando o arquivo não declara (gravação do navegador)
	TemAudio  bool
}

var (
	ErrVideoInvalido = errors.New("vídeo inválido: envie MP4 ou WebM")
	ErrVideoComAudio = errors.New("o vídeo veio com áudio")
)

// InspecionarVideo identifica o contêiner pelo começo do arquivo e percorre
// a estrutura para achar duração e trilha de áudio. O áudio é recusado por
// decisão de privacidade (ADR 0015): vozes de quem passa não entram no MOGI.
func InspecionarVideo(r io.ReadSeeker, tamanho int64) (InfoVideo, error) {
	cabeca := make([]byte, 64<<10)
	n, _ := io.ReadFull(r, cabeca)
	cabeca = cabeca[:n]
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return InfoVideo{}, err
	}
	switch {
	case len(cabeca) >= 12 && string(cabeca[4:8]) == "ftyp":
		info := InfoVideo{Mime: "video/mp4", Extensao: "mp4"}
		if string(cabeca[8:12]) == "qt  " {
			info.Mime, info.Extensao = "video/quicktime", "mov"
		}
		if err := percorrerMP4(r, 0, tamanho, 0, &info); err != nil {
			return InfoVideo{}, ErrVideoInvalido
		}
		_, err := r.Seek(0, io.SeekStart)
		return info, err
	case len(cabeca) >= 4 && bytes.Equal(cabeca[:4], []byte{0x1A, 0x45, 0xDF, 0xA3}):
		// WebM é EBML. Os nomes dos codecs das trilhas ficam no começo.
		info := InfoVideo{Mime: "video/webm", Extensao: "webm"}
		for _, audio := range []string{"A_OPUS", "A_VORBIS", "A_AAC"} {
			if bytes.Contains(cabeca, []byte(audio)) {
				info.TemAudio = true
			}
		}
		return info, nil
	}
	return InfoVideo{}, ErrVideoInvalido
}

// percorrerMP4 anda pelas caixas (tamanho + tipo) entre inicio e fim. Entra
// só nas caixas que levam ao cabeçalho do filme e ao tipo de cada trilha.
func percorrerMP4(r io.ReadSeeker, inicio, fim int64, nivel int, info *InfoVideo) error {
	if nivel > 6 {
		return nil
	}
	pos := inicio
	var cab [16]byte
	for caixas := 0; pos+8 <= fim && caixas < 4096; caixas++ {
		if _, err := r.Seek(pos, io.SeekStart); err != nil {
			return err
		}
		if _, err := io.ReadFull(r, cab[:8]); err != nil {
			return nil // arquivo cortado: fica com o que já leu
		}
		tam := int64(binary.BigEndian.Uint32(cab[:4]))
		tipo := string(cab[4:8])
		corpo := pos + 8
		switch tam {
		case 0: // vai até o fim do arquivo
			tam = fim - pos
		case 1: // tamanho de 64 bits logo depois
			if _, err := io.ReadFull(r, cab[8:16]); err != nil {
				return nil
			}
			tam = int64(binary.BigEndian.Uint64(cab[8:16]))
			corpo = pos + 16
		}
		if tam < corpo-pos || pos+tam > fim {
			return errors.New("caixa com tamanho incoerente")
		}
		switch tipo {
		case "moov", "trak", "mdia":
			if err := percorrerMP4(r, corpo, pos+tam, nivel+1, info); err != nil {
				return err
			}
		case "mvhd":
			lerDuracaoMP4(r, corpo, info)
		case "hdlr":
			// versão e flags (4), pré-definido (4), tipo da trilha (4).
			var h [12]byte
			if _, err := r.Seek(corpo, io.SeekStart); err == nil {
				if _, err := io.ReadFull(r, h[:]); err == nil && string(h[8:12]) == "soun" {
					info.TemAudio = true
				}
			}
		}
		pos += tam
	}
	return nil
}

func lerDuracaoMP4(r io.ReadSeeker, corpo int64, info *InfoVideo) {
	var b [32]byte
	if _, err := r.Seek(corpo, io.SeekStart); err != nil {
		return
	}
	if _, err := io.ReadFull(r, b[:]); err != nil {
		return
	}
	var escala, duracao uint64
	if b[0] == 1 { // versão 1: datas e duração em 64 bits
		escala = uint64(binary.BigEndian.Uint32(b[20:24]))
		duracao = binary.BigEndian.Uint64(b[24:32])
	} else {
		escala = uint64(binary.BigEndian.Uint32(b[12:16]))
		duracao = uint64(binary.BigEndian.Uint32(b[16:20]))
	}
	if escala > 0 && duracao < 1<<40 {
		info.DuracaoMS = int64(duracao * 1000 / escala)
	}
}
