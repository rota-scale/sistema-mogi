package triagem

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func fotoJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y += 7 {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{90, 90, 92, 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// respostaFalsa monta uma resposta no formato da API /v1/systemone.
func respostaFalsa(categoria string, haProblema float64, sinais map[string]float64) map[string]any {
	nota := func(d Distribuicao) map[string]any {
		p := map[string]float64{}
		for i, v := range d {
			p[fmt.Sprint(i)] = v
		}
		return map[string]any{"type": "score", "score": d.Esperado() - 1, "confidence": 0.5, "probabilities": p}
	}
	respostas := map[string]any{
		"categoria":   map[string]any{"type": "choice", "choice": categoria, "confidence": 0.8, "probabilities": map[string]float64{categoria: 0.91, "outros": 0.09}},
		"ha_problema": map[string]any{"type": "noul", "noul": haProblema},
		"gravidade":   nota(Distribuicao{0, 0, 0, .2, .8}),
		"urgencia":    nota(Distribuicao{0, 0, 0, .3, .7}),
		"tendencia":   nota(Distribuicao{0, 0, .2, .6, .2}),
	}
	for s := range perguntasSinais {
		p := 0.05
		if v, ok := sinais[s]; ok {
			p = v
		}
		respostas["sinal_"+s] = map[string]any{"type": "noul", "noul": p}
	}
	return map[string]any{"model": "jev-1.14", "answers": respostas, "usage": map[string]any{"input_tokens": 1200, "output_tokens": 30}}
}

type pedidoVisto struct {
	cabecalho http.Header
	json      map[string]any
	foto      []byte
	tipoFoto  string
}

func servidorJev(t *testing.T, responder func(n int) (int, any)) (*httptest.Server, *[]pedidoVisto) {
	t.Helper()
	var vistos []pedidoVisto
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/systemone" {
			t.Errorf("rota inesperada %s %s", r.Method, r.URL.Path)
		}
		v := pedidoVisto{cabecalho: r.Header.Clone()}
		tipo, params, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if tipo == "multipart/form-data" {
			mr := multipart.NewReader(r.Body, params["boundary"])
			for {
				p, err := mr.NextPart()
				if err != nil {
					break
				}
				dados, _ := io.ReadAll(p)
				switch p.FormName() {
				case "request":
					_ = json.Unmarshal(dados, &v.json)
				case "asset-0":
					v.foto, v.tipoFoto = dados, p.Header.Get("Content-Type")
				}
			}
		} else {
			_ = json.NewDecoder(r.Body).Decode(&v.json)
		}
		vistos = append(vistos, v)
		status, corpo := responder(int(n.Add(1)))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(corpo)
	}))
	t.Cleanup(srv.Close)
	return srv, &vistos
}

