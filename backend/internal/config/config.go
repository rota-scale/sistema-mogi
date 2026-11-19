// Package config lê a configuração do ambiente. Nenhum segredo tem valor padrão.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Endereco   string // onde a API escuta, ex.: 0.0.0.0:8080
	BancoURL   string
	JWTSegredo []byte
	// DocumentoChave cifra o CPF e o CNPJ do morador e gera o HMAC que acha
	// o cadastro (ADR 0024). Vazia, sai do JWT_SEGREDO (.env antigo) e
	// DocumentoChaveDerivada fica verdadeiro, para o aviso no log.
	DocumentoChave         []byte
	DocumentoChaveDerivada bool
	SeedLogin              string
	SeedSenha              string
	S3Endpoint             string // host:porta usado pelo Go e nas URLs pré-assinadas
	S3AccessKey            string
	S3SecretKey            string
	S3Bucket               string
	S3SSL                  bool
	NominatimURL           string // vazio desliga a geocodificação
	NominatimAgent         string
	CepURL                 string // ViaCEP; vazio desliga a busca do CEP
	AlertaURL              string // webhook dos alertas (ntfy, Slack, Discord); vazio fica só no log e na aba Operação
	RegrasDir              string
	Cidade                 string
	Origens                []string // origens aceitas no WebSocket

	OperadorLogin string // segundo usuário inicial, com papel operador
	OperadorSenha string
	// Terceiro usuário inicial: equipe de campo de uma secretaria (ADR 0016).
	CampoLogin      string
	CampoSenha      string
	CampoSecretaria string
	// Conta do prefeito (gabinete, só leitura). Sem senha, não é criada.
	PrefeitoLogin string
	PrefeitoSenha string
	PrefeitoNome  string
	// IA com visão e saída estruturada (RF04, RF05, RF12). Sem chave, a
	// triagem roda só com o classificador local.
	IAChave  string
	IAModelo string
	// IAModeloCena confere se a foto é de lugar público antes de gravar: modelo
	// rápido, porque o morador espera a resposta.
	IAModeloCena string
	// Jev da TypeSafe (ADR 0007): decisão tipada na frente da cadeia.
	JevChave  string
	JevBase   string
	JevModelo string
	// JevFoto manda a foto borrada ao Jev. Ligado por padrão desde que o
	// Russo liberou em 12/11/2026 (docs/decisoes-e-pendencias.md).
	JevFoto bool
	Cambio  float64 // reais por dólar, para o log de custo (RF11)
	// Borrador: "seletivo" (rostos e placas) ou "total" (foto inteira).
	Borrador string
	WebDir   string // build do painel servido pelo próprio Go; vazio desliga
	// DemoChamados é quantos chamados simulados criar quando o banco está vazio.
	DemoChamados int
	// CidadeNome aparece no app do morador; CidadeCaixa é a cerca do município
	// ("minLng,minLat,maxLng,maxLat"). Vazia, aceita relato de qualquer lugar.
	CidadeNome  string
	CidadeCaixa string
	// CidadeCentro ("lat,lng") só vale na criação de uma cidade nova.
	CidadeCentro string
	// ProxyConfiavel: o servidor está atrás de túnel ou proxy reverso, então o
	// IP de quem chama vem nos cabeçalhos CF-Connecting-IP e X-Forwarded-For.
	ProxyConfiavel bool
	// Video liga o vídeo curto no relato (ADR 0015). Trava da instalação: com
	// false, o módulo fica desligado mesmo que o gestor ligue nos parâmetros.
	Video bool
}

