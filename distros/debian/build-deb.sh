#!/usr/bin/env bash
# Construye el paquete .deb (amd64) para Debian 12/13 y Ubuntu 22.04+.
#
# Igual que el paquete de Arch: reutiliza el AppImage ya compilado y lo
# desempaqueta en /opt/remotecontrollers, así que el usuario NO necesita FUSE,
# libfuse2 ni permisos especiales para ejecutarlo.
#
# Uso: desde la raíz del proyecto -> npm run dist:deb
#
# Variables opcionales:
#   DEB_REVISION   Revisión Debian del paquete (por defecto 1).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEBIAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$ROOT_DIR/distros/common"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$DIST_DIR/deb-build"
PKG_ROOT="$BUILD_DIR/root"
APP_DIR_NAME="remotecontrollers"

PKG_NAME="remotecontrollers"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
REVISION="${DEB_REVISION:-1}"
DEB_VERSION="${VERSION}-${REVISION}"
DEB_ARCH="amd64"
DEB_FILE="$DIST_DIR/${PKG_NAME}_${DEB_VERSION}_${DEB_ARCH}.deb"

for required in dpkg-deb node; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Error: falta '$required'. Instala dpkg (sudo apt install dpkg)." >&2
    exit 1
  fi
done

echo ">> Versión del paquete: $DEB_VERSION"

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

APPIMAGE="$(cd "$(dirname "$APPIMAGE")" && pwd)/$(basename "$APPIMAGE")"
echo ">> AppImage: $(basename "$APPIMAGE")"

# 2) Desempaquetar el AppImage (sin FUSE) dentro del árbol del paquete.
rm -rf "$BUILD_DIR"
mkdir -p "$PKG_ROOT/opt/$APP_DIR_NAME" "$PKG_ROOT/usr/bin" "$PKG_ROOT/DEBIAN"

chmod +x "$APPIMAGE"
mkdir -p "$BUILD_DIR/extract"
(
  cd "$BUILD_DIR/extract"
  "$APPIMAGE" --appimage-extract >/dev/null
)

if [[ ! -d "$BUILD_DIR/extract/squashfs-root" ]]; then
  echo "Error: el AppImage no se pudo desempaquetar (--appimage-extract)." >&2
  exit 1
fi

cp -a "$BUILD_DIR/extract/squashfs-root/." "$PKG_ROOT/opt/$APP_DIR_NAME/"
rm -rf "$BUILD_DIR/extract"

# Permisos sanos: dpkg no debe instalar directorios group-writable ni ficheros
# con escritura de grupo (el AppImage puede traer umask del equipo de build).
find "$PKG_ROOT/opt/$APP_DIR_NAME" -type d -exec chmod 755 {} +
find "$PKG_ROOT/opt/$APP_DIR_NAME" -type f -exec chmod go-w {} +

# 3) Sandbox de Chromium: en un .deb sí podemos instalar chrome-sandbox con
#    setuid root (algo imposible en un AppImage montado por el usuario). Evita
#    el fallo "SUID sandbox helper binary ... is not configured correctly" y
#    permite usar el sandbox incluso con la restricción de user namespaces de
#    Ubuntu 23.10+.
SANDBOX="$PKG_ROOT/opt/$APP_DIR_NAME/chrome-sandbox"
if [[ -f "$SANDBOX" ]]; then
  chown 0:0 "$SANDBOX" 2>/dev/null || true
  chmod 4755 "$SANDBOX"
fi

# 4) Iconos (todas las resoluciones estándar) + integración con el escritorio,
#    launcher y configuración de /dev/uinput.
#    El .desktop usa `Icon=remotecontrollers`, que resuelve contra hicolor.
bash "$ROOT_DIR/scripts/generate-icons.sh" >/dev/null
ICON_TREE="$DIST_DIR/icons/hicolor"
if [[ -d "$ICON_TREE" ]]; then
  install -d "$PKG_ROOT/usr/share/icons"
  cp -a "$ICON_TREE" "$PKG_ROOT/usr/share/icons/hicolor"
  install -Dm644 "$ICON_TREE/512x512/apps/remotecontrollers.png" \
    "$PKG_ROOT/usr/share/pixmaps/remotecontrollers.png"
