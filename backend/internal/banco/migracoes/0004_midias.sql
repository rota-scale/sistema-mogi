-- Mídia v2 (ADR 0015): várias fotos e um vídeo curto por relato, foto do
-- depois na resolução e data de apagar a original (retenção).

CREATE TABLE midias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id   uuid NOT NULL REFERENCES ocorrencias (id) ON DELETE CASCADE,
  -- Nulo quando a mídia não veio de um relato (foto do depois, da equipe).
  relato_id       uuid REFERENCES relatos (id) ON DELETE CASCADE,
  ordem           smallint NOT NULL DEFAULT 0,
  -- foto: do morador, com original e versão borrada. quadro: quadro de um
  -- vídeo, só borrado. video: só o original, restrito. depois: foto da equipe.
  tipo            text NOT NULL CHECK (tipo IN ('foto', 'quadro', 'video', 'depois')),
  mime            text NOT NULL,
  chave_original  text,
  chave_publica   text,
  largura         integer,
  altura          integer,
  duracao_ms      integer,
  bytes           bigint NOT NULL DEFAULT 0,
  -- Quando a original deve ser apagada do armazenamento, e quando foi.
  apagar_em       timestamptz,
  apagada_em      timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX midias_ocorrencia_idx ON midias (ocorrencia_id, criado_em, ordem);
CREATE INDEX midias_apagar_idx ON midias (apagar_em) WHERE chave_original IS NOT NULL;

-- As fotos que já existem viram a primeira mídia de cada relato. A foto
-- simulada da demo não tem original de verdade e fica sem data de apagar.
INSERT INTO midias (ocorrencia_id, relato_id, tipo, mime, chave_original, chave_publica, apagar_em, criado_em)
SELECT r.ocorrencia_id, r.id, 'foto', 'image/jpeg',
       NULLIF(r.midia_original, r.midia_publica), r.midia_publica,
       CASE WHEN r.midia_original <> r.midia_publica THEN r.criado_em + interval '90 days' END,
       r.criado_em
  FROM relatos r;

-- As colunas antigas continuam como capa do chamado e do relato, mas deixam
-- de ser obrigatórias: a original some delas quando a retenção apaga.
ALTER TABLE relatos ALTER COLUMN midia_original DROP NOT NULL;
ALTER TABLE ocorrencias ALTER COLUMN midia_original DROP NOT NULL;
