# Arch Linux — Remote Controllers

Guía rápida. Documentación completa en el [README principal](../../README.md).

## Instalar

```bash
sudo tee -a /etc/pacman.conf < distros/archlinux/bjrsoftware.repo
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

El paquete declara `provides=('remotecontrollers' 'remote-controller')`, así que
también funciona:

```bash
sudo pacman -S remote-controller
```

> `pacman -S` solo resuelve paquetes de repositorios configurados en
> `/etc/pacman.conf`. Arch no acepta paquetes de terceros en los repos oficiales,
> así que la única forma de escribir `pacman -S` sin helper es añadir el bloque
> `[bjrsoftware]` (una sola vez).

Si el repositorio aún no está publicado (404 en `bjrsoftware.db`) o prefieres no
usarlo, instala el paquete local:

```bash
sudo pacman -U dist/remotecontrollers-bin-*-x86_64.pkg.tar.zst
```

O usa AUR: ver [`../aur/README.md`](../aur/README.md).

### Qué instala el paquete

- **Electron/Chromium completo** (gtk3, nss, libx11, libxtst, libdrm…).
- **Herramientas que la app usa siempre**: `ddcutil` (brillo/contraste),
  `polkit` (pkexec) y `xorg-xrandr` (modos en X11).
- El AppImage se **desempaqueta** en `/opt/remotecontrollers`: no hace falta
  `libfuse2`.
- Según el escritorio, la app puede instalar el resto (`kscreen`, `wlr-randr`,
  `pipewire`) desde su panel de servicios.

## Compilar el paquete

```bash
npm run dist:arch:pkg
```

- Reutiliza el AppImage de `dist/` (o lo compila si no existe).
- Usa `makepkg --nodeps`: es un paquete `-bin`, no compila nada y no exige tener
  instaladas todas las dependencias de runtime en el equipo de build.
- Genera `dist/remotecontrollers-bin-<version>-<rel>-x86_64.pkg.tar.zst`.

## Publicar el repositorio pacman (mantenedor)

```bash
npm run dist:arch:release
```

Esto compila el `.pkg.tar.zst`, regenera el índice (`bjrsoftware.db`) y sube
todo al lago de datos en `public/remote-controller/releases/arch/x86_64/`.

Archivos que deben quedar publicados:

```text
remotecontrollers-bin-<version>-<rel>-x86_64.pkg.tar.zst
bjrsoftware.db      bjrsoftware.files
bjrsoftware.db.tar.zst   bjrsoftware.files.tar.zst
```

El script `publish-datalake.sh` elimina paquetes de versiones anteriores antes de
regenerar el índice, para que `repo-add` no conserve entradas obsoletas.

## Requisitos en el equipo del usuario

El control de entrada en Wayland necesita `/dev/uinput`:

```bash
sudo groupadd -f uinput
sudo usermod -aG input,uinput,video "$USER"
sudo modprobe uinput
# Cierra sesión y vuelve a entrar
```

El paquete muestra estas instrucciones al instalarse (`remotecontrollers.install`).
