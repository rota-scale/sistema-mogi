// Package demo cria chamados simulados em Itamogi para o painel não nascer
// vazio na demonstração (SOP 05). Tudo o que ele grava leva demo = true:
// aparece marcado como simulado no painel, pode ser apagado de uma vez e
// nunca conta como evidência do teste de campo.
package demo

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"math"
	"math/rand/v2"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/midia"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/ocorrencias"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

// As fotos e os vídeos da demo são gerados por IA e ficam embutidos no
// binário (veja o README de cada pasta).
//
//go:embed fotos videos
var arquivos embed.FS

// Centro é onde os chamados simulados são espalhados. O padrão é o centro
// de Itamogi-MG (Nominatim, relação OSM 315047); o servidor troca pelo
// centro da cidade da instalação.
var centroLat, centroLng = -21.0793, -47.0486

// Centralizar muda o ponto em volta do qual a demo é semeada.
func Centralizar(lat, lng float64) { centroLat, centroLng = lat, lng }

type modelo struct {
	categoria string
	peso      int
	textos    []string
	cor       color.RGBA
}

var modelos = []modelo{
	{"vias", 24, []string{"buraco na rua", "buraco grande perto da curva", "asfalto afundando", "buraco crescendo, risco para moto"}, color.RGBA{0x6b, 0x6b, 0x6b, 255}},
	{"iluminacao", 18, []string{"poste apagado", "lâmpada piscando a noite toda", "rua inteira escura", "fio caído na calçada"}, color.RGBA{0x2c, 0x2d, 0x52, 255}},
	{"limpeza", 20, []string{"lixo parado", "entulho na calçada", "mato alto no terreno", "caçamba transbordando"}, color.RGBA{0x7a, 0x6a, 0x3a, 255}},
	{"agua", 10, []string{"vazamento pequeno na calçada", "cano estourado jorrando água", "esgoto a céu aberto perto da escola", "bueiro entupido"}, color.RGBA{0x3b, 0x6e, 0xa5, 255}},
	{"arvores", 9, []string{"galhos precisando de poda", "árvore caiu e fechou a rua", "galho encostando no fio"}, color.RGBA{0x3e, 0x7b, 0x3a, 255}},
	{"sinalizacao", 7, []string{"placa de pare caída", "semáforo apagado no cruzamento", "faixa de pedestre apagada"}, color.RGBA{0xd9, 0x82, 0x2b, 255}},
	{"calcadas", 8, []string{"calçada quebrada", "rampa de acessibilidade quebrada", "banco da praça quebrado"}, color.RGBA{0x8c, 0x3b, 0x2a, 255}},
	{"animais", 4, []string{"animal morto na rua", "cavalo solto na via"}, color.RGBA{0x4a, 0x2c, 0x1d, 255}},
}

