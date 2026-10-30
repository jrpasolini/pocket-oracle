#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="dist"

rm -rf "$OUT"
mkdir -p "$OUT"

for item in index.html manifest.json sw.js js css fonts icons images; do
  if [ ! -e "$item" ]; then
    echo "ERRO: item obrigatório ausente: $item" >&2
    exit 1
  fi
  cp -R "$item" "$OUT/"
done

for required in "$OUT/index.html" "$OUT/sw.js" "$OUT/js/app.js" \
                "$OUT/manifest.json" "$OUT/css/styles.css"; do
  if [ ! -f "$required" ]; then
    echo "ERRO: build incompleto, faltou $required" >&2
    exit 1
  fi
done

echo "Build concluído: Pocket Oracle pronto para serviço independente."
