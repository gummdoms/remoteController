#!/usr/bin/env bash
# Build completo + índice pacman + subida al lago de datos.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPLOAD_DIR="$ROOT_DIR/dist/datalake-upload"
RELEASES_URL="${RELEASES_BASE:-https://datalake.dambra-os.com/public/remote-controller/releases/arch/x86_64}"

cd "$ROOT_DIR"

echo "==> 1/3 Compilar paquete Arch (.pkg.tar.zst)"
npm run dist:arch:pkg

echo
echo "==> 2/3 Generar índice del repo (bjrsoftware.db)"
npm run dist:arch:publish

PKG="$(ls -1 "$UPLOAD_DIR"/remotecontrollers-bin-*-x86_64.pkg.tar.zst | head -1)"
PKG_NAME="$(basename "$PKG")"
LOCAL_SIZE="$(stat -c%s "$PKG")"

echo
echo "==> 3/3 Subir al lago de datos"
npm run dist:arch:upload

echo
echo "==> Verificación"
echo "Local:  $LOCAL_SIZE bytes"
echo "Remoto: curl -sI \"$RELEASES_URL/$PKG_NAME\" | grep -i content-length"
echo
echo "En clientes Arch:"
echo "  sudo pacman -Sy && sudo pacman -S remotecontrollers-bin"
