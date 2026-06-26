#!/usr/bin/env bash
# Build completo + índice pacman + subida a R2 (si rclone está configurado).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RCLONE_REMOTE="${RCLONE_REMOTE:-cloudflaredr2}"
R2_DEST="${RCLONE_REMOTE}:remote-controller/arch/os/x86_64"
UPLOAD_DIR="$ROOT_DIR/dist/r2-upload"
RELEASES_URL="${RELEASES_BASE:-https://realses.bjrsoftware.uk/arch/os/x86_64}"

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
echo "==> 3/3 Subir a R2"
if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone no instalado. Sube manualmente:"
  echo "  $UPLOAD_DIR/"
  echo "  → R2 bucket remote-controller/arch/os/x86_64/"
  exit 0
fi

if ! rclone listremotes | grep -q "^${RCLONE_REMOTE}:$"; then
  echo "Remote rclone '$RCLONE_REMOTE' no encontrado."
  echo "Configura con: rclone config"
  echo "Luego: RCLONE_REMOTE=tu_remote $0"
  exit 1
fi

# Evita que rclone omita el .pkg si cree que ya existe con otro hash
rclone delete "$R2_DEST/$PKG_NAME" 2>/dev/null || true
rclone copy "$UPLOAD_DIR/" "$R2_DEST/" -v

echo
echo "==> Verificación"
echo "Local:  $LOCAL_SIZE bytes"
echo "Remoto: curl -sI $RELEASES_URL/$PKG_NAME | grep -i content-length"
echo
echo "Si content-length no coincide, purga caché Cloudflare en realses.bjrsoftware.uk/arch/*"
echo "Luego en clientes:"
echo "  sudo pacman -Sy && sudo pacman -S remotecontrollers-bin"
