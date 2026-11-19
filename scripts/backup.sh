#!/usr/bin/env bash
# Backup do MOGI: banco (pg_dump), fotos (volume do SeaweedFS) e regras salvas
# no Admin, numa pasta backups/AAAA-MM-DD_HHMM/ com a versão junto.
# Uso: make backup, com o sistema no ar (make subir ou make tunel).
# PARAR_MIDIA=1 para o SeaweedFS uns segundos durante a cópia: o tar com ele
# gravando pode pegar um arquivo pela metade (veja docs/sops/08-backup-e-voltar.md).
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "falta .env: rode make subir antes"; exit 1; }
set -a; . ./.env; set +a
PROJETO=mogi
PASTA="${1:-backups/$(date +%Y-%m-%d_%H%M)}"
mkdir -p "$PASTA"
DESTINO="$(cd "$PASTA" && pwd)"
IMAGEM_UTIL=mogi-postgres:16

echo "Banco..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-mogi}" -d "${POSTGRES_DB:-mogi}" -Fc > "$DESTINO/banco.dump"

copiar_volume() {
  docker run --rm -v "${PROJETO}_$1:/dados:ro" -v "$DESTINO:/saida" "$IMAGEM_UTIL" \
    tar czf "/saida/$1.tgz" -C /dados .
}
echo "Fotos..."
if [ "${PARAR_MIDIA:-0}" = 1 ]; then docker compose stop seaweedfs >/dev/null; fi
copiar_volume seaweed
if [ "${PARAR_MIDIA:-0}" = 1 ]; then docker compose start seaweedfs >/dev/null; fi
echo "Regras..."
copiar_volume regras

VERSAO=$(curl -fsS "http://localhost:${API_PORTA:-8080}/saude" 2>/dev/null | sed -n 's/.*"versao":"\([^"]*\)".*/\1/p' || true)
{
  echo "quando=$(date -Iseconds)"
  echo "versao=${VERSAO:-desconhecida}"
  echo "git=$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
} > "$DESTINO/LEIA.txt"
( cd "$DESTINO" && sha256sum banco.dump seaweed.tgz regras.tgz > SHA256SUMS )
echo "Backup em $PASTA ($(du -sh "$DESTINO" | cut -f1)). Guarde uma cópia fora desta máquina."