// Semear cria n chamados simulados espalhados nos últimos 14 dias, com a
// mesma triagem local e o mesmo agrupamento do fluxo real. Devolve quantos
// chamados nasceram (relatos repetidos entram em chamados existentes).
func Semear(ctx context.Context, pool *pgxpool.Pool, repo *ocorrencias.Repositorio, arm midia.Armazenamento,
	motor triagem.MotorLua, n int, agora time.Time) (int, error) {
	if n <= 0 {
		return 0, nil
	}
	// Semente fixa: a demo fica igual a cada instalação.
	rnd := rand.New(rand.NewPCG(2026, 1121))
	svc := &triagem.Servico{
		Classificadores: []triagem.Classificador{triagem.ClassificadorLocal{}},
		Motor:           motor,
		Secretaria:      repo.Secretaria,
	}

	chaves := map[string]string{}
	// videos guarda, por categoria, as mídias do vídeo de exemplo e da capa.
	videos := map[string][]ocorrencias.NovaMidia{}
	for _, m := range modelos {
		foto, err := fotoDaDemo(m)
		if err != nil {
			return 0, err
		}
		chave := "demo/" + m.categoria + "/publica.jpg"
		if err := arm.Gravar(ctx, chave, "image/jpeg", foto); err != nil {
			return 0, fmt.Errorf("gravar foto simulada: %w", err)
		}
		chaves[m.categoria] = chave

		video, err := arquivos.ReadFile("videos/" + m.categoria + ".mp4")
		if err != nil {
			continue // categoria sem vídeo de exemplo
		}
		chaveVideo := "demo/" + m.categoria + "/video.mp4"
		if err := arm.Gravar(ctx, chaveVideo, "video/mp4", video); err != nil {
			return 0, fmt.Errorf("gravar vídeo simulado: %w", err)
		}
		midias := []ocorrencias.NovaMidia{
			{Tipo: "foto", Mime: "image/jpeg", ChavePublica: chave},
			{Tipo: "video", Mime: "video/mp4", ChaveOriginal: chaveVideo, Bytes: int64(len(video)), DuracaoMS: duracaoDoVideo(video)},
		}
		if capa, err := arquivos.ReadFile("videos/" + m.categoria + ".jpg"); err == nil {
			if capa, err = carimbar(capa); err == nil {
				chaveCapa := "demo/" + m.categoria + "/quadro-1.jpg"
				if err := arm.Gravar(ctx, chaveCapa, "image/jpeg", capa); err != nil {
					return 0, fmt.Errorf("gravar capa do vídeo simulado: %w", err)
				}
				midias = append(midias, ocorrencias.NovaMidia{Tipo: "quadro", Mime: "image/jpeg", ChavePublica: chaveCapa})
			}
		}
		videos[m.categoria] = midias
	}

	type item struct {
		m        modelo
		texto    string
		lat, lng float64
		quando   time.Time
	}
	var itens []item
	total := 0
	for _, m := range modelos {
		total += m.peso
	}
	sortear := func() modelo {
		x := rnd.IntN(total)
		for _, m := range modelos {
			if x < m.peso {
				return m
			}
			x -= m.peso
		}
		return modelos[0]
	}
	for i := 0; i < n; i++ {
		m := sortear()
		// Distribuição concentrada no centro, até cerca de 900 m.
		dist := math.Abs(rnd.NormFloat64()) * 380
		ang := rnd.Float64() * 2 * math.Pi
		lat := centroLat + dist*math.Cos(ang)/111320
		lng := centroLng + dist*math.Sin(ang)/(111320*math.Cos(centroLat*math.Pi/180))
		// Mais relatos nos últimos dias, alguns nas últimas horas.
		horas := math.Pow(rnd.Float64(), 1.6) * 14 * 24
		it := item{m, m.textos[rnd.IntN(len(m.textos))], lat, lng, agora.Add(-time.Duration(horas * float64(time.Hour)))}
		itens = append(itens, it)
		// Um em cada oito problemas recebe relatos repetidos de vizinhos (RF08).
		if rnd.IntN(8) == 0 {
			for k := 1 + rnd.IntN(4); k > 0; k-- {
				rep := it
				rep.lat += (rnd.Float64() - 0.5) * 0.0003
				rep.lng += (rnd.Float64() - 0.5) * 0.0003
				rep.quando = it.quando.Add(time.Duration(1+rnd.IntN(600)) * time.Minute)
				if rep.quando.Before(agora) {
					itens = append(itens, rep)
				}
			}
		}
	}
	sort.Slice(itens, func(i, j int) bool { return itens[i].quando.Before(itens[j].quando) })

	criados := 0
	for i, it := range itens {
		quando := it.quando
		svc.Agora = func() time.Time { return quando }
		res := svc.Triar(ctx, triagem.Entrada{Categoria: it.m.categoria, Texto: it.texto})
		bairro := setor(it.lat, it.lng)
		// Um em cada três relatos das categorias com vídeo de exemplo leva o vídeo.
		var midias []ocorrencias.NovaMidia
		if v := videos[it.m.categoria]; v != nil && i%3 == 0 {
			midias = v
		}
		_, agrupada, err := repo.Registrar(ctx, ocorrencias.Nova{
			Midias: midias,
			ID:     ocorrencias.NovoID(), Categoria: res.Categoria, Secretaria: res.Secretaria,
			Texto: it.texto, Lat: it.lat, Lng: it.lng,
			Endereco: "", Bairro: bairro,
			MidiaOriginal: chaves[it.m.categoria], MidiaPublica: chaves[it.m.categoria],
			Status: res.Status, Nivel: res.Nivel, Triagem: res.Registro,
			PrazoAte: res.PrazoAte, PrazoFonte: res.PrazoFonte, Etapas: res.Etapas,
			LatenciaMS: res.Registro.LatenciaMS, Demo: true, CriadoEm: &quando,
		}, svc.Reavaliar, quando)
		if err != nil {
			return criados, fmt.Errorf("registrar chamado simulado: %w", err)
		}
		if !agrupada {
			criados++
		}
	}

	// Anda com o ciclo de vida: revisões antigas confirmadas (uma parte com
	// o nível ajustado pelo operador), despachos e resoluções.
	passos := []string{
		`UPDATE ocorrencias SET status = 'aberta', revisado_por = 'operador',
			revisado_em = criado_em + interval '6 minutes' * (1 + (hashtext(id::text) & 7)),
			nivel = CASE (hashtext(id::text) & 7) WHEN 0 THEN greatest(nivel - 1, 1) WHEN 1 THEN least(nivel + 1, 5) ELSE nivel END
		 WHERE demo AND status = 'revisao' AND criado_em < $1::timestamptz - interval '5 hours'`,
		`UPDATE ocorrencias SET status = 'em_atendimento', despachado_por = 'operador',
			despachado_em = criado_em + interval '25 minutes' * (1 + (hashtext(id::text) & 3)) * (6 - nivel)
		 WHERE demo AND status = 'aberta' AND criado_em < $1::timestamptz - interval '20 hours' AND (hashtext(id::text) & 15) < 12`,
		`UPDATE ocorrencias SET status = 'resolvida', resolvido_por = 'operador',
			resolvido_em = least(despachado_em + interval '3 hours' * (1 + (hashtext(protocolo) & 7)) * (6 - nivel), $1::timestamptz)
		 WHERE demo AND status = 'em_atendimento' AND criado_em < $1::timestamptz - interval '2 days' AND (hashtext(protocolo) & 15) < 11`,
	}
	for _, sql := range passos {
		if _, err := pool.Exec(ctx, sql, agora); err != nil {
			return criados, fmt.Errorf("ciclo de vida simulado: %w", err)
		}
	}
	// O histórico acompanha o ciclo de vida, como nos chamados reais.
	historico := []string{
		`INSERT INTO eventos (ocorrencia_id, tipo, autor, dados, criado_em)
		 SELECT o.id, 'revisada', o.revisado_por, jsonb_build_object('nivel', o.nivel), o.revisado_em FROM ocorrencias o
		 WHERE o.demo AND o.revisado_em IS NOT NULL
		   AND NOT EXISTS (SELECT 1 FROM eventos e WHERE e.ocorrencia_id = o.id AND e.tipo = 'revisada')`,
		`INSERT INTO eventos (ocorrencia_id, tipo, autor, criado_em)
		 SELECT o.id, 'despachada', o.despachado_por, o.despachado_em FROM ocorrencias o
		 WHERE o.demo AND o.despachado_em IS NOT NULL
		   AND NOT EXISTS (SELECT 1 FROM eventos e WHERE e.ocorrencia_id = o.id AND e.tipo = 'despachada')`,
		`INSERT INTO eventos (ocorrencia_id, tipo, autor, criado_em)
		 SELECT o.id, 'resolvida', o.resolvido_por, o.resolvido_em FROM ocorrencias o
		 WHERE o.demo AND o.resolvido_em IS NOT NULL
		   AND NOT EXISTS (SELECT 1 FROM eventos e WHERE e.ocorrencia_id = o.id AND e.tipo = 'resolvida')`,
	}
	for _, sql := range historico {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return criados, fmt.Errorf("histórico simulado: %w", err)
		}
	}
	return criados, nil
}

