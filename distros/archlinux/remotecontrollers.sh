#!/usr/bin/env bash
# Launcher de Remote Controllers (AppImage) con compatibilidad para COSMIC y Wayland.
#
# Resuelve los fallos más comunes al arrancar en COSMIC / sesiones Wayland:
#   1. Wayland nativo (Ozone) con fallback a X11: --ozone-platform-hint=auto
#   2. FUSE no disponible (libfuse2) -> extrae y ejecuta el AppImage
#   3. Sandbox de Chromium bloqueado (AppArmor/namespaces) -> reintenta con --no-sandbox
# Todos los errores quedan registrados en un log para poder diagnosticar.

APPIMAGE="/opt/remotecontrollers/remotecontrollers.AppImage"
LOG_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/remotecontrollers"
mkdir -p "$LOG_DIR"
ERR_LOG="$LOG_DIR/launcher.log"

if [[ ! -x "$APPIMAGE" ]]; then
    echo "remotecontrollers: no se encontró el AppImage en $APPIMAGE" >&2
    exit 1
fi

FLAGS=(
    "--ozone-platform-hint=auto"
    "--enable-features=WaylandWindowDecorations"
)

launch() { # $1 = extract-and-run (1|0); resto = flags extra
    local extract="$1"
    shift
    : > "$ERR_LOG"
    if [[ "$extract" == "1" ]]; then
        APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGE" "${FLAGS[@]}" "$@" >>"$ERR_LOG" 2>&1
    else
        APPIMAGE_EXTRACT_AND_RUN=0 "$APPIMAGE" "${FLAGS[@]}" "$@" >>"$ERR_LOG" 2>&1
    fi
}

# 1er intento: montaje FUSE normal y sandbox activo.
launch 0 "$@"
status=$?
[[ $status -eq 0 ]] && exit 0

# Fallback 1: FUSE no disponible -> extraer el AppImage y ejecutar.
if grep -qiE "libfuse|fuse\.so|AppImages require FUSE" "$ERR_LOG"; then
    launch 1 "$@"
    status=$?
    [[ $status -eq 0 ]] && exit 0
fi

# Fallback 2: sandbox de Chromium bloqueado -> desactivarlo.
if grep -qiE "sandbox|setuid_sandbox|user namespace" "$ERR_LOG"; then
    launch 1 --no-sandbox "$@"
    status=$?
    [[ $status -eq 0 ]] && exit 0
fi

echo "remotecontrollers: no se pudo iniciar. Revisa el log: $ERR_LOG" >&2
exit "$status"
