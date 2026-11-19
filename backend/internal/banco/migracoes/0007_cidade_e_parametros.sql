-- Cidade como dado (ADR 0021) e parâmetros editáveis em tempo de execução
-- (ADR 0018). Itamogi é a primeira linha; nova regional é mais uma linha e
-- uma pasta de regras, sem mexer no código.
CREATE TABLE cidades (
  slug        text PRIMARY KEY CHECK (slug ~ '^[a-z0-9_-]{2,40}$'),
  nome        text NOT NULL,
  centro_lat  double precision NOT NULL,
  centro_lng  double precision NOT NULL,
  -- Cerca do município: minLng,minLat,maxLng,maxLat. Nula aceita de qualquer lugar.
  caixa       text,
  criada_em   timestamptz NOT NULL DEFAULT now()
);

-- Centro de Itamogi-MG (Nominatim, relação OSM 315047).
INSERT INTO cidades (slug, nome, centro_lat, centro_lng) VALUES ('itamogi', 'Itamogi-MG', -21.0793, -47.0486);

-- Cada chamado e cada usuário sabem de que cidade são. Hoje roda uma cidade
-- por instalação; a coluna deixa o dado pronto para várias na mesma base.
ALTER TABLE ocorrencias ADD COLUMN cidade text NOT NULL DEFAULT 'itamogi' REFERENCES cidades (slug);
ALTER TABLE usuarios ADD COLUMN cidade text NOT NULL DEFAULT 'itamogi' REFERENCES cidades (slug);
CREATE INDEX ocorrencias_cidade_idx ON ocorrencias (cidade, criado_em DESC);

-- Um documento de parâmetros por cidade. O que não estiver nele vale o
-- padrão do código, então a tabela pode ficar vazia.
CREATE TABLE parametros (
  cidade          text PRIMARY KEY REFERENCES cidades (slug),
  valor           jsonb NOT NULL,
  atualizado_por  text,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

-- Guarda cada versão anterior: quem mudou o quê e quando.
CREATE TABLE parametros_historico (
  id          bigserial PRIMARY KEY,
  cidade      text NOT NULL REFERENCES cidades (slug),
  valor       jsonb NOT NULL,
  autor       text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
