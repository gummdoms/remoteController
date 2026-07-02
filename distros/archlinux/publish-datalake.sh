#!/usr/bin/env bash
# Publica el .pkg.tar.zst al repo pacman local y prepara dist/datalake-upload/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
REPO_DIR="$DIST_DIR/datalake-repo"
UPLOAD_DIR="$DIST_DIR/datalake-upload"
RELEASES_BASE="${RELEASES_BASE:-https://datalake.dambra-os.com/public/remote-controller/releases/arch/x86_64}"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
PKG="remotecontrollers-bin-${VERSION}-1-x86_64.pkg.tar.zst"
PKG_PATH="$DIST_DIR/$PKG"
REPO_DB="bjrsoftware.db.tar.zst"
REPO_FILES="bjrsoftware.files.tar.zst"

if [[ ! -f "$PKG_PATH" ]]; then
  echo "No existe $PKG_PATH"
  echo "Ejecuta primero: npm run dist:arch:pkg"
  exit 1
fi

mkdir -p "$REPO_DIR"
cp -f "$PKG_PATH" "$REPO_DIR/"

(
  cd "$REPO_DIR"
  rm -f bjrsoftware.db
  repo-add "$REPO_DB" "$PKG"
)

mkdir -p "$UPLOAD_DIR"
cp -f "$REPO_DIR/$PKG" "$UPLOAD_DIR/"
cp -f "$REPO_DIR/$REPO_DB" "$UPLOAD_DIR/"
cp -f "$REPO_DIR/$REPO_FILES" "$UPLOAD_DIR/"
cp -f "$REPO_DIR/$REPO_DB" "$UPLOAD_DIR/bjrsoftware.db"
cp -f "$REPO_DIR/$REPO_FILES" "$UPLOAD_DIR/bjrsoftware.files"

PKG_SIZE="$(stat -c%s "$UPLOAD_DIR/$PKG")"
PKG_SHA256="$(sha256sum "$UPLOAD_DIR/$PKG" | awk '{print $1}')"

echo
echo "Archivos listos para el lago de datos en: $UPLOAD_DIR"
echo "Ruta remota: public/remote-controller/releases/arch/x86_64/"
echo
echo "  - $PKG"
echo "      size: $PKG_SIZE bytes"
echo "      sha256: $PKG_SHA256"
echo "  - $REPO_DB"
echo "  - $REPO_FILES"
echo "  - bjrsoftware.db"
echo "  - bjrsoftware.files"
echo
echo "Subir con:"
echo "  npm run dist:arch:upload"
echo
echo "URL pública base del repo pacman:"
echo "  $RELEASES_BASE/"
echo
echo "Bloque para /etc/pacman.conf:"
echo
cat "$ROOT_DIR/distros/archlinux/bjrsoftware.repo"
echo
