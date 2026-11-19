-- Prova de posse do cadastro (issue #26). Documento repetido não emite mais
-- token: para entrar em outro aparelho, o morador informa o documento e o
-- código de recuperação que recebeu no cadastro. Só o HMAC do código fica no
-- banco. "sessao" sobe a cada entrada e derruba os tokens antigos.
ALTER TABLE moradores
  ADD COLUMN codigo_hash     text,
  ADD COLUMN sessao          integer NOT NULL DEFAULT 1,
  ADD COLUMN falhas_entrada  integer NOT NULL DEFAULT 0,
  ADD COLUMN bloqueado_ate   timestamptz;
