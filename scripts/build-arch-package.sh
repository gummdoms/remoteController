#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PKGROOT="$DIST_DIR/arch-pkg"
APPIMAGE="$DIST_DIR/Remote Controllers-1.0.5.AppImage"

if [[ ! -f "$APPIMAGE" ]]; then
  echo "No existe el AppImage en: $APPIMAGE"
  echo "Ejecuta primero: npm run dist:linux"
  exit 1
fi

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT"

cp -f "$APPIMAGE" "$PKGROOT/remotecontrollers.AppImage"
cp -f "$ROOT_DIR/assets/icon.png" "$PKGROOT/remotecontrollers.png"

cat > "$PKGROOT/remotecontrollers.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Remote Controllers
Comment=Software para control remoto de pantalla
Exec=remotecontrollers
Icon=remotecontrollers
Terminal=false
Categories=Utility;
EOF

cat > "$PKGROOT/remotecontrollers.sh" <<'EOF'
#!/usr/bin/env bash
exec /opt/remotecontrollers/remotecontrollers.AppImage "$@"
EOF
chmod +x "$PKGROOT/remotecontrollers.sh"

cat > "$PKGROOT/PKGBUILD" <<'EOF'
pkgname=remotecontrollers-bin
pkgver=1.0.5
pkgrel=1
pkgdesc="Software para control remoto de pantalla"
arch=('x86_64')
url="https://remotecontrollers.local"
license=('ISC')
options=('!debug' '!strip')
depends=('glibc' 'libx11' 'libxext' 'libxtst' 'libxrandr')
optdepends=('pipewire: control de volumen con wpctl' 'ddcutil: brillo/contraste DDC/CI' 'kscreen: modos de pantalla en KDE Wayland')
source=('remotecontrollers.AppImage' 'remotecontrollers.png' 'remotecontrollers.desktop' 'remotecontrollers.sh')
sha256sums=('SKIP' 'SKIP' 'SKIP' 'SKIP')

package() {
  install -Dm755 "$srcdir/remotecontrollers.AppImage" "$pkgdir/opt/remotecontrollers/remotecontrollers.AppImage"
  install -Dm755 "$srcdir/remotecontrollers.sh" "$pkgdir/usr/bin/remotecontrollers"
  install -Dm644 "$srcdir/remotecontrollers.desktop" "$pkgdir/usr/share/applications/remotecontrollers.desktop"
  install -Dm644 "$srcdir/remotecontrollers.png" "$pkgdir/usr/share/icons/hicolor/512x512/apps/remotecontrollers.png"
}
EOF

(
  cd "$PKGROOT"
  makepkg -f --noconfirm
)

echo
echo "Paquete generado en:"
echo "$PKGROOT/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst"
