-- Cidade do morador (v0.3.1). O cadastro passa a ter CEP e município, os dois
-- opcionais. "cidade" continua sendo a prefeitura que atende (o tenant);
-- "municipio" é onde a pessoa mora, que pode ser outro.
ALTER TABLE moradores
  ADD COLUMN cep            text,
  ADD COLUMN municipio      text,
  ADD COLUMN uf             text,
  ADD COLUMN municipio_ibge text;

-- O GPS também devolve a cidade e o estado.
ALTER TABLE geocache
  ADD COLUMN cidade text,
  ADD COLUMN uf     text;

-- Cache do CEP (ViaCEP): o mesmo CEP não é consultado duas vezes.
CREATE TABLE cepcache (
  cep        text PRIMARY KEY,
  cidade     text NOT NULL,
  uf         text NOT NULL,
  bairro     text,
  ibge       text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
