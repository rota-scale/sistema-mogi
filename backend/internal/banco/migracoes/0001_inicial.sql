-- Esquema inicial do Sistema MOGI.
-- Campos de ocorrência seguem o espírito do Open311 GeoReport v2 (ADR 0003);
-- prioridade, triagem e quadrante H3 são extensões próprias.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- H3 é opcional: se a extensão não existir, a coluna fica nula (ADR 0006).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS h3;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'extensão h3 indisponível; coluna h3_r9 ficará nula';
END $$;

CREATE TABLE usuarios (
  id          bigserial PRIMARY KEY,
  login       text NOT NULL UNIQUE,
  senha_hash  text NOT NULL,
  papel       text NOT NULL CHECK (papel IN ('operador', 'gestor')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE protocolo_seq;

CREATE TABLE ocorrencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo       text NOT NULL UNIQUE DEFAULT (
                    'MOGI-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY')
                    || '-' || lpad(nextval('protocolo_seq')::text, 6, '0')),
  categoria       text NOT NULL DEFAULT 'outros',
  texto           text,
  local           geography(Point, 4326) NOT NULL,
  precisao_m      real,
  h3_r9           text,
  endereco        text,
  bairro          text,
  midia_original  text NOT NULL,
  midia_publica   text NOT NULL,
  status          text NOT NULL DEFAULT 'a_classificar'
                    CHECK (status IN ('a_classificar', 'revisao', 'aberta', 'resolvida')),
  nivel           smallint CHECK (nivel BETWEEN 1 AND 5),
  triagem         jsonb,
  prazo_ate       timestamptz,
  prazo_fonte     text,
  revisado_por    text,
  revisado_em     timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ocorrencias_local_idx ON ocorrencias USING gist (local);
CREATE INDEX ocorrencias_fila_idx ON ocorrencias (status, nivel DESC, criado_em);

-- Cache da geocodificação reversa (RF02). Chave: lat,lng com 4 casas (cerca de 11 m).
CREATE TABLE geocache (
  chave      text PRIMARY KEY,
  endereco   text,
  bairro     text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Quadrante H3 calculado no banco quando a extensão existe.
-- Resolução 9 (cerca de 0,1 km²) é provisória, a calibrar para Itamogi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'h3') THEN
    EXECUTE $f$
      CREATE FUNCTION ocorrencias_h3() RETURNS trigger AS $t$
      BEGIN
        NEW.h3_r9 := h3_latlng_to_cell(
          point(ST_X(NEW.local::geometry), ST_Y(NEW.local::geometry)), 9)::text;
        RETURN NEW;
      END
      $t$ LANGUAGE plpgsql;
    $f$;
    EXECUTE 'CREATE TRIGGER ocorrencias_h3 BEFORE INSERT OR UPDATE OF local ON ocorrencias
             FOR EACH ROW EXECUTE FUNCTION ocorrencias_h3()';
  END IF;
END $$;

-- Tempo real (ADR 0009): toda mudança vira NOTIFY; o Go repassa pelo WebSocket.
CREATE FUNCTION ocorrencias_notifica() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER ocorrencias_atualizado BEFORE UPDATE ON ocorrencias
  FOR EACH ROW EXECUTE FUNCTION ocorrencias_notifica();

CREATE FUNCTION ocorrencias_evento() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ocorrencias', json_build_object(
    'tipo', CASE WHEN TG_OP = 'INSERT' THEN 'OcorrenciaCriada' ELSE 'OcorrenciaAtualizada' END,
    'id', NEW.id)::text);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER ocorrencias_evento AFTER INSERT OR UPDATE ON ocorrencias
  FOR EACH ROW EXECUTE FUNCTION ocorrencias_evento();
