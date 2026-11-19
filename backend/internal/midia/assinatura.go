package midia

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Assinador emite e confere os links temporários de mídia. O navegador não
// manda o JWT num <img> nem num <video>, então o link carrega validade e
// assinatura HMAC. Há dois tipos de link (ADR 0015):
//
//   - público: só versões já borradas (foto, quadro de vídeo, foto do
//     depois). É o que a lista e o detalhe do chamado usam.
//   - restrito: a mídia original, hoje só o vídeo. É emitido um por vez, a
//     pedido de um servidor logado, com validade curta e registro de quem
//     abriu. A foto original nunca tem link.
type Assinador struct {
	Segredo []byte
	Agora   func() time.Time
}

var ErrLinkInvalido = errors.New("link de mídia inválido ou vencido")

// nomePublico reconhece os arquivos que podem sair num link público.
var nomePublico = regexp.MustCompile(`^(publica(-\d{1,2})?|quadro-\d{1,2}|depois(-\d{1,2})?)\.jpg$`)

// nomeRestrito reconhece o que pode sair num link restrito: só o vídeo.
var nomeRestrito = regexp.MustCompile(`^video\.(mp4|mov|webm)$`)

// EPublica diz se a chave é de uma versão borrada.
func EPublica(chave string) bool { return nomePublico.MatchString(path.Base(chave)) }

func (a Assinador) agora() time.Time {
	if a.Agora != nil {
		return a.Agora()
	}
	return time.Now()
}

func (a Assinador) mac(rotulo, chave string, exp int64) string {
	m := hmac.New(sha256.New, a.Segredo)
	m.Write([]byte(rotulo + "\n" + chave + "\n" + strconv.FormatInt(exp, 10)))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// Consulta devolve a query string do link público (c, exp e s) para a chave.
func (a Assinador) Consulta(chave string, validade time.Duration) string {
	exp := a.agora().Add(validade).Unix()
	return url.Values{"c": {chave}, "exp": {strconv.FormatInt(exp, 10)}, "s": {a.mac("midia", chave, exp)}}.Encode()
}

// ConsultaRestrita devolve a query string de um link para a mídia original.
func (a Assinador) ConsultaRestrita(chave string, validade time.Duration) string {
	exp := a.agora().Add(validade).Unix()
	return url.Values{"c": {chave}, "exp": {strconv.FormatInt(exp, 10)}, "r": {"1"},
		"s": {a.mac("restrita", chave, exp)}}.Encode()
}

// Conferir valida a consulta e devolve a chave do objeto e se o link é restrito.
func (a Assinador) Conferir(q url.Values) (chave string, restrita bool, err error) {
	chave = q.Get("c")
	restrita = q.Get("r") == "1"
	exp, errExp := strconv.ParseInt(q.Get("exp"), 10, 64)
	if errExp != nil || chave == "" || strings.Contains(chave, "..") || strings.HasPrefix(chave, "/") {
		return "", false, ErrLinkInvalido
	}
	rotulo := "midia"
	switch {
	case restrita && nomeRestrito.MatchString(path.Base(chave)):
		rotulo = "restrita"
	case restrita, !EPublica(chave):
		return "", false, ErrLinkInvalido
	}
	if a.agora().Unix() > exp || !hmac.Equal([]byte(a.mac(rotulo, chave, exp)), []byte(q.Get("s"))) {
		return "", false, ErrLinkInvalido
	}
	return chave, restrita, nil
}
