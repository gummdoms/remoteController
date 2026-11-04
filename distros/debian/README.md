# Debian / Ubuntu — Remote Controllers (.deb)

Paquete `.deb` para **Debian 12 (bookworm), Debian 13 (trixie) y posteriores** y
**Ubuntu 22.04, 24.04, 24.10, 25.04, 25.10, 26.04, 26.10…** (amd64).
Guía rápida; documentación completa en el [README principal](../../README.md).

## Instalar

**Opción A — GitHub Releases**

1. Descarga `remotecontrollers_<versión>-<rev>_amd64.deb` desde
   [Releases](https://github.com/gummdoms/remoteController/releases).
2. Instálalo (apt resuelve solo las dependencias):

```bash
sudo apt install ./remotecontrollers_*_amd64.deb
```

**Opción B — Lago de datos**

```text
https://datalake.dambra-os.com/public/remote-controller/releases/debian/
```

```bash
wget https://datalake.dambra-os.com/public/remote-controller/releases/debian/remotecontrollers_1.0.8-1_amd64.deb
sudo apt install ./remotecontrollers_1.0.8-1_amd64.deb
```

**Opción C — compilarlo tú mismo**

```bash
npm run dist:deb
sudo apt install ./dist/remotecontrollers_*_amd64.deb
```

> Usa siempre `apt install ./archivo.deb` (con `./`) para que apt resuelva e
> instale las dependencias. `dpkg -i` solo no las instala.

Después de instalar, **cierra sesión y vuelve a entrar** para que se apliquen los
grupos (`input`, `uinput`, `video`) y ejecuta:

```bash
remotecontrollers
```

O abre **Remote Controllers** desde el menú de aplicaciones.

## Qué instala el paquete

- El runtime de **Electron/Chromium** completo y el AppImage **desempaquetado**
  en `/opt/remotecontrollers`: **no hace falta `libfuse2` ni FUSE**.
- `/usr/bin/remotecontrollers`: launcher con soporte Wayland/X11 y fallback
  automático a `--no-sandbox` si el sandbox de Chromium está bloqueado.
- `chrome-sandbox` con setuid root (algo imposible en un AppImage), por lo que
  el sandbox funciona incluso con la restricción de *user namespaces* de
  Ubuntu 23.10+.
- Regla udev `/usr/lib/udev/rules.d/70-remotecontrollers-uinput.rules` y
  `/usr/lib/modules-load.d/remotecontrollers-uinput.conf` para que `/dev/uinput`
  esté disponible al arrancar.
- Dependencias declaradas en `Depends` (se instalan solas con apt): `libgtk-3-0`,
  `libnss3`, `libgbm1`, `libasound2`, `ddcutil`, `x11-xserver-utils`, `pkexec`,
  `xdg-utils`… con alternativas `| …t64` para el renombrado t64 de
  Ubuntu 24.04+ y Debian 13.
- `Recommends`: `libayatana-appindicator3-1` (icono de bandeja) y
  `pipewire-bin | pulseaudio-utils` (volumen).

El `postinst` crea el grupo `uinput`, recarga las reglas udev, carga el módulo y
añade al usuario que ejecutó la instalación a los grupos `input`, `uinput`,
`video` e `i2c` (si existen). Si la instalación no se hizo con `sudo` desde una
terminal (por ejemplo, desde una tienda gráfica), muestra el comando exacto.

Las herramientas que dependen del escritorio (`kscreen` en KDE, `wlr-randr` en
Sway, `pipewire` para audio) se instalan desde la propia app: pestaña de
servicios → **Instalar dependencias faltantes**.

## Compilar el paquete

```bash
npm run dist:deb
```

- Reutiliza el AppImage de `dist/` (o lo compila si no existe).
- Genera `dist/remotecontrollers_<versión>-<rev>_amd64.deb`.
- No requiere `fakeroot`: usa `dpkg-deb --root-owner-group`.

Revisión del paquete (por si hay que republicar la misma versión):

```bash
DEB_REVISION=2 npm run dist:deb
```

## Publicar (mantenedor)

```bash
npm run dist:deb:release
```

Compila el `.deb` y lo sube al lago de datos en
`public/remote-controller/releases/debian/`.

## Notas de compatibilidad

| Distribución | Estado |
|--------------|--------|
| Debian 12 (bookworm) | ✅ |
| Debian 13 (trixie) y posteriores | ✅ (paquetes `t64`) |
| Ubuntu 22.04 LTS y posteriores | ✅ |
| Debian 11 (bullseye) | ❌ glibc 2.31 < 2.35 del AppImage |

El binario se compila sobre Ubuntu 22.04 (glibc 2.35). Si hiciera falta dar
soporte a Debian 11 habría que compilar el AppImage en Ubuntu 20.04.