else
  install -Dm644 "$ROOT_DIR/assets/icon.png" \
    "$PKG_ROOT/usr/share/icons/hicolor/512x512/apps/remotecontrollers.png"
  install -Dm644 "$ROOT_DIR/assets/icon.png" \
    "$PKG_ROOT/usr/share/pixmaps/remotecontrollers.png"
fi

install -Dm755 "$COMMON_DIR/remotecontrollers.sh" "$PKG_ROOT/usr/bin/remotecontrollers"
install -Dm644 "$COMMON_DIR/remotecontrollers.desktop" "$PKG_ROOT/usr/share/applications/remotecontrollers.desktop"
install -Dm644 "$DEBIAN_DIR/remotecontrollers-uinput.rules" "$PKG_ROOT/usr/lib/udev/rules.d/70-remotecontrollers-uinput.rules"
install -Dm644 "$DEBIAN_DIR/remotecontrollers-uinput.conf" "$PKG_ROOT/usr/lib/modules-load.d/remotecontrollers-uinput.conf"
install -Dm644 "$DEBIAN_DIR/copyright" "$PKG_ROOT/usr/share/doc/$PKG_NAME/copyright"
install -Dm755 "$DEBIAN_DIR/remotecontrollers.postinst" "$PKG_ROOT/DEBIAN/postinst"

INSTALLED_SIZE="$(du -sk "$PKG_ROOT" | awk '{print $1}')"

# 5) Metadatos. Las alternativas `paquete | paquete-t64` cubren el renombrado
#    t64 de Ubuntu 24.04+ / Debian 13 sin romper Debian 12 ni Ubuntu 22.04.
cat > "$PKG_ROOT/DEBIAN/control" <<EOF
Package: $PKG_NAME
Version: $DEB_VERSION
Architecture: $DEB_ARCH
Maintainer: Damar Narváez Martínez <damar23nnm@gmail.com>
Installed-Size: $INSTALLED_SIZE
Section: utils
Priority: optional
Homepage: https://remote-controller.bjrsoftware.uk/
Provides: remote-controllers
Depends: libgtk-3-0 | libgtk-3-0t64, libatk1.0-0 | libatk1.0-0t64, libatk-bridge2.0-0 | libatk-bridge2.0-0t64, libnotify4, libnss3, libnspr4, libxss1, libxtst6, libatspi2.0-0 | libatspi2.0-0t64, libuuid1, libsecret-1-0 | libsecret-1-0t64, libdrm2, libgbm1, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libxext6, libx11-6, libx11-xcb1, libxcb1, libwayland-client0, libwayland-cursor0, libwayland-egl1, libcups2 | libcups2t64, libasound2 | libasound2t64, libpulse0 | libpulse0t64, libglib2.0-0 | libglib2.0-0t64, libpango-1.0-0, libcairo2, libexpat1, libdbus-1-3, libglvnd0, libegl1, libgles2, libgl1, xdg-utils, pkexec | policykit-1, ddcutil, x11-xserver-utils
Recommends: libayatana-appindicator3-1 | libappindicator3-1, pipewire-bin | pulseaudio-utils
Description: Control remoto seguro de tu PC desde la web o el movil
 Remote Controllers permite controlar el mouse, el teclado, el audio, el
 brillo y las pantallas del equipo desde el navegador o el movil.
 .
 Incluye el runtime de Electron integrado (no requiere libfuse2) y configura
 /dev/uinput para que el control de entrada funcione en Wayland (Hyprland,
 Sway, KDE Plasma, GNOME, COSMIC) y en X11.
EOF

# 6) Empaquetar. --root-owner-group evita necesitar fakeroot.
if dpkg-deb --help 2>/dev/null | grep -q -- '--root-owner-group'; then
  dpkg-deb --root-owner-group --build "$PKG_ROOT" "$DEB_FILE" >/dev/null
else
  if ! command -v fakeroot >/dev/null 2>&1; then
    echo "Error: tu dpkg-deb no soporta --root-owner-group y falta fakeroot." >&2
    exit 1
  fi
  fakeroot dpkg-deb --build "$PKG_ROOT" "$DEB_FILE" >/dev/null
fi

rm -rf "$BUILD_DIR"

echo
echo "Paquete generado:"
echo "  $DEB_FILE"
echo
dpkg-deb --info "$DEB_FILE" | sed -n '1,20p'
echo
echo "Instalar localmente: sudo apt install \"$DEB_FILE\""
echo "Publicar:            npm run dist:deb:release"
