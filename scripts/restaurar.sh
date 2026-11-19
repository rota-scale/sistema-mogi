#!/usr/bin/env bash
# Restaura um backup feito por make backup: banco, fotos e regras.
# Uso: make restaurar PASTA=backups/AAAA-MM-DD_HHMM
# Apaga o que está no banco e nos volumes agora e põe o backup no lugar.
set -euo pipefail

cd "$(dirname "$0")/.."
PASTA="${1:?informe a pasta: make restaurar PASTA=backups/...}"
[ -f "$PASTA/banco.dump" ] || { echo "não achei $PASTA/banco.dump"; exit 1; }
set -a; . ./.env; set +a
PROJETO=mogi
ORIGEM="$(cd "$PASTA" && pwd)"
IMAGEM_UTIL=mogi-postgres:16

( cd "$ORIGEM" && sha256sum -c --quiet SHA256SUMS ) || { echo "backup corrompido: a conferência SHA256 falhou"; exit 1; }
echo "Parando a API..."
docker compose stop api >/dev/null 2>&1 || true

echo "Banco..."
docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-mogi}" -d "${POSTGRES_DB:-mogi}" \
  --clean --if-exists --no-owner < "$ORIGEM/banco.dump"

restaurar_volume() {
  docker run --rm -v "${PROJETO}_$1:/dados" -v "$ORIGEM:/entrada:ro" "$IMAGEM_UTIL" \
    sh -c "find /dados -mindepth 1 -delete && tar xzf /entrada/$1.tgz -C /dados"
}
echo "Fotos..."
docker compose stop seaweedfs >/dev/null
restaurar_volume seaweed
docker compose start seaweedfs >/dev/null
echo "Regras..."
restaurar_volume regras

echo "Subindo a API..."
docker compose up -d --no-build --wait api
echo "Restaurado de $PASTA ($(grep -h versao "$ORIGEM/LEIA.txt" || true))."
