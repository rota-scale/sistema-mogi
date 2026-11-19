// Package ocorrencias registra e consulta as ocorrências (RF01), agrupa
// relatos repetidos (RF08) e acompanha o chamado até a resolução.
package ocorrencias

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/cidade"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

// Ocorrencia é a forma pública de um chamado. Campos com nomes próximos ao
// Open311 GeoReport v2 (ADR 0003); nível, triagem e H3 são extensões.
type Ocorrencia struct {
	ID            string          `json:"id"`
	Protocolo     string          `json:"protocolo"`
	Categoria     string          `json:"categoria"`
	Secretaria    *string         `json:"secretaria"`
	Texto         *string         `json:"texto"`
	Lat           float64         `json:"lat"`
	Lng           float64         `json:"lng"`
	PrecisaoM     *float32        `json:"precisao_m"`
	H3            *string         `json:"h3"`
	Endereco      *string         `json:"endereco"`
	Bairro        *string         `json:"bairro"`
	Status        string          `json:"status"`
	Nivel         *int16          `json:"nivel"`
	NivelIA       *int16          `json:"nivel_ia"`
	Relatos       int             `json:"relatos"`
	Triagem       json.RawMessage `json:"triagem"`
	PrazoAte      *time.Time      `json:"prazo_ate"`
	PrazoFonte    *string         `json:"prazo_fonte"`
	RevisadoPor   *string         `json:"revisado_por"`
	RevisadoEm    *time.Time      `json:"revisado_em"`
	DespachadoPor *string         `json:"despachado_por"`
	DespachadoEm  *time.Time      `json:"despachado_em"`
	ResolvidoPor  *string         `json:"resolvido_por"`
	ResolvidoEm   *time.Time      `json:"resolvido_em"`
	CustoBRL      float64         `json:"custo_brl"`
	LatenciaMS    *int32          `json:"latencia_ms"`
	Demo          bool            `json:"demo"`
	CriadoEm      time.Time       `json:"criado_em"`
	AtualizadoEm  time.Time       `json:"atualizado_em"`
	MidiaURL      string          `json:"midia_url,omitempty"`

	// Só no detalhe (GET /ocorrencias/{id}).
	RelatosLista []Relato        `json:"relatos_lista,omitempty"`
	Etapas       []triagem.Etapa `json:"etapas,omitempty"`
	Eventos      []Evento        `json:"eventos,omitempty"`
	Midias       []Midia         `json:"midias,omitempty"`
	midiaPublica string
}

// Midia é uma foto, um quadro de vídeo, um vídeo ou uma foto do depois de
// um chamado. Só as versões borradas têm URL; o vídeo é restrito e abre por
// um link pedido na hora (ADR 0015).
type Midia struct {
	ID        string    `json:"id"`
	RelatoID  *string   `json:"relato_id"`
	Tipo      string    `json:"tipo"`
	Mime      string    `json:"mime"`
	Ordem     int16     `json:"ordem"`
	Largura   *int32    `json:"largura"`
	Altura    *int32    `json:"altura"`
	DuracaoMS *int32    `json:"duracao_ms"`
	CriadoEm  time.Time `json:"criado_em"`
	URL       string    `json:"url,omitempty"`
	// Disponivel é falso quando a original já foi apagada pela retenção.
	Disponivel   bool `json:"disponivel"`
	chavePublica string
}

// ChavePublica devolve a chave da versão borrada, para quem assina o link.
func (m Midia) ChavePublica() string { return m.chavePublica }

// NovaMidia descreve um arquivo já gravado no armazenamento.
type NovaMidia struct {
	Tipo          string // foto, quadro, video ou depois
	Mime          string
	ChaveOriginal string
	ChavePublica  string
	Largura       int
	Altura        int
	DuracaoMS     int64
	Bytes         int64
}

// Evento é uma linha do histórico do chamado: quem fez o quê e quando.
type Evento struct {
	Tipo     string          `json:"tipo"`
	Autor    *string         `json:"autor"`
	Dados    json.RawMessage `json:"dados"`
	CriadoEm time.Time       `json:"criado_em"`
}

// Recibo é tudo o que o morador recebe de volta ao enviar. Fica de fora o
// que pertence ao chamado e não a ele: quando o relato entra num chamado
// que já existia, texto, foto e endereço de outra pessoa não podem vazar.
type Recibo struct {
	Protocolo  string     `json:"protocolo"`
	Chave      string     `json:"chave"`
	Status     string     `json:"status"`
	Nivel      *int16     `json:"nivel"`
	Categoria  string     `json:"categoria"`
	Secretaria *string    `json:"secretaria"`
	PrazoAte   *time.Time `json:"prazo_ate"`
	PrazoFonte *string    `json:"prazo_fonte"`
	Endereco   *string    `json:"endereco"`
	Bairro     *string    `json:"bairro"`
	Agrupada   bool       `json:"agrupada"`
	Relatos    int        `json:"relatos"`
	CriadoEm   time.Time  `json:"criado_em"`
	// Repetido: o servidor já tinha este relato (reenvio com a mesma chave).
	Repetido bool `json:"repetido"`
	// ForaDoEscopo: a foto parece de local privado (dentro de casa, quintal,
	// comércio por dentro). O relato foi para a conferência da central.
	ForaDoEscopo bool `json:"fora_do_escopo"`
}

