#!/usr/bin/env bash
set -euo pipefail

# Compatibilidade com a configuração Render anterior. O Pocket Oracle agora é
# publicado por um serviço próprio; a página pessoal pertence ao serviço
# `webpage` e nunca mais é clonada ou incorporada por este repositório.
exec bash "$(dirname "$0")/render-pocket-only.sh"
