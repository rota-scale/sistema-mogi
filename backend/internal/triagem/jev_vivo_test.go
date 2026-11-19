//go:build vivo

package triagem

// Teste contra o Jev de verdade. Gasta créditos da TypeSafe (centavos).
// Rodar: TYPESAFE_API_KEY=... go test -tags vivo -run Vivo -v ./internal/triagem/

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"os"
	"sort"
	"strings"
	"testing"
	"time"
)

type casoVivo struct {
	nome      string
	entrada   Entrada
	categoria string // esperada
	niveis    []int16
	revisao   bool // espera revisão humana
}

func casosVivos() []casoVivo {
	return []casoVivo{
		{"cano estourado", Entrada{Categoria: "agua", Texto: "Cano estourado jorrando água na rua desde cedo"}, "agua", []int16{5}, true},
		{"poste apagado", Entrada{Categoria: "iluminacao", Texto: "Poste apagado na esquina faz uma semana"}, "iluminacao", []int16{2, 3}, false},
		{"fio caído", Entrada{Categoria: "iluminacao", Texto: "Tem um fio de energia caído na calçada perto do ponto de ônibus"}, "iluminacao", []int16{5}, true},
		{"buraco grande na curva", Entrada{Categoria: "vias", Texto: "Buraco grande na curva, uma moto quase caiu ontem"}, "vias", []int16{4, 5}, true},
		{"buraco pequeno", Entrada{Categoria: "vias", Texto: "Buraco pequeno no asfalto"}, "vias", []int16{2, 3}, false},
		{"lixo parado", Entrada{Categoria: "limpeza", Texto: "Lixo parado na esquina, o caminhão não passou"}, "limpeza", []int16{1, 2}, false},
		{"árvore sobre fios", Entrada{Categoria: "arvores", Texto: "Árvore caiu em cima dos fios e fechou a rua"}, "arvores", []int16{5}, true},
		{"semáforo no cruzamento", Entrada{Categoria: "sinalizacao", Texto: "Semáforo apagado no cruzamento da avenida"}, "sinalizacao", []int16{4, 5}, true},
		{"sem categoria, só fala", Entrada{Texto: "Tem um bueiro entupido e a água está empoçando na frente da escola"}, "agua", []int16{3, 4, 5}, false},
		{"categoria errada", Entrada{Categoria: "limpeza", Texto: "O semáforo da praça está piscando amarelo o dia inteiro"}, "sinalizacao", nil, false},
		{"não é problema", Entrada{Categoria: "outros", Texto: "Bom dia, queria saber o horário da prefeitura"}, "", nil, true},
	}
}

func TestVivoJev(t *testing.T) {
	if os.Getenv("TYPESAFE_API_KEY") == "" {
		t.Skip("sem TYPESAFE_API_KEY")
	}
	jev := NovoJev(ConfigJev{Chave: os.Getenv("TYPESAFE_API_KEY"), Base: os.Getenv("TYPESAFE_BASE_URL"), Modelo: os.Getenv("JEV_MODELO")})
	s := &Servico{
		Classificadores: []Classificador{jev},
		Motor:           MotorLua{Dir: "../../regras", Cidade: "itamogi"},
		TempoClassif:    15 * time.Second,
	}
	var custo float64
	var tempos []int64
	falhas := 0
	for _, c := range casosVivos() {
		r := s.Triar(context.Background(), c.entrada)
		var cl *Classificacao = r.Registro.Classificacao
		for _, e := range r.Etapas {
			custo += e.CustoBRL
			if e.Nome == "classificacao" {
				tempos = append(tempos, e.MS)
			}
		}
		if cl == nil {
			t.Errorf("%s: sem classificação (%s)", c.nome, r.Registro.Falha)
			falhas++
			continue
		}
		var sinais []string
		for k, v := range cl.Sinais {
			sinais = append(sinais, fmt.Sprintf("%s=%.2f", k, v))
		}
		sort.Strings(sinais)
		pu := -1.0
		if cl.ProblemaUrbano != nil {
			pu = *cl.ProblemaUrbano
		}
		nivel := int16(0)
		if r.Nivel != nil {
			nivel = *r.Nivel
		}
		t.Logf("%-24s cat=%-11s conf=%.2f problema=%.2f G=%.1f U=%.1f T=%.1f GUT=%.0f/p90 %.0f nivel=%d %-8s sinais[%s] motivo: %s",
			c.nome, cl.Categoria, cl.Confianca, pu, cl.G.Esperado(), cl.U.Esperado(), cl.T.Esperado(),
			r.Registro.GUTEsperada, r.Registro.GUTP90, nivel, r.Status, strings.Join(sinais, " "), r.Registro.Motivo)
		ok := true
		if c.categoria != "" && cl.Categoria != c.categoria {
			ok = false
		}
		if c.niveis != nil && !contem(c.niveis, nivel) {
			ok = false
		}
		if c.revisao && r.Status != "revisao" {
			ok = false
		}
		if !ok {
			falhas++
			t.Logf("   ^ diferente do esperado: categoria %s, níveis %v, revisão %v", c.categoria, c.niveis, c.revisao)
		}
	}
	sort.Slice(tempos, func(i, j int) bool { return tempos[i] < tempos[j] })
	t.Logf("modelo %s · %d casos · %d diferentes do esperado · custo total R$ %.5f · tempo mediano %d ms, máximo %d ms",
		jev.Nome(), len(casosVivos()), falhas, custo, tempos[len(tempos)/2], tempos[len(tempos)-1])
}

