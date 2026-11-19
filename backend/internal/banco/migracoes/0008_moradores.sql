-- Cadastro do morador com CPF ou CNPJ (ADR 0024, substitui o 0020). Decisão
-- do Russo em 16/11/2026: para relatar, o morador se cadastra.
--
-- O documento nunca fica em texto puro: documento_cifrado é AES-256-GCM com
-- a chave DOCUMENTO_CHAVE do servidor; documento_hash é um HMAC-SHA256 que
-- acha o cadastro e impede duplicata sem decifrar; documento_final guarda só
-- a versão mascarada (***.456.789-**), que é o que as telas mostram.
CREATE TABLE moradores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade             text NOT NULL DEFAULT 'itamogi' REFERENCES cidades (slug),
  -- pf: pessoa física; pj: pessoa jurídica; servidor: servidor público.
  tipo               text NOT NULL CHECK (tipo IN ('pf', 'pj', 'servidor')),
  nome               text NOT NULL CHECK (length(nome) BETWEEN 2 AND 120),
  profissao          text,
  bairro             text,
  documento_cifrado  bytea NOT NULL,
  documento_hash     text NOT NULL UNIQUE,
  documento_final    text,
  -- Momento em que o morador aceitou o termo de uso e privacidade.
  aceite_em          timestamptz NOT NULL,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now()
);

-- Cada relato sabe quem enviou. Apagar o cadastro (DELETE /eu, direito de
-- exclusão da LGPD) desliga os relatos dele, que continuam no chamado.
ALTER TABLE relatos ADD COLUMN morador_id uuid REFERENCES moradores (id) ON DELETE SET NULL;
CREATE INDEX relatos_morador_idx ON relatos (morador_id, criado_em DESC) WHERE morador_id IS NOT NULL;