// Relato é um envio do cidadão dentro de um chamado.
type Relato struct {
	ID       string    `json:"id"`
	Texto    *string   `json:"texto"`
	Lat      float64   `json:"lat"`
	Lng      float64   `json:"lng"`
	CriadoEm time.Time `json:"criado_em"`
	// Tipo: relato (com foto) ou tambem_vi (confirmação de quem passou perto).
	Tipo         string `json:"tipo"`
	MidiaURL     string `json:"midia_url,omitempty"`
	midiaPublica string
	// Morador é quem enviou, com o documento mascarado; nulo no relato sem
	// cadastro (demonstração, envio anterior ao cadastro ou conta apagada).
	Morador *QuemRelatou `json:"morador"`
}

// QuemRelatou é o que a central vê de quem relatou. O documento completo só
// abre pela rota auditada do gestor (Ver documento).
type QuemRelatou struct {
	Nome               string  `json:"nome"`
	Tipo               string  `json:"tipo"`
	DocumentoMascarado string  `json:"documento_mascarado"`
	Profissao          *string `json:"profissao"`
}

// Nova reúne o que é gravado na criação.
type Nova struct {
	ID            string
	Categoria     string
	Secretaria    string
	Texto         string
	Lat, Lng      float64
	PrecisaoM     *float32
	Endereco      string
	Bairro        string
	MidiaOriginal string
	MidiaPublica  string
	Status        string
	Nivel         *int16
	Triagem       triagem.Registro
	PrazoAte      *time.Time
	PrazoFonte    string
	Etapas        []triagem.Etapa
	LatenciaMS    int64
	Demo          bool
	// Só a semente da demo preenche: espalha os chamados simulados no tempo.
	CriadoEm *time.Time
	// IDCliente é a chave de idempotência do aparelho; Chave é o segredo de
	// acompanhamento devolvido ao morador.
	IDCliente string
	Chave     string
	Aparelho  string
	// Manual: o ponto foi marcado à mão no mapa, não lido do GPS.
	Manual bool
	// Midias são os arquivos do relato. Vazio, vale a foto única de
	// MidiaOriginal e MidiaPublica (semente da demo).
	Midias []NovaMidia
	// RetencaoDias é em quantos dias a original deve ser apagada; 0 não marca.
	RetencaoDias int
	// MoradorID é o cadastro de quem relatou; vazio grava nulo (demo).
	MoradorID string
	// ForaDoEscopo: a triagem achou que a foto é de local privado. O relato
	// vira chamado próprio, sem agrupar e fora do "Perto de você".
	ForaDoEscopo bool
}

func (n Nova) custo() float64 {
	var c float64
	for _, e := range n.Etapas {
		c += e.CustoBRL
	}
	return c
}

var (
	ErrNaoEncontrada = errors.New("ocorrência não encontrada")
	ErrNaoRevisavel  = errors.New("ocorrência não está em revisão")
	ErrTransicao     = errors.New("o status atual não permite esta ação")
	// ErrRepetido: já existe um relato com a mesma chave de idempotência.
	ErrRepetido = errors.New("relato já recebido")
)

// O raio e a janela do agrupamento (C4) são parâmetros da cidade: veja
// cidade.Parametros. Os padrões são 50 m e 30 dias, a calibrar no piloto.

// foraDoEscopo lê do registro da triagem se o chamado parece de local
// privado. Esses chamados não agrupam nem aparecem para os moradores.
const (
	foraDoEscopo           = `COALESCE((o.triagem->>'fora_do_escopo')::boolean, false)`
	foraDoEscopoSemPrefixo = `COALESCE((triagem->>'fora_do_escopo')::boolean, false)`
)

var reUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Repositorio struct {
	pool *pgxpool.Pool
	// Cidade é a cidade desta instalação, gravada em cada chamado (ADR 0021).
	Cidade string
	// Parametros devolve os ajustes em vigor (ADR 0018). Nulo vale o padrão.
	Parametros func(context.Context) cidade.Parametros
}

func NovoRepositorio(pool *pgxpool.Pool) *Repositorio {
	return &Repositorio{pool: pool, Cidade: "itamogi"}
}

func (r *Repositorio) parametros(ctx context.Context) cidade.Parametros {
	if r.Parametros == nil {
		return cidade.Padrao()
	}
	return r.Parametros(ctx)
}

