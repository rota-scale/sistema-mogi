-- Sprint de produção (11/11/2026): agrupamento de relatos (RF08), log de
-- custo e latência (RF11), despacho e resolução, secretarias editáveis (T7)
-- e marca de dado simulado.

ALTER TABLE ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_status_check;
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_status_check
  CHECK (status IN ('a_classificar', 'revisao', 'aberta', 'em_atendimento', 'resolvida'));

ALTER TABLE ocorrencias
  ADD COLUMN relatos         integer NOT NULL DEFAULT 1,
  ADD COLUMN secretaria      text,
  -- Nível decidido pela triagem automática, guardado para medir o acerto
  -- contra a revisão humana (T8).
  ADD COLUMN nivel_ia        smallint CHECK (nivel_ia BETWEEN 1 AND 5),
  ADD COLUMN despachado_por  text,
  ADD COLUMN despachado_em   timestamptz,
  ADD COLUMN resolvido_por   text,
  ADD COLUMN resolvido_em    timestamptz,
  ADD COLUMN custo_brl       numeric(12, 6) NOT NULL DEFAULT 0,
  ADD COLUMN latencia_ms     integer,
  -- Dado simulado (semente da demo ou teste): nunca conta como evidência de campo.
  ADD COLUMN demo            boolean NOT NULL DEFAULT false;

UPDATE ocorrencias
   SET nivel_ia = (triagem->'regra'->>'nivel')::smallint,
       secretaria = triagem->'classificacao'->>'secretaria',
       latencia_ms = (triagem->>'latencia_ms')::integer
 WHERE triagem IS NOT NULL;

-- Cada envio do cidadão é um relato; relatos do mesmo problema a menos de
-- 50 m ficam no mesmo chamado (C4).
CREATE TABLE relatos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id   uuid NOT NULL REFERENCES ocorrencias (id) ON DELETE CASCADE,
  texto           text,
  local           geography(Point, 4326) NOT NULL,
  precisao_m      real,
  midia_original  text NOT NULL,
  midia_publica   text NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relatos_ocorrencia_idx ON relatos (ocorrencia_id, criado_em);

INSERT INTO relatos (ocorrencia_id, texto, local, precisao_m, midia_original, midia_publica, criado_em)
SELECT id, texto, local, precisao_m, midia_original, midia_publica, criado_em FROM ocorrencias;

-- Uma linha por etapa da triagem de cada relato (RF11).
CREATE TABLE triagem_etapas (
  id              bigserial PRIMARY KEY,
  ocorrencia_id   uuid NOT NULL REFERENCES ocorrencias (id) ON DELETE CASCADE,
  etapa           text NOT NULL,
  provedor        text,
  ms              integer NOT NULL,
  custo_brl       numeric(12, 6) NOT NULL DEFAULT 0,
  tokens_entrada  integer NOT NULL DEFAULT 0,
  tokens_saida    integer NOT NULL DEFAULT 0,
  ok              boolean NOT NULL DEFAULT true,
  erro            text,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX triagem_etapas_ocorrencia_idx ON triagem_etapas (ocorrencia_id);
CREATE INDEX triagem_etapas_etapa_idx ON triagem_etapas (etapa, criado_em);

-- Categorias e a secretaria responsável, editáveis pelo gestor (T7).
-- Os nomes das secretarias são proposta a validar com a prefeitura.
CREATE TABLE categorias (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{1,40}$'),
  nome        text NOT NULL,
  secretaria  text NOT NULL,
  ordem       integer NOT NULL DEFAULT 0
);

INSERT INTO categorias (id, nome, secretaria, ordem) VALUES
  ('agua',        'Água e esgoto',        'Água e esgoto',        1),
  ('iluminacao',  'Iluminação e energia', 'Iluminação e energia', 2),
  ('vias',        'Vias e buracos',       'Obras e vias',         3),
  ('limpeza',     'Limpeza urbana',       'Limpeza urbana',       4),
  ('arvores',     'Árvores',              'Meio ambiente',        5),
  ('sinalizacao', 'Sinalização',          'Trânsito',             6),
  ('calcadas',    'Calçadas e praças',    'Obras e vias',         7),
  ('animais',     'Animais',              'Saúde e zoonoses',     8),
  ('outros',      'Outros',               'A definir',            9);

CREATE INDEX ocorrencias_grupo_idx ON ocorrencias (categoria, status) WHERE status <> 'resolvida';

-- Toda alteração de regra Lua pelo painel fica registrada: quem, quando e
-- o conteúdo salvo (T7, auditoria).
CREATE TABLE regras_historico (
  id         bigserial PRIMARY KEY,
  cidade     text NOT NULL,
  arquivo    text NOT NULL,
  conteudo   text NOT NULL,
  autor      text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
