-- Papel de prefeito: acompanha a cidade pelo gabinete, só leitura. Não
-- confere, não despacha e não mexe em regra nem em usuário.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_papel_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_check
  CHECK (papel IN ('operador', 'gestor', 'campo', 'prefeito'));
