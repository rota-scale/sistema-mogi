// Package cidade trata a cidade como dado (ADR 0021) e guarda os parâmetros
// que o gestor ajusta sem reiniciar o servidor (ADR 0018): raios, janelas,
// limites e os módulos ligados. Nova regional é uma linha em cidades e uma
// pasta de regras; o código não muda.
package cidade

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Cidade é o cadastro do município atendido por esta instalação.
type Cidade struct {
	Slug      string  `json:"slug"`
	Nome      string  `json:"nome"`
	CentroLat float64 `json:"centro_lat"`
	CentroLng float64 `json:"centro_lng"`
	// Caixa é a cerca do município (minLng,minLat,maxLng,maxLat); vazia desliga.
	Caixa string `json:"caixa"`
}

// Modulos liga e desliga partes do sistema. A mesma imagem serve uma
// prefeitura que quer tudo e outra que começa só com foto e mapa.
type Modulos struct {
	Video bool `json:"video"` // vídeo curto no relato
	Perto bool `json:"perto"` // "Perto de você" e "Também vi"
	Campo bool `json:"campo"` // tela da equipe de campo
	Voz   bool `json:"voz"`   // ditado no app do morador
	// Cadastro exige o cadastro do morador (CPF ou CNPJ) para relatar e
	// para o "Também vi" (ADR 0024). Desligado, o envio volta a ser aberto.
	Cadastro bool `json:"cadastro"`
	// Recuperacao mostra o código de recuperação no cadastro e abre o
	// "Já tenho cadastro" em outro celular. Desligado (padrão do protótipo),
	// o cadastro fica no celular e o gestor libera um CPF repetido.
	Recuperacao bool `json:"recuperacao"`
}

// Parametros são os ajustes de uma cidade. Os padrões são os valores com que
// o piloto de Itamogi começou; todos estão marcados a calibrar nas ADRs.
type Parametros struct {
	// Agrupamento de relatos do mesmo problema (RF08).
	RaioAgrupamentoM      float64 `json:"raio_agrupamento_m"`
	JanelaAgrupamentoDias int     `json:"janela_agrupamento_dias"`
	// Raio da lista "Perto de você".
	RaioPertoM float64 `json:"raio_perto_m"`
	// Limites do envio aberto do morador, a cada 10 minutos.
	EnviosPorAparelho int `json:"envios_por_aparelho"`
	EnviosPorIP       int `json:"envios_por_ip"`
	// Em quantos dias a mídia original é apagada (0 nunca apaga).
	RetencaoDias int     `json:"retencao_dias"`
	Modulos      Modulos `json:"modulos"`
}

// Padrao devolve os valores de fábrica.
func Padrao() Parametros {
	return Parametros{
		RaioAgrupamentoM: 50, JanelaAgrupamentoDias: 30, RaioPertoM: 80,
		EnviosPorAparelho: 12, EnviosPorIP: 120, RetencaoDias: 90,
		Modulos: Modulos{Video: true, Perto: true, Campo: true, Voz: true, Cadastro: true},
	}
}

// Conferir recusa valores que quebrariam o sistema ou abririam uma brecha.
func (p Parametros) Conferir() error {
	switch {
	case p.RaioAgrupamentoM < 5 || p.RaioAgrupamentoM > 500:
		return errors.New("raio de agrupamento entre 5 e 500 metros")
	case p.JanelaAgrupamentoDias < 1 || p.JanelaAgrupamentoDias > 365:
		return errors.New("janela de agrupamento entre 1 e 365 dias")
	case p.RaioPertoM < 10 || p.RaioPertoM > 500:
		return errors.New("raio de perto de você entre 10 e 500 metros")
	case p.EnviosPorAparelho < 1 || p.EnviosPorAparelho > 200:
		return errors.New("envios por aparelho entre 1 e 200 a cada 10 minutos")
	case p.EnviosPorIP < p.EnviosPorAparelho || p.EnviosPorIP > 5000:
		return errors.New("envios por IP entre o limite por aparelho e 5000 a cada 10 minutos")
	case p.RetencaoDias < 0 || p.RetencaoDias > 3650:
		return errors.New("retenção entre 0 e 3650 dias")
	}
	return nil
}

