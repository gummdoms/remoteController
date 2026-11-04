#!/usr/bin/env bash
# Build completo del .deb + subida al lago de datos.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
RELEASES_URL="${RELEASES_BASE:-https://datalake.dambra-os.com/public/remote-controller/releases/debian}"

cd "$ROOT_DIR"

echo "==> 1/2 Compilar paquete Debian (.deb)"
npm run dist:deb

DEB_FILE="$(ls -1t "$DIST_DIR"/remotecontrollers_*_amd64.deb | head -1)"
DEB_NAME="$(basename "$DEB_FILE")"

echo
echo "==> 2/2 Subir al lago de datos"
node scripts/upload-to-datalake.js --path releases/debian "$DEB_FILE"

echo
echo "==> Verificación"
echo "Local:  $(stat -c%s "$DEB_FILE") bytes"
echo "Remoto: curl -sI \"$RELEASES_URL/$DEB_NAME\" | grep -i content-length"
echo
echo "En clientes Debian/Ubuntu:"
echo "  sudo apt install \"./$DEB_NAME\""
