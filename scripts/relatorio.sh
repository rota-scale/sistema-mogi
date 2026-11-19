#!/usr/bin/env bash
# Baixa o relatório anonimizado dos chamados reais dos últimos N dias (ADR
# 0019). Uso: make relatorio [DIAS=3], com make subir ou make dev rodando.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "falta .env: rode make subir antes"; exit 1; }
set -a; . ./.env; set +a

API="${API:-http://localhost:${API_PORTA:-8080}}"
DIAS="${1:-1}"
mkdir -p relatorios
ARQUIVO="relatorios/mogi-$(date +%Y-%m-%d-%H%M)-${DIAS}d.csv"

TOKEN=$(curl -fsS "$API/auth/login" -d "{\"login\":\"${SEED_LOGIN:-gestor}\",\"senha\":\"$SEED_SENHA\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])") || { echo "login do gestor recusado"; exit 1; }
curl -fsS "$API/relatorio.csv?dias=$DIAS" -H "Authorization: Bearer $TOKEN" -o "$ARQUIVO"
echo "$(($(wc -l < "$ARQUIVO") - 1)) chamado(s) em $ARQUIVO"
