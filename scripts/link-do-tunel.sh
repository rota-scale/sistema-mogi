#!/usr/bin/env bash
# Mostra o link https do túnel aberto por make tunel. O Cloudflare Quick
# Tunnel sorteia um endereço a cada subida e o escreve no log do contêiner.
set -euo pipefail
cd "$(dirname "$0")/.."

link=""
for _ in $(seq 1 15); do
  link=$(docker compose --profile tunel logs tunel 2>/dev/null \
    | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true)
  [ -n "$link" ] && break
  sleep 2
done

if [ -z "$link" ]; then
  echo "o túnel ainda não respondeu; rode make link de novo em alguns segundos"
  exit 1
fi

echo ""
echo "Abra no celular (morador): $link/relatar"
echo "Painel pelo mesmo link:    $link"
echo ""
echo "Enquanto o túnel estiver no ar, quem tiver o link alcança o servidor."
echo "Para fechar: make parar"
