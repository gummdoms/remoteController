#!/usr/bin/env bash
# Publica el .pkg.tar.zst al repo pacman local y prepara dist/datalake-upload/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
REPO_DIR="$DIST_DIR/datalake-repo"
UPLOAD_DIR="$DIST_DIR/datalake-upload"
DEFAULT_RELEASES_BASE="$(node -p "require('$ROOT_DIR/package.json').config.releasesUrl")"
RELEASES_BASE="${RELEASES_BASE:-$DEFAULT_RELEASES_BASE}"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
PKGREL="$(awk -F= '/^pkgrel=/{print $2; exit}' "$ROOT_DIR/distros/archlinux/PKGBUILD")"
PKG="remotecontrollers-bin-${VERSION}-${PKGREL}-x86_64.pkg.tar.zst"
PKG_PATH="$DIST_DIR/$PKG"
REPO_DB="bjrsoftware.db.tar.zst"
REPO_FILES="bjrsoftware.files.tar.zst"

if [[ ! -f "$PKG_PATH" ]]; then
  echo "No existe $PKG_PATH"
  echo "Ejecuta primero: npm run dist:arch:pkg"
  exit 1
fi

mkdir -p "$REPO_DIR"

# El repositorio pacman solo debe publicar la versión actual: al acumular
# varias versiones, repo-add conserva entradas antiguas y pacman puede bajar
# un paquete que ya no coincide con el índice.
find "$REPO_DIR" -maxdepth 1 -type f -name '*.pkg.tar.zst' ! -name "$PKG" -delete
cp -f "$PKG_PATH" "$REPO_DIR/"

(
  cd "$REPO_DIR"
  rm -f bjrsoftware.db bjrsoftware.files bjrsoftware.db.tar.zst bjrsoftware.files.tar.zst
  repo-add --remove --nocolor "$REPO_DB" "$PKG"
)

rm -rf "$UPLOAD_DIR"
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
