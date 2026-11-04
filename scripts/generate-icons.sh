#!/usr/bin/env bash
# Genera el juego de iconos estándar (freedesktop / hicolor) a partir de
# assets/icon.png, para que el .desktop (`Icon=remotecontrollers`) resuelva en
# todas las distribuciones y en todos los tamaños.
#
# Salida:
#   dist/icons/hicolor/<N>x<N>/apps/remotecontrollers.png   (16 … 512)
#
# Herramientas (en orden de preferencia): ImageMagick 7 (`magick`), ImageMagick
# 6 (`convert`) o Python + Pillow. Si no hay ninguna, se copia el original en
# 512x512 para no romper la compilación.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/assets/icon.png"
OUT="$ROOT_DIR/dist/icons/hicolor"
SIZES=(16 24 32 48 64 128 256 512)

if [[ ! -f "$SRC" ]]; then
  echo "Error: no existe $SRC" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  IM=()
fi

if [[ ${#IM[@]} -gt 0 ]]; then
  for size in "${SIZES[@]}"; do
    install -d "$OUT/${size}x${size}/apps"
    "${IM[@]}" "$SRC" -background none -resize "${size}x${size}" \
      "$OUT/${size}x${size}/apps/remotecontrollers.png"
  done
  echo ">> Iconos generados con ${IM[0]} (${SIZES[*]})"
elif python3 -c 'import PIL' >/dev/null 2>&1; then
  python3 - "$SRC" "$OUT" <<'PY'
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
image = Image.open(src).convert('RGBA')
for size in (16, 24, 32, 48, 64, 128, 256, 512):
    directory = os.path.join(out, f'{size}x{size}', 'apps')
    os.makedirs(directory, exist_ok=True)
    image.resize((size, size), Image.LANCZOS).save(
        os.path.join(directory, 'remotecontrollers.png'), 'PNG'
    )
print('>> Iconos generados con Pillow (16 24 32 48 64 128 256 512)')
PY
else
  install -Dm644 "$SRC" "$OUT/512x512/apps/remotecontrollers.png"
  echo ">> Aviso: sin ImageMagick ni Pillow; se copia assets/icon.png en 512x512"
fi

# Permisos homogéneos (el umask del equipo no debe filtrarse al paquete).
find "$OUT" -type d -exec chmod 755 {} +
find "$OUT" -type f -exec chmod 644 {} +
