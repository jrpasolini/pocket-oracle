#!/usr/bin/env bash
# Build do Render para jrpasolini.tech.
#
# Estrutura publicada:
#   /                     -> página pessoal (repo jrpasolini/paginapessoal)
#   /pocket-oracle/       -> Pocket Oracle (este repositório)
#
# A página pessoal foi construída para o subcaminho /paginapessoal/ (basepath
# compilado dentro do bundle). Servir na raiz exige reescrever esse prefixo.
# A reescrita é uma substituição literal de string: /paginapessoal/ -> /
#
# Uso:
#   scripts/render-build.sh                 # clona a página pessoal do GitHub
#   PAGINA_PESSOAL_DIR=/caminho ./scripts/render-build.sh   # usa cópia local

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

OUT="dist"
APP_SUBPATH="pocket-oracle"
PAGINA_REPO="https://github.com/jrpasolini/paginapessoal.git"
# PAGINA_REF fixa o commit da página pessoal usado no build.
# `main` acompanha o repositório; um SHA congela uma versão conhecida.
# 26/10/2026: o grafo semântico foi revertido (não se sustentava na estrutura
# atual) e a `main` voltou a ser idêntica ao último commit publicado. O pin
# em 32b4622 deixou de ser necessário.
PAGINA_REF="${PAGINA_REF:-main}"
PAGINA_BASEPATH="/paginapessoal/"

# 0. Segurança: nunca escrever sobre os arquivos do app.
if [ -e "$OUT" ] && [ ! -f "$OUT/.pocket-oracle-build" ]; then
  echo "ERRO: '$OUT' existe e não foi criado por este script. Abortando." >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/$APP_SUBPATH"
: > "$OUT/.pocket-oracle-build"

# 1. Página pessoal na raiz.
if [ -n "${PAGINA_PESSOAL_DIR:-}" ]; then
  PAGINA_SRC="$PAGINA_PESSOAL_DIR"
  echo "Página pessoal: usando cópia local em $PAGINA_SRC"
else
  PAGINA_SRC="$(mktemp -d)"
  echo "Página pessoal: clonando $PAGINA_REPO em $PAGINA_REF"
  git clone --quiet "$PAGINA_REPO" "$PAGINA_SRC"
  git -C "$PAGINA_SRC" checkout --quiet "$PAGINA_REF"
fi

if [ ! -f "$PAGINA_SRC/index.html" ]; then
  echo "ERRO: página pessoal sem index.html em $PAGINA_SRC" >&2
  exit 1
fi

# 1a. Copia sem o .git e sem documentação (não é servida).
tar -C "$PAGINA_SRC" --exclude=.git --exclude=README.md -cf - . | tar -C "$OUT" -xf -

# 1b. Reescreve o basepath compilado.
#     O bundle traz o prefixo em três formas: `/paginapessoal/` (URLs),
#     `/paginapessoal` e `paginapessoal` (opções `basepath` do router).
find "$OUT" -maxdepth 2 -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.webmanifest' -o -name '*.json' \) \
  -print0 | while IFS= read -r -d '' f; do
    if grep -qF "paginapessoal" "$f"; then
      python3 - "$f" <<'PY'
import sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    data = fh.read()
# Ordem importa: da forma mais específica para a mais genérica.
data = data.replace('/paginapessoal/', '/')
data = data.replace('`/paginapessoal`', '`/`')
data = data.replace('`paginapessoal`', '`/`')
data = data.replace('/paginapessoal', '/')
data = data.replace('paginapessoal', '')
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(data)
PY
    fi
  done

# 1c. Nenhum resquício do nome antigo pode sobrar.
if grep -rqF "paginapessoal" "$OUT" 2>/dev/null; then
  echo "ERRO: sobrou referência a 'paginapessoal' após a reescrita:" >&2
  grep -rlF "paginapessoal" "$OUT" >&2
  exit 1
fi

# 2. Pocket Oracle em /pocket-oracle/.
for item in index.html manifest.json sw.js js css fonts icons images; do
  if [ ! -e "$REPO_ROOT/$item" ]; then
    echo "ERRO: item obrigatório ausente: $item" >&2
    exit 1
  fi
  cp -R "$REPO_ROOT/$item" "$OUT/$APP_SUBPATH/"
done

# 3. Verificação mínima do resultado.
for required in "$OUT/index.html" "$OUT/sw.js" "$OUT/manifest.webmanifest" \
                "$OUT/$APP_SUBPATH/index.html" "$OUT/$APP_SUBPATH/sw.js" \
                "$OUT/$APP_SUBPATH/js/app.js" "$OUT/$APP_SUBPATH/manifest.json"; do
  if [ ! -f "$required" ]; then
    echo "ERRO: build incompleto, faltou $required" >&2
    exit 1
  fi
done

echo "Build concluído: página pessoal na raiz, Pocket Oracle em /$APP_SUBPATH/."
