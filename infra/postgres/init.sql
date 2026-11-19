-- Extensões criadas na primeira subida do volume. O backend também tenta
-- criá-las nas migrações, então um banco já existente continua funcionando.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS h3;
