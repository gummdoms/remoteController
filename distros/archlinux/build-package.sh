#!/usr/bin/env bash
# Construye el paquete pacman (.pkg.tar.zst) para Arch Linux y derivadas.
# Uso: desde la raíz del proyecto -> npm run dist:arch:pkg
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DISTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PKGROOT="$DIST_DIR/arch-pkg"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"

if ! command -v makepkg >/dev/null 2>&1; then
  echo "Error: makepkg no está disponible. Instala el paquete base-devel." >&2
  exit 1
fi

if [[ $EUID -eq 0 ]]; then
  echo "Error: makepkg no se puede ejecutar como root." >&2
  echo "Ejecuta este script con tu usuario normal (sin sudo)." >&2
  exit 1
fi

echo ">> Versión: $VERSION"

# 1) Localizar (o generar) el AppImage que se va a empaquetar.
mkdir -p "$DIST_DIR"
APPIMAGE="$(ls -1t "$DIST_DIR"/*.AppImage 2>/dev/null | head -1 || true)"
if [[ -z "${APPIMAGE:-}" ]]; then
  echo ">> AppImage no encontrado. Compilando..."
  ( cd "$ROOT_DIR" && npm run dist:linux )
  APPIMAGE="$(ls -1t "$DIST_DIR"/*.AppImage 2>/dev/null | head -1 || true)"
fi

if [[ -z "${APPIMAGE:-}" || ! -f "$APPIMAGE" ]]; then
  echo "Error: no se generó ningún AppImage en $DIST_DIR" >&2
  exit 1
fi

echo ">> AppImage: $(basename "$APPIMAGE")"

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT"

cp -f "$APPIMAGE" "$PKGROOT/remotecontrollers.AppImage"
cp -f "$ROOT_DIR/assets/icon.png" "$PKGROOT/remotecontrollers.png"
cp -f "$DISTRO_DIR/remotecontrollers.desktop" "$PKGROOT/remotecontrollers.desktop"
cp -f "$DISTRO_DIR/remotecontrollers.sh" "$PKGROOT/remotecontrollers.sh"
cp -f "$DISTRO_DIR/remotecontrollers.install" "$PKGROOT/remotecontrollers.install"
cp -f "$DISTRO_DIR/PKGBUILD" "$PKGROOT/PKGBUILD"
chmod +x "$PKGROOT/remotecontrollers.sh"

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
  "$PKGROOT/remotecontrollers.sh" \
  "$PKGROOT/remotecontrollers.install"

# Sincronizar pkgver con package.json
sed -i "s/^pkgver=.*/pkgver=${VERSION}/" "$PKGROOT/PKGBUILD"

#    --nodeps: es un paquete "-bin" (no compila nada). Sin --nodeps makepkg
#    aborta si el equipo de build no tiene instalada alguna dependencia de
#    runtime, aunque el paquete se genere perfectamente.
(
  cd "$PKGROOT"
  makepkg -f --noconfirm --nodeps --nocheck
  PKG_FILE="$(ls remotecontrollers-bin-*-x86_64.pkg.tar.zst 2>/dev/null | head -1 || true)"
  if [[ -z "$PKG_FILE" ]]; then
    echo "Error: no se generó el paquete .pkg.tar.zst" >&2
    exit 1
  fi
  cp -f "$PKG_FILE" "$DIST_DIR/"
  echo
  echo "Paquete generado:"
  echo "  $DIST_DIR/$PKG_FILE"
)
echo
echo "Instalar localmente: sudo pacman -U dist/remotecontrollers-bin-${VERSION}-*-x86_64.pkg.tar.zst"
echo "Publicar en el repo: npm run dist:arch:publish && npm run dist:arch:upload"
