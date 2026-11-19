package triagem

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/image/draw"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/imagem"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/texto"
)

// Jev é o adaptador do Jev, da TypeSafe AI (ADR 0007), pela API HTTP
// POST /v1/systemone. Não há SDK em Go; o formato segue o SDK oficial em
// JavaScript (@typesafe-ai/sdk 0.7.0).
//
// Num pedido só o Jev responde a categoria, se há mesmo um problema urbano,
// um sim ou não por sinal de risco e as distribuições de G, U e T. A regra
// Lua da prefeitura continua decidindo o nível.
//
// Privacidade (C6): vão o relato já sem telefone, CPF, e-mail e placa, a
// categoria escolhida, o bairro, a descrição da foto e, com JEV_FOTO, a foto
// já borrada (liberado pelo Russo em 12/11/2026). Nunca a foto original, a
// coordenada ou quem relatou.
type Jev struct {
	chave   string
	base    string
	modelo  string
	comFoto bool
	cambio  float64
	cli     *http.Client
}

// ConfigJev reúne o que o adaptador precisa. A chave vem do ambiente
// (TYPESAFE_API_KEY), nunca do Git.
type ConfigJev struct {
	Chave   string
	Base    string // padrão https://api.typesafe.ai
	Modelo  string // padrão jev-latest
	ComFoto bool   // manda a foto borrada (imagens são experimentais na TypeSafe)
	Cambio  float64
	Cliente *http.Client
}

func NovoJev(c ConfigJev) *Jev {
	j := &Jev{chave: c.Chave, base: strings.TrimRight(c.Base, "/"), modelo: c.Modelo, comFoto: c.ComFoto, cambio: c.Cambio, cli: c.Cliente}
	if j.base == "" {
		j.base = "https://api.typesafe.ai"
	}
	if j.modelo == "" {
		j.modelo = "jev-latest"
	}
	if j.cambio <= 0 {
		j.cambio = 5.5
	}
	if j.cli == nil {
		j.cli = &http.Client{Timeout: 10 * time.Second}
	}
	return j
}

func (j *Jev) Nome() string { return j.modelo }

// ComFoto diz se o Jev recebe a foto e pode servir de etapa de visão.
func (j *Jev) ComFoto() bool { return j.comFoto }

// precoJevUSD é o preço por milhão de tokens de entrada; a saída é grátis
// (post de lançamento da TypeSafe, 15/09/2026). A confirmar na conta.
const precoJevUSD = 0.042

// referenciaFoto é como a foto aparece no texto do pedido.
const referenciaFoto = "<foto>"

type perguntaJev struct {
	Tipo      string `json:"type"`
	Instrucao string `json:"instructions,omitempty"`
	Criterios any    `json:"criteria,omitempty"`
}

type pedidoJev struct {
	Estado    map[string]any         `json:"state"`
	Perguntas map[string]perguntaJev `json:"questions"`
	Modelo    string                 `json:"model"`
	Assets    map[string]assetJev    `json:"assets,omitempty"`
}

type assetJev struct {
	Tipo  string `json:"type"`
	Parte string `json:"part"`
}

// montarPedido monta o estado e as perguntas. Campos vazios ficam de fora:
// para o modelo, um campo vazio também é sinal.
func (j *Jev) montarPedido(e Entrada, comFoto bool) pedidoJev {
	estado := map[string]any{
		"cidade": "Itamogi-MG, cidade pequena do interior de Minas Gerais",
	}
	if nome := criteriosCategoria[e.Categoria]; nome != "" && e.Categoria != "outros" {
		estado["categoria_escolhida_pelo_morador"] = nome
	}
	if e.Texto != "" {
		estado["relato_do_morador"] = e.Texto
	}
	if e.Bairro != "" {
		estado["bairro"] = e.Bairro
	}
	if d := e.Descricao; d != nil && d.Resumo != "" {
		estado["descricao_da_foto"] = d.Resumo
	}
	// Contexto recuperado (RAG, ADR 0023): critério da prefeitura e casos
	// parecidos, já sem dado pessoal nem coordenada.
	if t := e.Contexto.Texto(1200); t != "" {
		estado["contexto_da_prefeitura"] = t
	}
	if comFoto {
		estado["foto"] = referenciaFoto
	}

	perguntas := map[string]perguntaJev{
		"categoria": {Tipo: "choice", Instrucao: perguntaCategoria, Criterios: criteriosCategoria},
		"ha_problema": {Tipo: "noul", Instrucao: perguntaHaProblema, Criterios: map[string]string{
			"true": criteriosHaProblema[0], "false": criteriosHaProblema[1],
		}},
		"local_publico": {Tipo: "noul", Instrucao: perguntaLocalPublico},
		"gravidade":     {Tipo: "score", Instrucao: perguntaGravidade, Criterios: criteriosGravidade},
		"urgencia":      {Tipo: "score", Instrucao: perguntaUrgencia, Criterios: criteriosUrgencia},
		"tendencia":     {Tipo: "score", Instrucao: perguntaTendencia, Criterios: criteriosTendencia},
	}
	for sinal, texto := range perguntasSinais {
		perguntas["sinal_"+sinal] = perguntaJev{Tipo: "noul", Instrucao: texto}
	}
	p := pedidoJev{Estado: estado, Perguntas: perguntas, Modelo: j.modelo}
	if comFoto {
		p.Assets = map[string]assetJev{referenciaFoto: {Tipo: "image", Parte: "asset-0"}}
	}
	return p
}

