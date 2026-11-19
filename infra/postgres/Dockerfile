# Postgres 16 com PostGIS 3 e H3 (h3-pg), instalados do repositório pgdg
# que a imagem oficial já configura. Usamos a imagem oficial porque
# postgis/postgis não publica arm64 (Mac com Apple Silicon).
FROM postgres:16-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-16-postgis-3 \
      postgresql-16-h3 \
 && rm -rf /var/lib/apt/lists/*

COPY init.sql /docker-entrypoint-initdb.d/00-extensoes.sql
