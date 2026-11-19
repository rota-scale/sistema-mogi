-- Preparação para o teste de campo (15/11/2026): envio idempotente, chave de
-- acompanhamento do morador e histórico de eventos por chamado.

ALTER TABLE relatos
  -- Chave de idempotência gerada no aparelho: reenviar o mesmo relato não duplica.
  ADD COLUMN id_cliente  uuid,
  -- Segredo entregue só a quem enviou, para acompanhar o protocolo sem login.
  ADD COLUMN chave       text,
  -- Identificador aleatório do aparelho, usado só no limite de envios.
  ADD COLUMN aparelho    text,
  ADD COLUMN agrupou     boolean NOT NULL DEFAULT false,
  ADD COLUMN manual      boolean NOT NULL DEFAULT false,
  ADD COLUMN endereco    text,
  ADD COLUMN bairro      text;

CREATE UNIQUE INDEX relatos_id_cliente_idx ON relatos (id_cliente) WHERE id_cliente IS NOT NULL;

-- Linha do tempo e trilha de auditoria: quem fez o quê em cada chamado.
CREATE TABLE eventos (
  id             bigserial PRIMARY KEY,
  ocorrencia_id  uuid NOT NULL REFERENCES ocorrencias (id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  autor          text,
  dados          jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_ocorrencia_idx ON eventos (ocorrencia_id, id);

-- Reconstrói o histórico dos chamados que já existem a partir das colunas.
INSERT INTO eventos (ocorrencia_id, tipo, criado_em)
SELECT id, 'criada', criado_em FROM ocorrencias;

INSERT INTO eventos (ocorrencia_id, tipo, autor, dados, criado_em)
SELECT id, 'revisada', revisado_por, jsonb_build_object('nivel', nivel), revisado_em
  FROM ocorrencias WHERE revisado_em IS NOT NULL;

INSERT INTO eventos (ocorrencia_id, tipo, autor, criado_em)
SELECT id, 'despachada', despachado_por, despachado_em
  FROM ocorrencias WHERE despachado_em IS NOT NULL;

INSERT INTO eventos (ocorrencia_id, tipo, autor, criado_em)
SELECT id, 'resolvida', resolvido_por, resolvido_em
  FROM ocorrencias WHERE resolvido_em IS NOT NULL;