const colunas = `id, protocolo, categoria, secretaria, texto, ST_Y(local::geometry), ST_X(local::geometry),
	precisao_m, h3_r9, endereco, bairro, midia_publica, status, nivel, nivel_ia, relatos, triagem,
	prazo_ate, prazo_fonte, revisado_por, revisado_em, despachado_por, despachado_em,
	resolvido_por, resolvido_em, custo_brl::float8, latencia_ms, demo, criado_em, atualizado_em`

func escanear(row pgx.Row) (Ocorrencia, error) {
	var o Ocorrencia
	var tri []byte
	err := row.Scan(&o.ID, &o.Protocolo, &o.Categoria, &o.Secretaria, &o.Texto, &o.Lat, &o.Lng,
		&o.PrecisaoM, &o.H3, &o.Endereco, &o.Bairro, &o.midiaPublica, &o.Status, &o.Nivel, &o.NivelIA, &o.Relatos, &tri,
		&o.PrazoAte, &o.PrazoFonte, &o.RevisadoPor, &o.RevisadoEm, &o.DespachadoPor, &o.DespachadoEm,
		&o.ResolvidoPor, &o.ResolvidoEm, &o.CustoBRL, &o.LatenciaMS, &o.Demo, &o.CriadoEm, &o.AtualizadoEm)
	if tri != nil {
		o.Triagem = tri
	}
	return o, err
}

// Reavaliador recalcula a triagem de um chamado quando ele ganha relatos.
type Reavaliador func(ctx context.Context, reg triagem.Registro, relatos int) (triagem.Registro, int16, error)