func TestJevPedidoSoTextoSemDadosPessoais(t *testing.T) {
	srv, vistos := servidorJev(t, func(int) (int, any) {
		return 200, respostaFalsa("agua", 0.95, map[string]float64{"agua_jorrando": 0.93})
	})
	j := NovoJev(ConfigJev{Chave: "chave-de-teste", Base: srv.URL, Cambio: 5})
	e := Entrada{Categoria: "agua", Texto: SemDadosPessoais("cano estourado, liga (35) 99876-5432"), Bairro: "Centro", Foto: []byte{0xff, 0xd8, 0xff}}
	c, err := j.Classificar(context.Background(), e)
	if err != nil {
		t.Fatal(err)
	}
	v := (*vistos)[0]
	if got := v.cabecalho.Get("Authorization"); got != "Bearer chave-de-teste" {
		t.Fatalf("autorização: %q", got)
	}
	if v.cabecalho.Get("TypeSafe-Danger-Zone-Images") != "" || v.foto != nil {
		t.Fatal("sem JEV_FOTO a foto não pode sair (decisão registrada: nada de mídia ao Jev)")
	}
	cru, _ := json.Marshal(v.json)
	for _, proibido := range []string{"99876", `"lat"`, `"lng"`, "-21.0", "-47.0", "<foto>"} {
		if strings.Contains(string(cru), proibido) {
			t.Fatalf("o pedido levou %q: %s", proibido, cru)
		}
	}
	estado := v.json["state"].(map[string]any)
	if estado["bairro"] != "Centro" || !strings.HasPrefix(estado["categoria_escolhida_pelo_morador"].(string), "Água e esgoto") {
		t.Fatalf("estado: %v", estado)
	}
	if _, ok := estado["descricao_da_foto"]; ok {
		t.Fatal("campo vazio não vai no estado")
	}
	perguntas := v.json["questions"].(map[string]any)
	if len(perguntas) != 6+len(perguntasSinais) {
		t.Fatalf("esperadas %d perguntas, vieram %d", 6+len(perguntasSinais), len(perguntas))
	}
	if lp := perguntas["local_publico"].(map[string]any); lp["type"] != "noul" || !strings.Contains(lp["instructions"].(string), "espaço público") {
		t.Fatalf("pergunta local_publico: %v", lp)
	}
	g := perguntas["gravidade"].(map[string]any)
	if g["type"] != "score" || len(g["criteria"].([]any)) != 5 {
		t.Fatalf("gravidade: %v", g)
	}
	if v.json["model"] != "jev-latest" {
		t.Fatalf("modelo: %v", v.json["model"])
	}

	if c.Categoria != "agua" || c.Confianca != 0.91 || c.Provedor != "jev-1.14" {
		t.Fatalf("classificação: %+v", c)
	}
	if c.G != (Distribuicao{0, 0, 0, .2, .8}) {
		t.Fatalf("G: %v", c.G)
	}
	// Só os sinais da categoria escolhida entram na regra.
	if len(c.Sinais) != 3 || c.Sinais["agua_jorrando"] != 0.93 {
		t.Fatalf("sinais: %v", c.Sinais)
	}
	if c.ProblemaUrbano == nil || *c.ProblemaUrbano != 0.95 {
		t.Fatalf("problema urbano: %v", c.ProblemaUrbano)
	}
	if c.LocalPublico != nil {
		t.Fatalf("sem a resposta local_publico, o campo fica nulo: %v", *c.LocalPublico)
	}
	if c.Uso.TokensEntrada != 1200 || c.Uso.CustoBRL < 0.000252 || c.Uso.CustoBRL > 0.000253 {
		t.Fatalf("custo: %+v", c.Uso)
	}
}

func TestJevComFotoEnviaMultipartEFazAVisao(t *testing.T) {
	srv, vistos := servidorJev(t, func(int) (int, any) {
		return 200, respostaFalsa("iluminacao", 0.9, map[string]float64{"fio_exposto": 0.88})
	})
	j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL, ComFoto: true})
	foto := fotoJPEG(t, 640, 480)
	e := Entrada{Foto: foto}
	d, uso, err := j.Descrever(context.Background(), e)
	if err != nil {
		t.Fatal(err)
	}
	v := (*vistos)[0]
	if v.cabecalho.Get("TypeSafe-Danger-Zone-Images") != "true" {
		t.Fatal("imagem exige o cabeçalho experimental")
	}
	if string(v.foto) != string(foto) || v.tipoFoto != "image/jpeg" {
		t.Fatalf("parte da foto: %v %q", v.foto, v.tipoFoto)
	}
	assets := v.json["assets"].(map[string]any)
	if a := assets["<foto>"].(map[string]any); a["type"] != "image" || a["part"] != "asset-0" {
		t.Fatalf("assets: %v", assets)
	}
	if v.json["state"].(map[string]any)["foto"] != "<foto>" {
		t.Fatal("a foto precisa ser citada no estado")
	}
	if d.Categoria != "iluminacao" || !d.FotoUtil || len(d.Sinais) != 1 || d.Sinais[0] != "fio_exposto" || uso.TokensEntrada != 1200 {
		t.Fatalf("descrição: %+v", d)
	}
	// A etapa 2 reaproveita a decisão da mesma chamada.
	e.Descricao = &d
	if _, err := j.Classificar(context.Background(), e); err != nil || len(*vistos) != 1 {
		t.Fatalf("deveria reaproveitar sem nova chamada (%d chamadas, %v)", len(*vistos), err)
	}
}