// validadeDoCache é por quanto tempo os parâmetros lidos valem. Mudança
// feita no Admin vale na hora nesta instância (Salvar troca o cache) e em
// até esse tempo nas outras réplicas.
const validadeDoCache = 15 * time.Second

// Servico lê a cidade desta instalação e os parâmetros dela.
type Servico struct {
	pool *pgxpool.Pool
	slug string

	mu     sync.Mutex
	cache  Parametros
	lidoEm time.Time
	agora  func() time.Time
}

func Novo(pool *pgxpool.Pool, slug string) *Servico {
	return &Servico{pool: pool, slug: slug, agora: time.Now}
}

// Slug é a cidade desta instalação.
func (s *Servico) Slug() string { return s.slug }

// Garantir devolve a cidade, criando a linha se ela ainda não existir. O
// nome e a caixa vêm do ambiente (CIDADE_NOME e CIDADE_CAIXA) e valem sobre
// o que está no banco: é o jeito de configurar uma instalação sem SQL. O
// centro só é gravado na criação.
func (s *Servico) Garantir(ctx context.Context, nome, caixa string, centroLat, centroLng float64) (Cidade, error) {
	if nome == "" {
		nome = s.slug
	}
	if _, err := s.pool.Exec(ctx, `INSERT INTO cidades (slug, nome, centro_lat, centro_lng, caixa)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))
		ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, caixa = EXCLUDED.caixa`,
		s.slug, nome, centroLat, centroLng, caixa); err != nil {
		return Cidade{}, fmt.Errorf("cadastrar a cidade %s: %w", s.slug, err)
	}
	return s.Cidade(ctx)
}

// Cidade lê o cadastro da cidade desta instalação.
func (s *Servico) Cidade(ctx context.Context) (Cidade, error) {
	c := Cidade{Slug: s.slug}
	err := s.pool.QueryRow(ctx, `SELECT nome, centro_lat, centro_lng, COALESCE(caixa, '') FROM cidades WHERE slug = $1`, s.slug).
		Scan(&c.Nome, &c.CentroLat, &c.CentroLng, &c.Caixa)
	return c, err
}

// Atuais devolve os parâmetros em vigor. Se o banco falhar, vale o que
// estava em cache ou o padrão: o envio do morador não para por causa disso.
func (s *Servico) Atuais(ctx context.Context) Parametros {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.lidoEm.IsZero() && s.agora().Sub(s.lidoEm) < validadeDoCache {
		return s.cache
	}
	p, err := s.ler(ctx)
	if err != nil {
		if s.lidoEm.IsZero() {
			return Padrao()
		}
		return s.cache
	}
	s.cache, s.lidoEm = p, s.agora()
	return p
}

func (s *Servico) ler(ctx context.Context) (Parametros, error) {
	var bruto []byte
	err := s.pool.QueryRow(ctx, `SELECT valor FROM parametros WHERE cidade = $1`, s.slug).Scan(&bruto)
	if errors.Is(err, pgx.ErrNoRows) {
		return Padrao(), nil
	}
	if err != nil {
		return Parametros{}, err
	}
	return Mesclar(bruto)
}

// Mesclar aplica um documento salvo sobre o padrão: chave que não existe no
// documento (parâmetro criado depois) fica com o valor de fábrica.
func Mesclar(bruto []byte) (Parametros, error) {
	p := Padrao()
	if err := json.Unmarshal(bruto, &p); err != nil {
		return Parametros{}, err
	}
	if err := p.Conferir(); err != nil {
		return Padrao(), nil // documento antigo fora da faixa: volta ao padrão
	}
	return p, nil
}

// Salvar grava os parâmetros novos e guarda a versão anterior no histórico.
func (s *Servico) Salvar(ctx context.Context, p Parametros, autor string) error {
	if err := p.Conferir(); err != nil {
		return err
	}
	novo, err := json.Marshal(p)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `INSERT INTO parametros_historico (cidade, valor, autor)
		SELECT cidade, valor, atualizado_por FROM parametros WHERE cidade = $1`, s.slug); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO parametros (cidade, valor, atualizado_por) VALUES ($1, $2, $3)
		ON CONFLICT (cidade) DO UPDATE SET valor = EXCLUDED.valor, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
		s.slug, novo, autor); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	s.mu.Lock()
	s.cache, s.lidoEm = p, s.agora()
	s.mu.Unlock()
	return nil
}