// Registrar grava o relato. Se já existe um chamado aberto da mesma
// categoria a menos de 50 m, o relato entra nele, a tendência é recalculada
// e o nível pode subir (RF08, C4); senão nasce um chamado novo. O segundo
// valor diz se houve agrupamento.
func (r *Repositorio) Registrar(ctx context.Context, n Nova, reavaliar Reavaliador, agora time.Time) (Ocorrencia, bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Ocorrencia{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Dois primeiros relatos do mesmo problema, chegando juntos, criariam
	// dois chamados: o FOR UPDATE do agrupamento só trava linha que já existe.
	// A trava por categoria põe os registros em fila durante a transação.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('mogi.agrupar:' || $1))`, n.Categoria); err != nil {
		return Ocorrencia{}, false, err
	}

	var o Ocorrencia
	agrupada := false
	// "outros" e "a classificar" não agrupam: não dá para dizer que é o mesmo problema.
	if n.Categoria != "outros" && n.Status != "a_classificar" && !n.ForaDoEscopo && reavaliar != nil {
		o, agrupada, err = r.agrupar(ctx, tx, n, reavaliar, agora)
		if err != nil {
			return Ocorrencia{}, false, err
		}
	}
	if !agrupada {
		tri, err := json.Marshal(n.Triagem)
		if err != nil {
			return Ocorrencia{}, false, err
		}
		o, err = escanear(tx.QueryRow(ctx, `INSERT INTO ocorrencias
			(id, categoria, secretaria, texto, local, precisao_m, endereco, bairro, midia_original, midia_publica,
			 status, nivel, nivel_ia, triagem, prazo_ate, prazo_fonte, custo_brl, latencia_ms, demo, criado_em, cidade)
			VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography, $7,
			        NULLIF($8, ''), NULLIF($9, ''), $10, $11, $12, $13, $13, $14, $15, NULLIF($16, ''), $17, $18, $19,
			        COALESCE($20, now()), $21)
			RETURNING `+colunas,
			n.ID, n.Categoria, n.Secretaria, n.Texto, n.Lat, n.Lng, n.PrecisaoM, n.Endereco, n.Bairro,
			n.MidiaOriginal, n.MidiaPublica, n.Status, n.Nivel, tri, n.PrazoAte, n.PrazoFonte,
			n.custo(), n.LatenciaMS, n.Demo, n.CriadoEm, r.Cidade))
		if err != nil {
			return Ocorrencia{}, false, err
		}
	}
	var relatoID string
	if err := tx.QueryRow(ctx, `INSERT INTO relatos (ocorrencia_id, texto, local, precisao_m, midia_original, midia_publica,
			criado_em, id_cliente, chave, aparelho, agrupou, manual, endereco, bairro, morador_id)
		VALUES ($1, NULLIF($2, ''), ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6, $7, COALESCE($8, now()),
		        NULLIF($9, '')::uuid, NULLIF($10, ''), NULLIF($11, ''), $12, $13, NULLIF($14, ''), NULLIF($15, ''),
		        NULLIF($16, '')::uuid)
		RETURNING id`,
		o.ID, n.Texto, n.Lat, n.Lng, n.PrecisaoM, n.MidiaOriginal, n.MidiaPublica, n.CriadoEm,
		n.IDCliente, n.Chave, n.Aparelho, agrupada, n.Manual, n.Endereco, n.Bairro, n.MoradorID).Scan(&relatoID); err != nil {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" && pg.ConstraintName == "relatos_id_cliente_idx" {
			return Ocorrencia{}, false, ErrRepetido
		}
		return Ocorrencia{}, false, err
	}
	midias := n.Midias
	if len(midias) == 0 {
		// Foto única (semente da demo): a simulada não tem original de verdade.
		unica := NovaMidia{Tipo: "foto", Mime: "image/jpeg", ChavePublica: n.MidiaPublica}
		if n.MidiaOriginal != n.MidiaPublica {
			unica.ChaveOriginal = n.MidiaOriginal
		}
		midias = []NovaMidia{unica}
	}
	for i, m := range midias {
		if err := inserirMidia(ctx, tx, o.ID, relatoID, i, m, n.RetencaoDias, n.CriadoEm); err != nil {
			return Ocorrencia{}, false, err
		}
	}
	tipo, dados := "criada", map[string]any{"nivel": o.Nivel, "status": o.Status}
	if agrupada {
		tipo, dados = "relato", map[string]any{"relatos": o.Relatos, "nivel": o.Nivel}
	}
	if err := registrarEvento(ctx, tx, o.ID, tipo, "", dados, n.CriadoEm); err != nil {
		return Ocorrencia{}, false, err
	}
	for _, e := range n.Etapas {
		if _, err := tx.Exec(ctx, `INSERT INTO triagem_etapas
			(ocorrencia_id, etapa, provedor, ms, custo_brl, tokens_entrada, tokens_saida, ok, erro, criado_em)
			VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, NULLIF($9, ''), COALESCE($10, now()))`,
			o.ID, e.Nome, e.Provedor, e.MS, e.CustoBRL, e.TokensEntrada, e.TokensSaida, e.OK, e.Erro, n.CriadoEm); err != nil {
			return Ocorrencia{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Ocorrencia{}, false, err
	}
	return o, agrupada, nil
}

// inserirMidia grava uma linha de mídia. Só a original tem data de apagar.
func inserirMidia(ctx context.Context, tx pgx.Tx, ocorrencia, relato string, ordem int, m NovaMidia, retencaoDias int, quando *time.Time) error {
	var dias *int
	if retencaoDias > 0 && m.ChaveOriginal != "" {
		dias = &retencaoDias
	}
	_, err := tx.Exec(ctx, `INSERT INTO midias (ocorrencia_id, relato_id, ordem, tipo, mime, chave_original, chave_publica,
			largura, altura, duracao_ms, bytes, apagar_em, criado_em)
		VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, 0), NULLIF($9, 0),
		        NULLIF($10, 0), $11, COALESCE($13, now()) + make_interval(days => $12), COALESCE($13, now()))`,
		ocorrencia, relato, ordem, m.Tipo, m.Mime, m.ChaveOriginal, m.ChavePublica,
		m.Largura, m.Altura, m.DuracaoMS, m.Bytes, dias, quando)
	return err
}

// registrarEvento grava uma linha do histórico dentro da transação da ação.
func registrarEvento(ctx context.Context, tx pgx.Tx, ocorrencia, tipo, autor string, dados map[string]any, quando *time.Time) error {
	if dados == nil {
		dados = map[string]any{}
	}
	b, err := json.Marshal(dados)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO eventos (ocorrencia_id, tipo, autor, dados, criado_em)
		VALUES ($1, $2, NULLIF($3, ''), $4, COALESCE($5, now()))`, ocorrencia, tipo, autor, b, quando)
	return err
}

// ReciboDe monta a resposta ao morador a partir do chamado e do próprio relato.
func ReciboDe(o Ocorrencia, n Nova, agrupada bool) Recibo {
	nulo := func(s string) *string {
		if s == "" {
			return nil
		}
		return &s
	}
	criado := time.Now()
	if !agrupada {
		criado = o.CriadoEm
	}
	return Recibo{
		Protocolo: o.Protocolo, Chave: n.Chave, Status: o.Status, Nivel: o.Nivel,
		Categoria: o.Categoria, Secretaria: o.Secretaria, PrazoAte: o.PrazoAte, PrazoFonte: o.PrazoFonte,
		Endereco: nulo(n.Endereco), Bairro: nulo(n.Bairro), Agrupada: agrupada, Relatos: o.Relatos, CriadoEm: criado,
		ForaDoEscopo: n.ForaDoEscopo,
	}
}

// ReciboPorCliente devolve o recibo de um relato já recebido com esta chave
// de idempotência. O segundo valor diz se ele existe.
func (r *Repositorio) ReciboPorCliente(ctx context.Context, idCliente string) (Recibo, bool, error) {
	if !reUUID.MatchString(idCliente) {
		return Recibo{}, false, nil
	}
	var rc Recibo
	var chave *string
	err := r.pool.QueryRow(ctx, `SELECT o.protocolo, x.chave, o.status, o.nivel, o.categoria, o.secretaria,
			o.prazo_ate, o.prazo_fonte, x.endereco, x.bairro, x.agrupou, o.relatos, x.criado_em, `+foraDoEscopo+`
		FROM relatos x JOIN ocorrencias o ON o.id = x.ocorrencia_id WHERE x.id_cliente = $1`, idCliente).
		Scan(&rc.Protocolo, &chave, &rc.Status, &rc.Nivel, &rc.Categoria, &rc.Secretaria,
			&rc.PrazoAte, &rc.PrazoFonte, &rc.Endereco, &rc.Bairro, &rc.Agrupada, &rc.Relatos, &rc.CriadoEm, &rc.ForaDoEscopo)
	if errors.Is(err, pgx.ErrNoRows) {
		return Recibo{}, false, nil
	}
	if err != nil {
		return Recibo{}, false, err
	}
	if chave != nil {
		rc.Chave = *chave
	}
	rc.Repetido = true
	return rc, true, nil
}

func (r *Repositorio) agrupar(ctx context.Context, tx pgx.Tx, n Nova, reavaliar Reavaliador, agora time.Time) (Ocorrencia, bool, error) {
	var a alvo
	p := r.parametros(ctx)
	janela := time.Duration(p.JanelaAgrupamentoDias) * 24 * time.Hour
	err := tx.QueryRow(ctx, `SELECT id, triagem, nivel, status, relatos FROM ocorrencias
		WHERE categoria = $1 AND status <> 'resolvida' AND demo = $5 AND criado_em > $6 AND NOT `+foraDoEscopoSemPrefixo+`
		  AND ST_DWithin(local, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
		ORDER BY ST_Distance(local, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
		LIMIT 1 FOR UPDATE`,
		n.Categoria, n.Lat, n.Lng, p.RaioAgrupamentoM, n.Demo, agora.Add(-janela)).
		Scan(&a.id, &a.triagem, &a.nivel, &a.status, &a.relatos)
	if errors.Is(err, pgx.ErrNoRows) {
		return Ocorrencia{}, false, nil
	}
	if err != nil {
		return Ocorrencia{}, false, err
	}
	o, err := r.somarRelato(ctx, tx, a, n.Nivel, n.custo(), reavaliar, agora)
	return o, err == nil, err
}

// alvo é o chamado que vai receber mais um relato, já travado na transação.
type alvo struct {
	id      string
	triagem []byte
	nivel   *int16
	status  string
	relatos int
}

// somarRelato acrescenta um relato a um chamado que já existe. A tendência
// é recalculada com um relato a mais; se o relato novo foi triado sozinho
// num nível mais alto (o problema piorou), vale o mais alto dos dois.
func (r *Repositorio) somarRelato(ctx context.Context, tx pgx.Tx, a alvo, nivelDoRelato *int16, custo float64, reavaliar Reavaliador, agora time.Time) (Ocorrencia, error) {
	a.relatos++
	// Reaplica a regra com a tendência reforçada. Se algo falhar, o relato
	// entra no chamado do mesmo jeito e a triagem antiga continua valendo.
	var reg triagem.Registro
	novoNivel := int16(0)
	if reavaliar != nil && json.Unmarshal(a.triagem, &reg) == nil && reg.Classificacao != nil {
		if novo, nv, err := reavaliar(ctx, reg, a.relatos); err == nil {
			reg, novoNivel = novo, nv
			if b, err := json.Marshal(reg); err == nil {
				a.triagem = b
			}
		}
	}
	if nivelDoRelato != nil && *nivelDoRelato > novoNivel {
		novoNivel = *nivelDoRelato
	}
	// O nível só sobe sozinho; baixar é decisão do operador. Subindo para
	// 4 ou 5, um chamado que estava aberto volta para a revisão humana (RF07).
	sobe := a.nivel != nil && novoNivel > *a.nivel
	var prazo *time.Time
	var fonte string
	if sobe {
		if novoNivel >= 4 && a.status == "aberta" {
			a.status = "revisao"
		}
		prazo, fonte = triagem.Prazo(int(novoNivel), agora)
	}
	return escanear(tx.QueryRow(ctx, `UPDATE ocorrencias SET
			relatos = $2, triagem = $3, status = $4,
			nivel = CASE WHEN $5 THEN $6 ELSE nivel END,
			nivel_ia = CASE WHEN $5 THEN $6 ELSE nivel_ia END,
			prazo_ate = CASE WHEN $5 THEN $7 ELSE prazo_ate END,
			prazo_fonte = CASE WHEN $5 THEN NULLIF($8, '') ELSE prazo_fonte END,
			custo_brl = custo_brl + $9
		WHERE id = $1 RETURNING `+colunas,
		a.id, a.relatos, a.triagem, a.status, sobe, novoNivel, prazo, fonte, custo))
}

func (r *Repositorio) Buscar(ctx context.Context, id string) (Ocorrencia, error) {
	if !reUUID.MatchString(id) {
		return Ocorrencia{}, ErrNaoEncontrada
	}
	o, err := escanear(r.pool.QueryRow(ctx, `SELECT `+colunas+` FROM ocorrencias WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNaoEncontrada
	}
	return o, err
}

// Detalhes preenche os relatos agrupados e o log de etapas do chamado (T6).
func (r *Repositorio) Detalhes(ctx context.Context, o *Ocorrencia) error {
	rows, err := r.pool.Query(ctx, `SELECT x.id, x.texto, ST_Y(x.local::geometry), ST_X(x.local::geometry), x.criado_em,
			COALESCE(x.midia_publica, ''), x.tipo, m.nome, m.tipo, COALESCE(m.documento_final, ''), m.profissao
		FROM relatos x LEFT JOIN moradores m ON m.id = x.morador_id
		WHERE x.ocorrencia_id = $1 ORDER BY x.criado_em LIMIT 200`, o.ID)
	if err != nil {
		return err
	}
	o.RelatosLista, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Relato, error) {
		var x Relato
		var nome, tipo *string
		var q QuemRelatou
		err := row.Scan(&x.ID, &x.Texto, &x.Lat, &x.Lng, &x.CriadoEm, &x.midiaPublica, &x.Tipo,
			&nome, &tipo, &q.DocumentoMascarado, &q.Profissao)
		if err == nil && nome != nil && tipo != nil {
			q.Nome, q.Tipo = *nome, *tipo
			x.Morador = &q
		}
		return x, err
	})
	if err != nil {
		return err
	}
	rows, err = r.pool.Query(ctx, `SELECT etapa, COALESCE(provedor, ''), ms, custo_brl::float8, tokens_entrada, tokens_saida, ok, COALESCE(erro, '')
		FROM triagem_etapas WHERE ocorrencia_id = $1 ORDER BY id LIMIT 500`, o.ID)
	if err != nil {
		return err
	}
	o.Etapas, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (triagem.Etapa, error) {
		var e triagem.Etapa
		err := row.Scan(&e.Nome, &e.Provedor, &e.MS, &e.CustoBRL, &e.TokensEntrada, &e.TokensSaida, &e.OK, &e.Erro)
		return e, err
	})
	if err != nil {
		return err
	}
	rows, err = r.pool.Query(ctx, `SELECT tipo, autor, dados, criado_em FROM eventos
		WHERE ocorrencia_id = $1 ORDER BY criado_em, id LIMIT 500`, o.ID)
	if err != nil {
		return err
	}
	o.Eventos, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Evento, error) {
		var e Evento
		var dados []byte
		err := row.Scan(&e.Tipo, &e.Autor, &dados, &e.CriadoEm)
		e.Dados = dados
		return e, err
	})
	if err != nil {
		return err
	}
	rows, err = r.pool.Query(ctx, `SELECT id, relato_id, tipo, mime, ordem, largura, altura, duracao_ms, criado_em,
			COALESCE(chave_publica, ''), (chave_publica IS NOT NULL OR chave_original IS NOT NULL)
		FROM midias WHERE ocorrencia_id = $1 ORDER BY criado_em, ordem LIMIT 1000`, o.ID)
	if err != nil {
		return err
	}
	o.Midias, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Midia, error) {
		var m Midia
		err := row.Scan(&m.ID, &m.RelatoID, &m.Tipo, &m.Mime, &m.Ordem, &m.Largura, &m.Altura, &m.DuracaoMS, &m.CriadoEm,
			&m.chavePublica, &m.Disponivel)
		return m, err
	})
	return err
}

