-- Onda 2 (ADR 0016): equipe de campo, gestão de usuários, "Também vi" e
-- acompanhamento do protocolo pelo morador.

-- Papel de campo: o servidor que vai à rua, ligado a uma secretaria.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_papel_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_check
  CHECK (papel IN ('operador', 'gestor', 'campo'));
ALTER TABLE usuarios
  ADD COLUMN nome        text,
  ADD COLUMN secretaria  text,
  -- Usuário desligado não entra nem usa token antigo; o histórico continua.
  ADD COLUMN ativo       boolean NOT NULL DEFAULT true,
  ADD COLUMN criado_por  text;

-- "Também vi": o morador confirma um chamado perto dele sem mandar foto.
ALTER TABLE relatos
  ADD COLUMN tipo text NOT NULL DEFAULT 'relato' CHECK (tipo IN ('relato', 'tambem_vi'));
ALTER TABLE relatos ALTER COLUMN midia_publica DROP NOT NULL;
-- Um aparelho confirma cada chamado uma vez só.
CREATE UNIQUE INDEX relatos_tambem_vi_idx ON relatos (ocorrencia_id, aparelho)
  WHERE tipo = 'tambem_vi' AND aparelho IS NOT NULL;
-- O acompanhamento acha o relato pela chave entregue ao morador.
CREATE INDEX relatos_chave_idx ON relatos (chave) WHERE chave IS NOT NULL;