func TestJevFalhaNuncaViraResposta(t *testing.T) {
	casos := map[string]func(int) (int, any){
		"erro 400":            func(int) (int, any) { return 400, map[string]string{"detail": "pedido inválido"} },
		"erro 401":            func(int) (int, any) { return 401, map[string]string{"detail": "chave inválida"} },
		"categoria inventada": func(int) (int, any) { return 200, respostaFalsa("disco_voador", 0.9, nil) },
		"sem respostas": func(int) (int, any) {
			return 200, map[string]any{"model": "jev", "answers": map[string]any{}}
		},
		"nota incompleta": func(int) (int, any) {
			r := respostaFalsa("vias", 0.9, nil)
			r["answers"].(map[string]any)["urgencia"] = map[string]any{"type": "score", "probabilities": map[string]float64{"0": 1}}
			return 200, r
		},
	}
	for nome, responder := range casos {
		t.Run(nome, func(t *testing.T) {
			srv, _ := servidorJev(t, responder)
			j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL})
			if _, err := j.Classificar(context.Background(), Entrada{Categoria: "vias"}); err == nil {
				t.Fatal("falha do Jev tem que ser erro, para acionar o fallback")
			}
		})
	}
}

func TestJevTentaDeNovoUmaVezEm5xx(t *testing.T) {
	srv, vistos := servidorJev(t, func(n int) (int, any) {
		if n == 1 {
			return 503, map[string]string{"detail": "ocupado"}
		}
		return 200, respostaFalsa("vias", 0.9, nil)
	})
	j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL})
	if _, err := j.Classificar(context.Background(), Entrada{Categoria: "vias"}); err != nil {
		t.Fatal(err)
	}
	if len(*vistos) != 2 || (*vistos)[1].cabecalho.Get("X-TypeSafe-Retry-Count") != "1" {
		t.Fatalf("esperada uma segunda tentativa marcada, vieram %d", len(*vistos))
	}
	// Dois 5xx seguidos: erro, e a cadeia segue para o próximo.
	srv2, _ := servidorJev(t, func(int) (int, any) { return 502, nil })
	_, err := NovoJev(ConfigJev{Chave: "k", Base: srv2.URL}).Classificar(context.Background(), Entrada{Categoria: "vias"})
	var ej *ErroJev
	if !errors.As(err, &ej) || ej.Status != 502 {
		t.Fatalf("esperado ErroJev 502, veio %v", err)
	}
}

// C7 com o Jev na frente: ele cai e o chamado continua pelo fallback local.
func TestJevForaDoArAcionaFallback(t *testing.T) {
	srv, _ := servidorJev(t, func(int) (int, any) { return 500, nil })
	s := servicoReal()
	s.Classificadores = []Classificador{NovoJev(ConfigJev{Chave: "k", Base: srv.URL}), ClassificadorLocal{}}
	s.TempoClassif = 2 * time.Second
	r := s.Triar(context.Background(), Entrada{Categoria: "agua", Texto: "cano estourado jorrando"})
	if r.Nivel == nil || *r.Nivel != 5 || r.Registro.Classificacao.Provedor != "local-por-categoria" {
		t.Fatalf("esperado nível 5 pelo local, veio %v %+v", r.Nivel, r.Registro.Classificacao)
	}
	if r.Etapas[0].Provedor != "jev-latest" || r.Etapas[0].OK {
		t.Fatalf("a falha do Jev precisa aparecer no log: %+v", r.Etapas[0])
	}
}

// Com o Jev respondendo, a regra Lua decide o nível pelos sinais e pela GUT.
func TestJevDecideComARegraLua(t *testing.T) {
	srv, _ := servidorJev(t, func(int) (int, any) {
		return 200, respostaFalsa("agua", 0.95, map[string]float64{"agua_jorrando": 0.93})
	})
	s := servicoReal()
	s.Classificadores = []Classificador{NovoJev(ConfigJev{Chave: "k", Base: srv.URL}), ClassificadorLocal{}}
	r := s.Triar(context.Background(), Entrada{Categoria: "agua", Texto: "cano estourado"})
	if r.Nivel == nil || *r.Nivel != 5 || r.Status != "revisao" || r.Registro.Classificacao.Provedor != "jev-1.14" {
		t.Fatalf("esperado nível 5 em revisão pelo Jev: %v %s %+v", r.Nivel, r.Status, r.Registro.Classificacao)
	}
	if r.Etapas[0].CustoBRL <= 0 {
		t.Fatal("custo do Jev precisa ir para o log (RF11)")
	}
}