// ErrMidiaIndisponivel: a mídia não existe, não é vídeo ou já foi apagada.
var ErrMidiaIndisponivel = errors.New("vídeo indisponível")

// AbrirVideo devolve a chave do vídeo original de um chamado e grava no
// histórico quem abriu. O vídeo não é borrado, então cada acesso é auditado.
func (r *Repositorio) AbrirVideo(ctx context.Context, ocorrencia, midia, login string) (string, error) {
	if !reUUID.MatchString(ocorrencia) || !reUUID.MatchString(midia) {
		return "", ErrMidiaIndisponivel
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var chave *string
	err = tx.QueryRow(ctx, `SELECT chave_original FROM midias
		WHERE id = $1 AND ocorrencia_id = $2 AND tipo = 'video'`, midia, ocorrencia).Scan(&chave)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && chave == nil) {
		return "", ErrMidiaIndisponivel
	}
	if err != nil {
		return "", err
	}
	if err := registrarEvento(ctx, tx, ocorrencia, "video_visto", login, map[string]any{"midia": midia}, nil); err != nil {
		return "", err
	}
	return *chave, tx.Commit(ctx)
}

// OriginalVencida é uma mídia cuja original passou do prazo de retenção.
type OriginalVencida struct{ ID, Chave string }

// OriginaisVencidas lista as originais a apagar do armazenamento.
func (r *Repositorio) OriginaisVencidas(ctx context.Context, agora time.Time, limite int) ([]OriginalVencida, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, chave_original FROM midias
		WHERE chave_original IS NOT NULL AND apagar_em <= $1 ORDER BY apagar_em LIMIT $2`, agora, limite)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[OriginalVencida])
}

// MarcarOriginalApagada tira do banco a referência a uma original já
// removida do armazenamento, inclusive nas colunas antigas de capa.
func (r *Repositorio) MarcarOriginalApagada(ctx context.Context, v OriginalVencida) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `UPDATE midias SET chave_original = NULL, apagada_em = now() WHERE id = $1`, v.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE relatos SET midia_original = NULL WHERE midia_original = $1`, v.Chave); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE ocorrencias SET midia_original = NULL WHERE midia_original = $1`, v.Chave); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// acao descreve o evento gravado junto de uma transição de status.
type acao struct {
	tipo  string
	autor string
	dados map[string]any
}

// mudar aplica uma transição de status, grava o evento no histórico na mesma
// transação e traduz os erros comuns.
func (r *Repositorio) mudar(ctx context.Context, id, sql string, semLinha error, a acao, args ...any) (Ocorrencia, error) {
	return r.mudarCom(ctx, id, sql, semLinha, a, nil, args...)
}

// mudarCom é o mudar com um passo a mais dentro da mesma transação (por
// exemplo, gravar as fotos do depois junto da resolução).
func (r *Repositorio) mudarCom(ctx context.Context, id, sql string, semLinha error, a acao, extra func(pgx.Tx, Ocorrencia) error, args ...any) (Ocorrencia, error) {
	if !reUUID.MatchString(id) {
		return Ocorrencia{}, ErrNaoEncontrada
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Ocorrencia{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	o, err := escanear(tx.QueryRow(ctx, sql+` RETURNING `+colunas, append([]any{id}, args...)...))
	if errors.Is(err, pgx.ErrNoRows) {
		if _, errBusca := r.Buscar(ctx, id); errors.Is(errBusca, ErrNaoEncontrada) {
			return o, ErrNaoEncontrada
		}
		return o, semLinha
	}
	if err != nil {
		return o, err
	}
	if extra != nil {
		if err := extra(tx, o); err != nil {
			return o, err
		}
	}
	if err := registrarEvento(ctx, tx, o.ID, a.tipo, a.autor, a.dados, nil); err != nil {
		return o, err
	}
	return o, tx.Commit(ctx)
}

// semVazios tira do evento os campos de texto que vieram em branco.
func semVazios(m map[string]any) map[string]any {
	for k, v := range m {
		if s, ok := v.(string); ok && s == "" {
			delete(m, k)
		}
	}
	return m
}

// Revisar fecha a revisão humana com o nível confirmado pelo operador (RF07).
func (r *Repositorio) Revisar(ctx context.Context, id string, nivel int16, login string, prazo *time.Time, fonte string) (Ocorrencia, error) {
	return r.mudar(ctx, id, `UPDATE ocorrencias
		SET nivel = $2, status = 'aberta', revisado_por = $3, revisado_em = now(),
		    prazo_ate = $4, prazo_fonte = $5
		WHERE id = $1 AND status IN ('revisao', 'a_classificar')`, ErrNaoRevisavel,
		acao{"revisada", login, map[string]any{"nivel": nivel}}, nivel, login, prazo, fonte)
}

// Despachar manda a equipe: o chamado aberto passa a em atendimento. Com
// secretaria, o operador troca a responsável na hora de despachar.
func (r *Repositorio) Despachar(ctx context.Context, id, login, observacao, secretaria string) (Ocorrencia, error) {
	return r.mudar(ctx, id, `UPDATE ocorrencias
		SET status = 'em_atendimento', despachado_por = $2, despachado_em = now(),
		    secretaria = COALESCE(NULLIF($3, ''), secretaria)
		WHERE id = $1 AND status = 'aberta'`, ErrTransicao,
		acao{"despachada", login, semVazios(map[string]any{"observacao": observacao, "secretaria": secretaria})}, login, secretaria)
}

// Resolver encerra o chamado. As fotos do depois, já gravadas no
// armazenamento, entram como mídias do chamado na mesma transação.
func (r *Repositorio) Resolver(ctx context.Context, id, login, motivo string, fotos []NovaMidia) (Ocorrencia, error) {
	dados := semVazios(map[string]any{"motivo": motivo})
	if len(fotos) > 0 {
		dados["fotos"] = len(fotos)
	}
	return r.mudarCom(ctx, id, `UPDATE ocorrencias
		SET status = 'resolvida', resolvido_por = $2, resolvido_em = now()
		WHERE id = $1 AND status IN ('aberta', 'em_atendimento')`, ErrTransicao,
		acao{"resolvida", login, dados},
		func(tx pgx.Tx, o Ocorrencia) error {
			for i, f := range fotos {
				if err := inserirMidia(ctx, tx, o.ID, "", i, f, 0, nil); err != nil {
					return err
				}
			}
			return nil
		}, login)
}

// NaoEncontrado devolve para a revisão um chamado que a equipe foi atender
// e não achou no local. O motivo fica no histórico.
func (r *Repositorio) NaoEncontrado(ctx context.Context, id, login, motivo string) (Ocorrencia, error) {
	return r.mudar(ctx, id, `UPDATE ocorrencias SET status = 'revisao'
		WHERE id = $1 AND status = 'em_atendimento'`, ErrTransicao,
		acao{"nao_encontrada", login, map[string]any{"motivo": motivo}})
}

// Reabrir devolve um chamado resolvido para a fila de abertos: o problema
// voltou ou foi fechado por engano. O motivo fica no histórico.
func (r *Repositorio) Reabrir(ctx context.Context, id, login, motivo string) (Ocorrencia, error) {
	return r.mudar(ctx, id, `UPDATE ocorrencias
		SET status = 'aberta', resolvido_por = NULL, resolvido_em = NULL
		WHERE id = $1 AND status = 'resolvida'`, ErrTransicao,
		acao{"reaberta", login, map[string]any{"motivo": motivo}})
}

// Listar devolve as ocorrências mais recentes. Com status (um ou vários,
// separados por vírgula), vira a fila: nível, depois GUT esperada (ADR 0010).
//
// Com secretaria, só entram os chamados dela (visão da equipe de campo).
func (r *Repositorio) Listar(ctx context.Context, status string, limite int, secretaria string) ([]Ocorrencia, error) {
	q := `SELECT ` + colunas + ` FROM ocorrencias WHERE ($2 = '' OR secretaria = $2)`
	args := []any{limite, secretaria}
	if status != "" {
		q += ` AND status = ANY($3) ORDER BY nivel DESC NULLS FIRST,
			(triagem->>'gut_esperada')::numeric DESC NULLS LAST, criado_em`
		args = append(args, strings.Split(status, ","))
	} else {
		q += ` ORDER BY criado_em DESC`
	}
	q += ` LIMIT $1`
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lista := []Ocorrencia{}
	for rows.Next() {
		o, err := escanear(rows)
		if err != nil {
			return nil, err
		}
		lista = append(lista, o)
	}
	return lista, rows.Err()
}

// Categoria é uma linha do cadastro editável pelo gestor (T7).
type Categoria struct {
	ID         string `json:"id"`
	Nome       string `json:"nome"`
	Secretaria string `json:"secretaria"`
}

func (r *Repositorio) Categorias(ctx context.Context) ([]Categoria, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, nome, secretaria FROM categorias ORDER BY ordem, id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Categoria])
}

// Secretarias lista as secretarias cadastradas nas categorias.
func (r *Repositorio) Secretarias(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT DISTINCT secretaria FROM categorias WHERE secretaria <> '' ORDER BY 1`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// Secretaria devolve a secretaria responsável pela categoria, ou "A definir".
func (r *Repositorio) Secretaria(ctx context.Context, categoria string) string {
	var s string
	if err := r.pool.QueryRow(ctx, `SELECT secretaria FROM categorias WHERE id = $1`, categoria).Scan(&s); err != nil {
		return "A definir"
	}
	return s
}

// AtualizarCategoria muda o nome exibido e a secretaria responsável.
func (r *Repositorio) AtualizarCategoria(ctx context.Context, c Categoria) error {
	tag, err := r.pool.Exec(ctx, `UPDATE categorias SET nome = $2, secretaria = $3 WHERE id = $1`, c.ID, c.Nome, c.Secretaria)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNaoEncontrada
	}
	return err
}

// Contar devolve quantos chamados existem (a semente da demo só roda no banco vazio).
func (r *Repositorio) Contar(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT count(*) FROM ocorrencias`).Scan(&n)
	return n, err
}

// ApagarDemo remove os chamados simulados e devolve quantos eram.
func (r *Repositorio) ApagarDemo(ctx context.Context) (int64, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM ocorrencias WHERE demo`)
	return tag.RowsAffected(), err
}