type respostaJev struct {
	Modelo    string                     `json:"model"`
	Respostas map[string]json.RawMessage `json:"answers"`
	Uso       struct {
		Entrada *int `json:"input_tokens"`
		Saida   *int `json:"output_tokens"`
	} `json:"usage"`
}

type respostaEscolha struct {
	Tipo          string             `json:"type"`
	Escolha       string             `json:"choice"`
	Probabilidade map[string]float64 `json:"probabilities"`
}

type respostaSimNao struct {
	Tipo string   `json:"type"`
	Sim  *float64 `json:"noul"`
}

type respostaNota struct {
	Tipo          string             `json:"type"`
	Probabilidade map[string]float64 `json:"probabilities"`
}

// ErroJev é uma resposta da API fora de 2xx. Uma falha nunca vira resposta:
// ela aciona o próximo classificador da cadeia (RF12).
type ErroJev struct {
	Status int
	Corpo  string
}

func (e *ErroJev) Error() string {
	return fmt.Sprintf("Jev respondeu %d: %s", e.Status, e.Corpo)
}

// Limites de imagem do Jev (docs.typesafe.ai/images.md): cada lado entre
// 280 e 1568 pixels. A API recusa a imagem fora disso, sem redimensionar.
const (
	ladoMinimoJev = 280
	ladoMaximoJev = 1568
)

// ajustarFotoJev reduz a foto para caber nos limites do Jev. Devolve falso
// quando não há como caber (foto pequena demais ou panorâmica demais): o
// pedido segue então só com texto.
func ajustarFotoJev(dados []byte) ([]byte, bool) {
	img, err := imagem.Decodificar(dados)
	if err != nil {
		return nil, false
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if max(w, h) <= ladoMaximoJev {
		return dados, min(w, h) >= ladoMinimoJev
	}
	escala := float64(ladoMaximoJev) / float64(max(w, h))
	nw, nh := int(float64(w)*escala), int(float64(h)*escala)
	if min(nw, nh) < ladoMinimoJev {
		return nil, false
	}
	menor := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(menor, menor.Bounds(), img, b, draw.Src, nil)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, menor, &jpeg.Options{Quality: 85}); err != nil {
		return nil, false
	}
	return buf.Bytes(), true
}

// errFotoForaDoLimite avisa que a foto não cabe nos limites do Jev.
var errFotoForaDoLimite = errors.New("foto fora dos limites de tamanho do Jev")

// perguntar envia o pedido e devolve a resposta crua e o uso. Tenta de novo
// uma vez em 429 e 5xx; o resto da resiliência é a cadeia de fallback.
// exigirFoto faz a chamada falhar quando a foto não pode ir junto.
func (j *Jev) perguntar(ctx context.Context, e Entrada, exigirFoto bool) (respostaJev, Uso, error) {
	comFoto := j.comFoto && len(e.Foto) > 0
	if comFoto {
		if foto, ok := ajustarFotoJev(e.Foto); ok {
			e.Foto = foto
		} else {
			comFoto = false
		}
	}
	if exigirFoto && !comFoto {
		return respostaJev{}, Uso{}, errFotoForaDoLimite
	}
	p := j.montarPedido(e, comFoto)
	corpo, tipo, err := j.codificar(p, e.Foto, comFoto)
	if err != nil {
		return respostaJev{}, Uso{}, err
	}
	var ultimo error
	for tentativa := 0; tentativa < 2; tentativa++ {
		if tentativa > 0 {
			select {
			case <-ctx.Done():
				return respostaJev{}, Uso{}, ctx.Err()
			case <-time.After(300 * time.Millisecond):
			}
		}
		r, err := j.enviar(ctx, corpo, tipo, comFoto, tentativa)
		var ej *ErroJev
		if errors.As(err, &ej) && (ej.Status == http.StatusTooManyRequests || ej.Status >= 500) {
			ultimo = err
			continue
		}
		if err != nil {
			return respostaJev{}, Uso{}, err
		}
		uso := Uso{}
		if r.Uso.Entrada != nil {
			uso.TokensEntrada = *r.Uso.Entrada
		}
		if r.Uso.Saida != nil {
			uso.TokensSaida = *r.Uso.Saida
		}
		uso.CustoBRL = float64(uso.TokensEntrada) * precoJevUSD / 1e6 * j.cambio
		return r, uso, nil
	}
	return respostaJev{}, Uso{}, ultimo
}