// Caminho da foto (JEV_FOTO): sem texto e sem categoria, só a imagem. As
// ilustrações do brand kit são cortadas acima do texto, que entregaria a
// resposta. Valida o envio e a leitura; acerto em foto real se mede em campo.
func TestVivoJevFoto(t *testing.T) {
	if os.Getenv("TYPESAFE_API_KEY") == "" {
		t.Skip("sem TYPESAFE_API_KEY")
	}
	jev := NovoJev(ConfigJev{Chave: os.Getenv("TYPESAFE_API_KEY"), Base: os.Getenv("TYPESAFE_BASE_URL"), ComFoto: true})
	casos := []struct {
		nome, arquivo string
		corteAltura   int
	}{
		{"ilustração do cano", "../../../brand/casos-de-uso/1-cano-estourado-1080x1350.jpg", 580},
		{"ilustração do buraco", "../../../brand/casos-de-uso/4-buraco-na-via-1080x1350.jpg", 580},
		{"capa do MOGI (não é problema)", "../../../scripts/fixtures/foto-teste.jpg", 0},
	}
	for _, c := range casos {
		dados, err := os.ReadFile(c.arquivo)
		if err != nil {
			t.Fatal(err)
		}
		if c.corteAltura > 0 {
			dados = cortarTopo(t, dados, c.corteAltura)
		}
		d, uso, err := jev.Descrever(context.Background(), Entrada{Foto: dados})
		if err != nil {
			t.Errorf("%s: %v", c.nome, err)
			continue
		}
		var sinais []string
		for k, v := range d.Sugestao.Sinais {
			sinais = append(sinais, fmt.Sprintf("%s=%.2f", k, v))
		}
		sort.Strings(sinais)
		t.Logf("%-30s cat=%-11s conf=%.2f problema=%.2f foto_util=%v G=%.1f U=%.1f T=%.1f tokens=%d sinais[%s]",
			c.nome, d.Categoria, d.Sugestao.Confianca, *d.Sugestao.ProblemaUrbano, d.FotoUtil,
			d.Sugestao.G.Esperado(), d.Sugestao.U.Esperado(), d.Sugestao.T.Esperado(), uso.TokensEntrada, strings.Join(sinais, " "))
	}
}

func cortarTopo(t *testing.T, dados []byte, altura int) []byte {
	t.Helper()
	img, _, err := image.Decode(bytes.NewReader(dados))
	if err != nil {
		t.Fatal(err)
	}
	b := img.Bounds()
	out := image.NewRGBA(image.Rect(0, 0, b.Dx(), altura))
	draw.Draw(out, out.Bounds(), img, b.Min, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