func TestRelatoQueNaoEProblemaVaiParaRevisao(t *testing.T) {
	srv, _ := servidorJev(t, func(int) (int, any) { return 200, respostaFalsa("limpeza", 0.1, nil) })
	s := servicoReal()
	s.Classificadores = []Classificador{NovoJev(ConfigJev{Chave: "k", Base: srv.URL})}
	r := s.Triar(context.Background(), Entrada{Categoria: "limpeza", Texto: "bom dia"})
	if r.Status != "revisao" || !strings.Contains(r.Registro.Motivo, "pode não ser um problema urbano") {
		t.Fatalf("um não claro do Jev pede revisão: %s, %s", r.Status, r.Registro.Motivo)
	}
	// Na dúvida (entre 0,3 e 0,7), segue a regra normal: lixo com notas
	// baixas fica aberto, sem o aviso.
	srv2, _ := servidorJev(t, func(int) (int, any) {
		r := respostaFalsa("limpeza", 0.5, nil)
		baixa := map[string]any{"type": "score", "probabilities": map[string]float64{"0": .2, "1": .6, "2": .2, "3": 0, "4": 0}}
		for _, k := range []string{"gravidade", "urgencia", "tendencia"} {
			r["answers"].(map[string]any)[k] = baixa
		}
		return 200, r
	})
	s.Classificadores = []Classificador{NovoJev(ConfigJev{Chave: "k", Base: srv2.URL})}
	r = s.Triar(context.Background(), Entrada{Categoria: "limpeza", Texto: "lixo parado"})
	if r.Status != "aberta" || strings.Contains(r.Registro.Motivo, "pode não ser") {
		t.Fatalf("dúvida não manda para revisão, veio %s (%s)", r.Status, r.Registro.Motivo)
	}
}

func TestPerguntasDoJevCobremTodosOsSinais(t *testing.T) {
	for _, c := range Categorias() {
		if criteriosCategoria[c] == "" {
			t.Errorf("categoria %s sem descrição para o Jev", c)
		}
		for _, s := range SinaisDe(c) {
			if perguntasSinais[s] == "" {
				t.Errorf("sinal %s de %s sem pergunta para o Jev", s, c)
			}
		}
	}
	for _, l := range [][]string{criteriosGravidade, criteriosUrgencia, criteriosTendencia} {
		if len(l) != 5 {
			t.Errorf("escala GUT precisa de 5 níveis, tem %d", len(l))
		}
	}
}

// Foto de celular em pé (1200 x 1600) passa do lado máximo de 1568 do Jev.
func TestFotoAjustadaAosLimitesDoJev(t *testing.T) {
	srv, vistos := servidorJev(t, func(int) (int, any) { return 200, respostaFalsa("vias", 0.9, nil) })
	j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL, ComFoto: true})
	if _, _, err := j.Descrever(context.Background(), Entrada{Foto: fotoJPEG(t, 1200, 1600)}); err != nil {
		t.Fatal(err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader((*vistos)[0].foto))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Height != 1568 || cfg.Width != 1176 {
		t.Fatalf("foto enviada com %dx%d, queria 1176x1568", cfg.Width, cfg.Height)
	}
	// Pequena demais: a visão pelo Jev falha e a classificação segue só com texto.
	if _, _, err := j.Descrever(context.Background(), Entrada{Foto: fotoJPEG(t, 400, 200)}); !errors.Is(err, errFotoForaDoLimite) {
		t.Fatalf("foto com lado menor que 280 deveria falhar a visão, veio %v", err)
	}
	if _, err := j.Classificar(context.Background(), Entrada{Categoria: "vias", Foto: fotoJPEG(t, 400, 200)}); err != nil {
		t.Fatal(err)
	}
	if v := (*vistos)[len(*vistos)-1]; v.foto != nil || v.cabecalho.Get("TypeSafe-Danger-Zone-Images") != "" {
		t.Fatal("foto fora do limite não pode ir no pedido")
	}
}

// A resposta local_publico do Jev chega à classificação.
func TestJevLeLocalPublico(t *testing.T) {
	srv, _ := servidorJev(t, func(int) (int, any) {
		r := respostaFalsa("agua", 0.9, nil)
		r["answers"].(map[string]any)["local_publico"] = map[string]any{"type": "noul", "noul": 0.12}
		return 200, r
	})
	j := NovoJev(ConfigJev{Chave: "k", Base: srv.URL})
	c, err := j.Classificar(context.Background(), Entrada{Categoria: "agua", Texto: "cano da pia vazando"})
	if err != nil {
		t.Fatal(err)
	}
	if c.LocalPublico == nil || *c.LocalPublico != 0.12 {
		t.Fatalf("local público: %v", c.LocalPublico)
	}
}