// codificar devolve JSON, ou multipart quando a foto vai junto: a primeira
// parte, "request", é o JSON; a foto segue na parte que o JSON nomeia.
func (j *Jev) codificar(p pedidoJev, foto []byte, comFoto bool) ([]byte, string, error) {
	js, err := json.Marshal(p)
	if err != nil {
		return nil, "", err
	}
	if !comFoto {
		return js, "application/json", nil
	}
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", `form-data; name="request"`)
	h.Set("Content-Type", "application/json")
	parte, err := w.CreatePart(h)
	if err != nil {
		return nil, "", err
	}
	if _, err := parte.Write(js); err != nil {
		return nil, "", err
	}
	h = textproto.MIMEHeader{}
	h.Set("Content-Disposition", `form-data; name="asset-0"; filename="asset-0"`)
	h.Set("Content-Type", http.DetectContentType(foto))
	if parte, err = w.CreatePart(h); err != nil {
		return nil, "", err
	}
	if _, err := parte.Write(foto); err != nil {
		return nil, "", err
	}
	if err := w.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), w.FormDataContentType(), nil
}

func (j *Jev) enviar(ctx context.Context, corpo []byte, tipo string, comFoto bool, tentativa int) (respostaJev, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, j.base+"/v1/systemone", bytes.NewReader(corpo))
	if err != nil {
		return respostaJev{}, err
	}
	req.Header.Set("Authorization", "Bearer "+j.chave)
	req.Header.Set("Content-Type", tipo)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "sistema-mogi")
	if comFoto {
		// Imagens são experimentais na TypeSafe e pedem este cabeçalho.
		req.Header.Set("TypeSafe-Danger-Zone-Images", "true")
	}
	if tentativa > 0 {
		req.Header.Set("X-TypeSafe-Retry-Count", strconv.Itoa(tentativa))
	}
	resp, err := j.cli.Do(req)
	if err != nil {
		return respostaJev{}, fmt.Errorf("Jev indisponível: %w", err)
	}
	defer resp.Body.Close()
	dados, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return respostaJev{}, fmt.Errorf("Jev: resposta interrompida: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		trecho := strings.TrimSpace(string(dados))
		trecho = texto.Cortar(trecho, 200)
		return respostaJev{}, &ErroJev{Status: resp.StatusCode, Corpo: trecho}
	}
	var r respostaJev
	if err := json.Unmarshal(dados, &r); err != nil {
		return respostaJev{}, errors.New("Jev devolveu resposta fora do formato")
	}
	return r, nil
}

func lerResposta[T any](r respostaJev, nome, tipo string) (T, error) {
	var v T
	cru, ok := r.Respostas[nome]
	if !ok {
		return v, fmt.Errorf("Jev não respondeu a pergunta %s", nome)
	}
	var cab struct {
		Tipo string `json:"type"`
	}
	if err := json.Unmarshal(cru, &cab); err != nil || cab.Tipo != tipo {
		return v, fmt.Errorf("Jev respondeu %s com tipo inesperado", nome)
	}
	if err := json.Unmarshal(cru, &v); err != nil {
		return v, fmt.Errorf("Jev respondeu %s fora do formato", nome)
	}
	return v, nil
}

// distribuicao lê as probabilidades de uma nota, indexadas de "0" a "4".
func distribuicao(n respostaNota) (Distribuicao, error) {
	var d Distribuicao
	for i := range d {
		p, ok := n.Probabilidade[strconv.Itoa(i)]
		if !ok {
			return d, errors.New("Jev devolveu nota sem as cinco probabilidades")
		}
		d[i] = p
	}
	return d, nil
}