// setor dá um nome genérico de região. Não são os bairros oficiais de
// Itamogi: o endereço real vem da geocodificação nos relatos de verdade.
func setor(lat, lng float64) string {
	dy := (lat - centroLat) * 111320
	dx := (lng - centroLng) * 111320 * math.Cos(centroLat*math.Pi/180)
	if math.Hypot(dx, dy) < 300 {
		return "Centro"
	}
	if math.Abs(dy) > math.Abs(dx) {
		if dy > 0 {
			return "Setor Norte"
		}
		return "Setor Sul"
	}
	if dx > 0 {
		return "Setor Leste"
	}
	return "Setor Oeste"
}

// duracaoDoVideo lê a duração do arquivo; 5 s se não der para ler.
func duracaoDoVideo(video []byte) int64 {
	info, err := midia.InspecionarVideo(bytes.NewReader(video), int64(len(video)))
	if err != nil || info.DuracaoMS == 0 {
		return 5000
	}
	return info.DuracaoMS
}

// fotoDaDemo devolve a foto de exemplo da categoria, carimbada com o aviso
// de imagem gerada por IA. Sem foto de exemplo, cai no cartão desenhado.
func fotoDaDemo(m modelo) ([]byte, error) {
	dados, err := arquivos.ReadFile("fotos/" + m.categoria + ".jpg")
	if err != nil {
		return fotoSimulada(m)
	}
	return carimbar(dados)
}

