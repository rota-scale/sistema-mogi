package triagem

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go/v2"
)

// instrucaoDeCena: uma palavra, e na dúvida entre lugar público e interior
// vale interior (privacidade primeiro).
const instrucaoDeCena = `Você classifica fotos que moradores enviam para registrar problemas urbanos.
Responda com UMA palavra só, sem pontuação:
- publico: rua, calçada, praça, via, terreno, muro ou fachada vistos da rua, lugar aberto ao público.
- interior: dentro de casa ou de um prédio: quarto, sala, cozinha, banheiro, garagem, cômodo.
- pessoal: pessoa em destaque, selfie, retrato, documento ou objeto pessoal em primeiro plano.
- intimo: nudez, roupa íntima ou conteúdo sexual ou sensível.
Na dúvida entre publico e interior, responda interior.`

// Cena pergunta à IA com visão em que tipo de lugar a foto foi tirada. Só a
// foto vai no pedido: nada de nome, CPF ou relato.
func (ia *IA) Cena(ctx context.Context, dados []byte) (string, error) {
	tipo := http.DetectContentType(dados)
	if tipo != "image/jpeg" && tipo != "image/png" {
		return "", fmt.Errorf("formato de foto sem classificação: %s", tipo)
	}
	params := anthropic.BetaMessageNewParams{
		Model:     anthropic.Model(ia.modelo),
		MaxTokens: 16,
		System:    []anthropic.BetaTextBlockParam{{Text: instrucaoDeCena}},
		Messages: []anthropic.BetaMessageParam{anthropic.NewBetaUserMessage(
			anthropic.NewBetaImageBlock(anthropic.BetaBase64ImageSourceParam{
				Data:      base64.StdEncoding.EncodeToString(dados),
				MediaType: anthropic.BetaBase64ImageSourceMediaType(tipo),
			}),
			anthropic.NewBetaTextBlock("Qual é a categoria desta foto?"),
		)},
	}
	resp, err := ia.cli.Beta.Messages.New(ctx, params)
	if err != nil {
		return "", fmt.Errorf("IA indisponível para conferir a foto: %w", err)
	}
	var texto string
	for _, b := range resp.Content {
		if t, ok := b.AsAny().(anthropic.BetaTextBlock); ok {
			texto += t.Text
		}
	}
	return categoriaDeCena(texto), nil
}

// categoriaDeCena lê a resposta do modelo. Qualquer coisa fora das quatro
// categorias conhecidas vira "outro", que é recusado.
func categoriaDeCena(texto string) string {
	t := strings.ToLower(strings.TrimSpace(texto))
	for _, c := range []string{"publico", "interior", "pessoal", "intimo"} {
		if strings.HasPrefix(t, c) {
			return c
		}
	}
	return "outro"
}
