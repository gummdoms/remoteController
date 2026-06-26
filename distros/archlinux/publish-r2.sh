#!/usr/bin/env bash
# Publica el .pkg.tar.zst al repo pacman local y muestra qué subir a R2.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
REPO_DIR="$DIST_DIR/r2-repo"
R2_UPLOAD="$DIST_DIR/r2-upload"
RELEASES_BASE="${RELEASES_BASE:-https://realses.bjrsoftware.uk/arch/os/x86_64}"
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

# R2 no soporta symlinks: pacman pide bjrsoftware.db (no solo .db.tar.zst).
mkdir -p "$R2_UPLOAD"
cp -f "$REPO_DIR/$PKG" "$R2_UPLOAD/"
cp -f "$REPO_DIR/$REPO_DB" "$R2_UPLOAD/"
cp -f "$REPO_DIR/$REPO_FILES" "$R2_UPLOAD/"
cp -f "$REPO_DIR/$REPO_DB" "$R2_UPLOAD/bjrsoftware.db"
cp -f "$REPO_DIR/$REPO_FILES" "$R2_UPLOAD/bjrsoftware.files"

PKG_SIZE="$(stat -c%s "$R2_UPLOAD/$PKG")"
PKG_SHA256="$(sha256sum "$R2_UPLOAD/$PKG" | awk '{print $1}')"

echo
echo "Archivos listos para R2 en: $R2_UPLOAD"
echo "Sube TODOS estos archivos juntos a R2 en: arch/os/x86_64/"
echo "  (reemplaza los existentes; si subes solo .db sin el .pkg, pacman falla con checksum)"
echo
echo "  - $PKG"
echo "      size: $PKG_SIZE bytes"
echo "      sha256: $PKG_SHA256"
echo "  - $REPO_DB"
echo "  - $REPO_FILES"
echo "  - bjrsoftware.db"
echo "  - bjrsoftware.files"
echo
echo "Verificar tras subir:"
echo "  curl -sI $RELEASES_BASE/$PKG | grep -i content-length"
echo "  # Debe mostrar: content-length: $PKG_SIZE"
echo
echo "URL pública del repo:"
echo "  $RELEASES_BASE/"
echo
echo "1) Añade el repo (una vez por máquina):"
echo "  sudo tee -a /etc/pacman.conf <<'EOF'"
echo
echo "[bjrsoftware]"
echo "SigLevel = Optional TrustAll"
echo "Server = https://realses.bjrsoftware.uk/arch/os/\$arch"
echo "EOF"
echo
echo "2) Instala:"
echo "  sudo pacman -Sy"
echo "  sudo pacman -S remotecontrollers-bin"
