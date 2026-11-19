-- Observabilidade mínima (ADR 0019): o que deu errado no aparelho do morador
-- ou da equipe chega ao servidor, sem dado pessoal, para o gestor acompanhar
-- o teste de campo na aba Operação.
CREATE TABLE telemetria (
  id         bigserial PRIMARY KEY,
  -- Código curto do que aconteceu: gps_negado, foto_ilegivel, envio_falhou...
  tipo       text NOT NULL,
  detalhe    text,
  tela       text,
  -- Família do navegador e do sistema, nunca o user agent inteiro.
  navegador  text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telemetria_quando_idx ON telemetria (criado_em DESC);
