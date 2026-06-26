#!/usr/bin/env bash
# Construye el paquete pacman (.pkg.tar.zst) para Arch Linux.
# Uso: desde la raíz de DesktopApp → npm run dist:arch:pkg
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DISTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PKGROOT="$DIST_DIR/arch-pkg"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
APPIMAGE="$DIST_DIR/Remote Controllers-${VERSION}.AppImage"

echo ">> Versión: $VERSION"

if [[ ! -f "$APPIMAGE" ]]; then
  echo ">> AppImage no encontrado. Compilando..."
  cd "$ROOT_DIR"
  npm run dist:linux
fi

if [[ ! -f "$APPIMAGE" ]]; then
  echo "Error: no se generó $APPIMAGE"
  exit 1
fi

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT"

cp -f "$APPIMAGE" "$PKGROOT/remotecontrollers.AppImage"
cp -f "$ROOT_DIR/assets/icon.png" "$PKGROOT/remotecontrollers.png"
cp -f "$DISTRO_DIR/remotecontrollers.desktop" "$PKGROOT/remotecontrollers.desktop"
cp -f "$DISTRO_DIR/remotecontrollers.sh" "$PKGROOT/remotecontrollers.sh"
chmod +x "$PKGROOT/remotecontrollers.sh"
cp -f "$DISTRO_DIR/PKGBUILD" "$PKGROOT/PKGBUILD"

# makepkg rechaza CRLF (común si el repo se editó en Windows)
strip_crlf() {
  local file
  for file in "$@"; do
    if [[ -f "$file" ]]; then
      sed -i 's/\r$//' "$file"
    fi
  done
}
strip_crlf \
  "$PKGROOT/PKGBUILD" \
  "$PKGROOT/remotecontrollers.desktop" \
  "$PKGROOT/remotecontrollers.sh"

# Sincronizar pkgver con package.json
sed -i "s/^pkgver=.*/pkgver=${VERSION}/" "$PKGROOT/PKGBUILD"

(
  cd "$PKGROOT"
  makepkg -f --noconfirm
  cp -f remotecontrollers-bin-"${VERSION}"-1-x86_64.pkg.tar.zst "$DIST_DIR/"
)

echo
echo "Paquete generado:"
echo "  $DIST_DIR/remotecontrollers-bin-${VERSION}-1-x86_64.pkg.tar.zst"
echo
echo "Sube dist/r2-repo/* a R2: arch/os/x86_64/ (https://realses.bjrsoftware.uk/arch/os/x86_64/)"
echo "O ejecuta: npm run dist:arch:publish"
