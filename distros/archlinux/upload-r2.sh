#!/usr/bin/env bash
# Sube dist/r2-upload/ al bucket R2 de Cloudflare (sin rclone).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPLOAD_DIR="$ROOT_DIR/dist/r2-upload"
WEB_ENV="$ROOT_DIR/../web/.env"
BUCKET="${R2_BUCKET:-remote-controller}"
PREFIX="${R2_PREFIX:-arch/os/x86_64}"

if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "No existe $UPLOAD_DIR"
  echo "Ejecuta primero: npm run dist:arch:publish"
  exit 1
fi

load_env() {
  if [[ -f "$WEB_ENV" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -E '^(CF_ACCOUNT_ID|CF_API_TOKEN)=' "$WEB_ENV" | sed 's/\r$//')
    set +a
  fi
  export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
  export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
}

load_env

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" || -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Faltan credenciales Cloudflare."
  echo "Define CF_ACCOUNT_ID y CF_API_TOKEN en $WEB_ENV"
  echo "o exporta CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN."
  exit 1
fi

echo "Nota: el API token debe tener permiso R2 → Object Read & Write."

echo "==> Subiendo a r2://$BUCKET/$PREFIX/"
echo "    (credenciales desde ${WEB_ENV})"
echo

shopt -s nullglob
files=("$UPLOAD_DIR"/*)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No hay archivos en $UPLOAD_DIR"
  exit 1
fi

for file in "${files[@]}"; do
  name="$(basename "$file")"
  key="$PREFIX/$name"
  size="$(stat -c%s "$file")"
  echo "-> $name ($size bytes)"
  npx --yes wrangler r2 object put "$BUCKET/$key" --file="$file" --remote
done

echo
echo "Subida completada."
echo "Verifica tamaño del paquete:"
PKG="$(ls -1 "$UPLOAD_DIR"/remotecontrollers-bin-*-x86_64.pkg.tar.zst 2>/dev/null | head -1)"
if [[ -n "$PKG" ]]; then
  LOCAL_SIZE="$(stat -c%s "$PKG")"
  PKG_NAME="$(basename "$PKG")"
  echo "  curl -sI https://realses.bjrsoftware.uk/$PREFIX/$PKG_NAME | grep -i content-length"
  echo "  Debe ser: content-length: $LOCAL_SIZE"
fi
