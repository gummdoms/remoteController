#!/usr/bin/env bash
# Launcher de Remote Controllers (AppImage desempaquetado) con soporte
# Wayland y X11.
#
# Wayland cubierto: Hyprland, Sway/wlroots, KDE Plasma, GNOME, COSMIC.
#
# El paquete pacman NO usa FUSE: el AppImage se descomprime en
# /opt/remotecontrollers durante el build del paquete.
#
# Fallbacks automáticos:
#   - Sandbox de Chromium bloqueado (AppArmor/namespaces) -> --no-sandbox
#   - Falta el runtime del AppImage -> se avisa en el log
# Todos los errores quedan registrados en un log para poder diagnosticar.

APP_DIR="/opt/remotecontrollers"
APP_BIN="$APP_DIR/AppRun"
LOG_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/remotecontrollers"
mkdir -p "$LOG_DIR"
ERR_LOG="$LOG_DIR/launcher.log"

if [[ ! -x "$APP_BIN" ]]; then
    echo "remotecontrollers: no se encontró $APP_BIN (reinstala el paquete)" >&2
    exit 1
fi

FLAGS=(
    "--gtk-version=3"
)

IS_WAYLAND=0
if [[ "${XDG_SESSION_TYPE:-}" == "wayland" || -n "${WAYLAND_DISPLAY:-}" ]]; then
    IS_WAYLAND=1
fi

if [[ $IS_WAYLAND -eq 1 ]]; then
    # Hyprland / Sway / KDE / GNOME / COSMIC: Ozone elige Wayland cuando existe
    # y cae solo a XWayland si el compositor no lo soporta.
    FLAGS+=(
        "--ozone-platform-hint=auto"
        "--enable-features=WaylandWindowDecorations"
    )
    export ELECTRON_OZONE_PLATFORM_HINT=auto
fi

launch() { # resto = flags extra
    : > "$ERR_LOG"
    "$APP_BIN" "${FLAGS[@]}" "$@" >>"$ERR_LOG" 2>&1
}

# 1er intento: sandbox activo.
launch "$@"
status=$?
[[ $status -eq 0 ]] && exit 0

# Fallback: sandbox de Chromium bloqueado -> desactivarlo.
if grep -qiE "sandbox|setuid_sandbox|user namespace" "$ERR_LOG"; then
    launch --no-sandbox "$@"
    status=$?
    [[ $status -eq 0 ]] && exit 0
fi

echo "remotecontrollers: no se pudo iniciar. Revisa el log: $ERR_LOG" >&2
exit "$status"