func Carregar() (Config, error) {
	c := Config{
		Endereco:        valor("API_ENDERECO", "0.0.0.0:8080"),
		BancoURL:        os.Getenv("DATABASE_URL"),
		JWTSegredo:      []byte(os.Getenv("JWT_SEGREDO")),
		SeedLogin:       valor("SEED_LOGIN", "gestor"),
		SeedSenha:       os.Getenv("SEED_SENHA"),
		S3Endpoint:      valor("S3_ENDPOINT", "localhost:8333"),
		S3AccessKey:     os.Getenv("S3_ACCESS_KEY"),
		S3SecretKey:     os.Getenv("S3_SECRET_KEY"),
		S3Bucket:        valor("S3_BUCKET", "mogi-midia"),
		S3SSL:           os.Getenv("S3_SSL") == "true",
		NominatimURL:    strings.TrimRight(os.Getenv("NOMINATIM_URL"), "/"),
		NominatimAgent:  valor("NOMINATIM_AGENTE", "SistemaMOGI/0.1 (github.com/rota-scale/cidade-inteligente-akcit)"),
		CepURL:          strings.TrimRight(valorOuVazio("CEP_URL", "https://viacep.com.br/ws"), "/"),
		AlertaURL:       strings.TrimSpace(os.Getenv("ALERTA_URL")),
		RegrasDir:       valor("REGRAS_DIR", "regras"),
		Cidade:          valor("CIDADE", "itamogi"),
		Origens:         strings.Split(valor("WS_ORIGENS", "localhost:*,127.0.0.1:*"), ","),
		OperadorLogin:   valor("OPERADOR_LOGIN", "operador"),
		OperadorSenha:   os.Getenv("OPERADOR_SENHA"),
		CampoLogin:      valor("CAMPO_LOGIN", "equipe"),
		CampoSenha:      os.Getenv("CAMPO_SENHA"),
		CampoSecretaria: valor("CAMPO_SECRETARIA", "Obras e vias"),
		PrefeitoLogin:   valor("PREFEITO_LOGIN", "prefeito"),
		PrefeitoSenha:   os.Getenv("PREFEITO_SENHA"),
		PrefeitoNome:    os.Getenv("PREFEITO_NOME"),
		IAChave:         valor("IA_CHAVE", os.Getenv("ANTHROPIC_API_KEY")),
		IAModelo:        valor("IA_MODELO", "claude-opus-5-5"),
		IAModeloCena:    valor("IA_MODELO_CENA", "claude-haiku-5-5"),
		JevChave:        os.Getenv("TYPESAFE_API_KEY"),
		JevBase:         os.Getenv("TYPESAFE_BASE_URL"),
		JevModelo:       valor("JEV_MODELO", "jev-latest"),
		JevFoto:         valor("JEV_FOTO", "true") == "true",
		Borrador:        valor("BORRADOR", "seletivo"),
		WebDir:          valor("WEB_DIR", "web"),
		CidadeNome:      valor("CIDADE_NOME", "Itamogi-MG"),
		CidadeCaixa:     os.Getenv("CIDADE_CAIXA"),
		CidadeCentro:    valor("CIDADE_CENTRO", "-21.0793,-47.0486"),
		ProxyConfiavel:  os.Getenv("PROXY_CONFIAVEL") == "true",
	}
	c.Cambio, _ = strconv.ParseFloat(valor("CAMBIO_USD_BRL", "5.5"), 64)
	c.DemoChamados, _ = strconv.Atoi(os.Getenv("DEMO_CHAMADOS"))
	c.Video = valor("MODULO_VIDEO", "true") == "true"
	if c.BancoURL == "" {
		c.BancoURL = montarBancoURL()
	}
	c.DocumentoChave = []byte(os.Getenv("DOCUMENTO_CHAVE"))
	if len(c.DocumentoChave) == 0 {
		// A cifra deriva chaves próprias com rótulo, então o mesmo segredo
		// não vira a chave do JWT. Trocar depois deixa os documentos já
		// gravados ilegíveis: em instalação nova, o make env gera a chave.
		c.DocumentoChave, c.DocumentoChaveDerivada = c.JWTSegredo, true
	}
	var faltando []string
	if len(c.JWTSegredo) < 32 {
		faltando = append(faltando, "JWT_SEGREDO (32 caracteres ou mais)")
	}
	if !c.DocumentoChaveDerivada && len(c.DocumentoChave) < 32 {
		faltando = append(faltando, "DOCUMENTO_CHAVE (32 caracteres ou mais)")
	}
	if c.S3AccessKey == "" || c.S3SecretKey == "" {
		faltando = append(faltando, "S3_ACCESS_KEY e S3_SECRET_KEY")
	}
	if len(faltando) > 0 {
		return c, errors.New("configuração ausente: " + strings.Join(faltando, ", "))
	}
	return c, nil
}

func montarBancoURL() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(valor("POSTGRES_USER", "mogi"), os.Getenv("POSTGRES_PASSWORD")),
		Host:     fmt.Sprintf("%s:%s", valor("POSTGRES_HOST", "localhost"), valor("POSTGRES_PORTA", "5433")),
		Path:     valor("POSTGRES_DB", "mogi"),
		RawQuery: "sslmode=disable",
	}
	return u.String()
}

func valor(chave, padrao string) string {
	if v := os.Getenv(chave); v != "" {
		return v
	}
	return padrao
}

// valorOuVazio é como valor, mas a variável definida e vazia vale vazio
// (desliga o recurso); só a ausência usa o padrão.
func valorOuVazio(chave, padrao string) string {
	if v, ok := os.LookupEnv(chave); ok {
		return v
	}
	return padrao
}
