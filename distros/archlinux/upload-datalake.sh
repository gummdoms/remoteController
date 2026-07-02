#!/usr/bin/env bash
# Sube dist/datalake-upload/ al lago de datos (public/remote-controller/releases/arch/x86_64).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPLOAD_DIR="$ROOT_DIR/dist/datalake-upload"
RELATIVE_PATH="releases/arch/x86_64"
RELEASES_BASE="${RELEASES_BASE:-https://datalake.dambra-os.com/public/remote-controller/releases/arch/x86_64}"

if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "No existe $UPLOAD_DIR"
  echo "Ejecuta primero: npm run dist:arch:publish"
  exit 1
fi

echo "==> Subiendo a public/remote-controller/${RELATIVE_PATH}/"
node "$ROOT_DIR/scripts/upload-to-datalake.js" --path "$RELATIVE_PATH" --dir "$UPLOAD_DIR"

echo
echo "Subida completada."
PKG="$(ls -1 "$UPLOAD_DIR"/remotecontrollers-bin-*-x86_64.pkg.tar.zst 2>/dev/null | head -1 || true)"
if [[ -n "$PKG" ]]; then
  PKG_NAME="$(basename "$PKG")"
  LOCAL_SIZE="$(stat -c%s "$PKG")"
  echo "Verifica descarga pública:"
  echo "  curl -sI \"$RELEASES_BASE/$PKG_NAME\" | grep -i content-length"
  echo "  Debe ser: content-length: $LOCAL_SIZE"
fi