// carimbar escreve uma faixa no rodapé da imagem, para ninguém confundir a
// foto de exemplo com foto real de Itamogi.
func carimbar(dados []byte) ([]byte, error) {
	origem, err := jpeg.Decode(bytes.NewReader(dados))
	if err != nil {
		return nil, fmt.Errorf("foto de exemplo inválida: %w", err)
	}
	b := origem.Bounds()
	img := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(img, img.Bounds(), origem, b.Min, draw.Src)
	faixa := image.Rect(0, b.Dy()-26, b.Dx(), b.Dy())
	draw.Draw(img, faixa, &image.Uniform{color.RGBA{0x1f, 0x4d, 0x2b, 235}}, image.Point{}, draw.Over)
	texto := "IMAGEM GERADA POR IA: dado de demonstracao do Sistema MOGI"
	d := &font.Drawer{Dst: img, Src: image.NewUniform(color.RGBA{0xf5, 0xf1, 0xe8, 255}), Face: basicfont.Face7x13}
	d.Dot = fixed.P((b.Dx()-d.MeasureString(texto).Ceil())/2, b.Dy()-9)
	d.DrawString(texto)
	var buf bytes.Buffer
	err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 84})
	return buf.Bytes(), err
}

// fotoSimulada desenha um cartão com a cor da categoria e o aviso de dado
// simulado, para ninguém confundir com foto real de Itamogi.
func fotoSimulada(m modelo) ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, 640, 480))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{0xf5, 0xf1, 0xe8, 255}}, image.Point{}, draw.Src)
	draw.Draw(img, image.Rect(0, 300, 640, 480), &image.Uniform{color.RGBA{0xb9, 0xb2, 0xa2, 255}}, image.Point{}, draw.Src)
	// Um losango e um círculo, no espírito do brand kit.
	for y := 90; y < 370; y++ {
		for x := 180; x < 460; x++ {
			if abs(x-320)+abs(y-230) < 130 {
				img.SetRGBA(x, y, m.cor)
			}
			if (x-320)*(x-320)+(y-230)*(y-230) < 46*46 {
				img.SetRGBA(x, y, color.RGBA{0xe9, 0xb5, 0x26, 255})
			}
		}
	}
	escrever := func(texto string, y int) {
		d := &font.Drawer{Dst: img, Src: image.NewUniform(color.RGBA{0x1f, 0x4d, 0x2b, 255}), Face: basicfont.Face7x13}
		d.Dot = fixed.P((640-d.MeasureString(texto).Ceil())/2, y)
		d.DrawString(texto)
	}
	escrever("FOTO SIMULADA", 40)
	escrever("Sistema MOGI: dado de demonstracao, categoria "+m.categoria, 440)
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85})
	return buf.Bytes(), err
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