// converter transforma as respostas em Classificacao. Toda pergunta faltando
// ou fora do formato é falha, nunca um "não".
func (j *Jev) converter(r respostaJev) (Classificacao, *float64, error) {
	cat, err := lerResposta[respostaEscolha](r, "categoria", "choice")
	if err != nil {
		return Classificacao{}, nil, err
	}
	if _, ok := criteriosCategoria[cat.Escolha]; !ok {
		return Classificacao{}, nil, fmt.Errorf("Jev escolheu categoria fora da lista: %s", cat.Escolha)
	}
	c := Classificacao{
		Categoria: cat.Escolha,
		// A confiança que a regra Lua usa é a probabilidade de a categoria
		// estar certa, não a concentração da distribuição.
		Confianca: cat.Probabilidade[cat.Escolha],
		Sinais:    map[string]float64{},
		Provedor:  r.Modelo,
	}
	if c.Provedor == "" {
		c.Provedor = j.modelo
	}
	for nome, campo := range map[string]*Distribuicao{"gravidade": &c.G, "urgencia": &c.U, "tendencia": &c.T} {
		n, err := lerResposta[respostaNota](r, nome, "score")
		if err != nil {
			return Classificacao{}, nil, err
		}
		if *campo, err = distribuicao(n); err != nil {
			return Classificacao{}, nil, err
		}
	}
	// Só os sinais que valem para a categoria escolhida entram na regra.
	for _, sinal := range SinaisDe(c.Categoria) {
		s, err := lerResposta[respostaSimNao](r, "sinal_"+sinal, "noul")
		if err != nil {
			return Classificacao{}, nil, err
		}
		if s.Sim == nil {
			return Classificacao{}, nil, fmt.Errorf("Jev respondeu sinal_%s sem probabilidade", sinal)
		}
		c.Sinais[sinal] = *s.Sim
	}
	hp, err := lerResposta[respostaSimNao](r, "ha_problema", "noul")
	if err != nil {
		return Classificacao{}, nil, err
	}
	if hp.Sim == nil {
		return Classificacao{}, nil, errors.New("Jev respondeu ha_problema sem probabilidade")
	}
	// local_publico é a pergunta mais nova: se faltar, a triagem segue sem
	// ela, como antes, em vez de derrubar a classificação inteira.
	if lp, err := lerResposta[respostaSimNao](r, "local_publico", "noul"); err == nil && lp.Sim != nil {
		c.LocalPublico = lp.Sim
	}
	return c, hp.Sim, nil
}

// Classificar é a etapa 2 (RF05). Se o próprio Jev já fez a etapa de visão
// neste relato, reaproveita a decisão sem nova chamada.
func (j *Jev) Classificar(ctx context.Context, e Entrada) (Classificacao, error) {
	if d := e.Descricao; d != nil && d.Sugestao != nil && d.origem == j {
		return *d.Sugestao, nil
	}
	r, uso, err := j.perguntar(ctx, e, false)
	if err != nil {
		return Classificacao{Provedor: j.modelo, Uso: uso}, err
	}
	c, problema, err := j.converter(r)
	if err != nil {
		return Classificacao{Provedor: j.modelo, Uso: uso}, err
	}
	c.Uso, c.ProblemaUrbano = uso, problema
	return c, nil
}

// Descrever faz do Jev a etapa de visão quando ele recebe a foto (JEV_FOTO)
// e não há outro modelo de visão. O Jev não escreve texto, então o resumo
// fica vazio e a decisão vai junto para a etapa 2.
func (j *Jev) Descrever(ctx context.Context, e Entrada) (Descricao, Uso, error) {
	d := Descricao{Provedor: j.modelo + " (foto)"}
	if !j.comFoto || len(e.Foto) == 0 {
		return d, Uso{}, errors.New("Jev sem foto não faz a etapa de visão")
	}
	r, uso, err := j.perguntar(ctx, e, true)
	if err != nil {
		return d, uso, err
	}
	c, problema, err := j.converter(r)
	if err != nil {
		return d, uso, err
	}
	c.ProblemaUrbano = problema
	if r.Modelo != "" {
		d.Provedor = r.Modelo + " (foto)"
	}
	d.Categoria, d.Sugestao, d.origem = c.Categoria, &c, j
	// Só um "não" claro diz que a foto não serve; a dúvida fica com a regra.
	d.FotoUtil = *problema >= limiarNao
	for nome, p := range c.Sinais {
		if p > limiarSim {
			d.Sinais = append(d.Sinais, nome)
		}
	}
	sort.Strings(d.Sinais)
	return d, uso, nil
}
