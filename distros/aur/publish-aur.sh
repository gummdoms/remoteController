#!/usr/bin/env bash
# Prepara (y opcionalmente publica) el paquete en AUR como
# `remote-controllers-bin`.
#
# Uso:
#   bash distros/aur/publish-aur.sh           # prepara PKGBUILD + .SRCINFO
#   bash distros/aur/publish-aur.sh --push    # además hace commit y push a AUR
#
# Requisitos: base-devel (makepkg, updpkgsums) y, para --push, una clave SSH
# registrada en https://aur.archlinux.org (cuenta AUR).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH_DIR="$ROOT_DIR/distros/archlinux"
COMMON_DIR="$ROOT_DIR/distros/common"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"

if ! command -v makepkg >/dev/null 2>&1; then
  echo "Error: makepkg no está disponible (instala base-devel)." >&2
  exit 1
fi

echo ">> Versión: $VERSION"

# Los archivos auxiliares se mantienen en el repositorio (launcher y .desktop
# en distros/common) y se copian aquí para que el AUR sea autocontenido.
cp -f "$COMMON_DIR/remotecontrollers.desktop" "$AUR_DIR/"
cp -f "$COMMON_DIR/remotecontrollers.sh" "$AUR_DIR/"
cp -f "$ARCH_DIR/remotecontrollers.install" "$AUR_DIR/"
chmod +x "$AUR_DIR/remotecontrollers.sh"

sed -i "s/^pkgver=.*/pkgver=${VERSION}/" "$AUR_DIR/PKGBUILD"
sed -i 's/^pkgrel=.*/pkgrel=1/' "$AUR_DIR/PKGBUILD"

if command -v updpkgsums >/dev/null 2>&1; then
  echo ">> Calculando sumas (descarga el AppImage de la release)"
  ( cd "$AUR_DIR" && updpkgsums )
else
  echo ">> Aviso: updpkgsums no está disponible; deja sha256sums con SKIP (AUR lo rechazará)."
fi

echo ">> Generando .SRCINFO"
( cd "$AUR_DIR" && makepkg --printsrcinfo > .SRCINFO )

echo
echo "Archivos listos en: $AUR_DIR"
echo "  PKGBUILD  .SRCINFO  remotecontrollers.desktop  remotecontrollers.sh  remotecontrollers.install"

if [[ "${1:-}" == "--push" ]]; then
  AUR_REPO="ssh://aur@aur.archlinux.org/remote-controllers-bin.git"
  WORK_DIR="$(mktemp -d)"
  trap 'rm -rf "$WORK_DIR"' EXIT

  echo ">> Clonando $AUR_REPO"
  git clone "$AUR_REPO" "$WORK_DIR/remote-controllers-bin"

  cp -f "$AUR_DIR/PKGBUILD" "$AUR_DIR/.SRCINFO" \
        "$AUR_DIR/remotecontrollers.desktop" "$AUR_DIR/remotecontrollers.sh" \
        "$AUR_DIR/remotecontrollers.install" "$WORK_DIR/remote-controllers-bin/"

  (
    cd "$WORK_DIR/remote-controllers-bin"
    git add -A
    git -c user.name="Damar Narvaez" -c user.email="damar23nnm@gmail.com" \
        commit -m "Actualiza remote-controllers-bin a ${VERSION}" || echo "Sin cambios que subir."
    git push
  )
  echo ">> Publicado en AUR: yay -S remote-controllers-bin"
else
  echo
  echo "Para publicarlo:"
  echo "  bash distros/aur/publish-aur.sh --push"
  echo "  (o copia PKGBUILD + .SRCINFO + auxiliares al repo AUR y haz push)"
fi
