#!/bin/sh
# Builds the native Neovim parser from workline's generated C source.
# Rerun after changing grammar.js, and rebuild the wasm with `npm run build:grammar`.
set -eu
cd "$(dirname "$0")/.."
mkdir -p nvim/parser
case $(uname -s) in
  Darwin) flags="-bundle -undefined dynamic_lookup" ;;
  *) flags="-shared" ;;
esac
${CC:-cc} -O2 -fPIC $flags -I src src/parser.c -o nvim/parser/workline.so
echo "built nvim/parser/workline.so"
