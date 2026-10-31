# Remote Controllers — Desktop App

Agente de escritorio para controlar tu PC desde el móvil o el navegador. Inicia sesión, mantiene el equipo en línea y ejecuta comandos locales (mouse, teclado, apps, brillo, etc.).

| Recurso | URL |
|---------|-----|
| **Panel web / login** | [remote-controller.bjrsoftware.uk](https://remote-controller.bjrsoftware.uk/) |
| **Releases en GitHub** | [github.com/gummdoms/remoteController/releases](https://github.com/gummdoms/remoteController/releases) |
| **Descargas (lago de datos)** | [datalake.dambra-os.com/public/remote-controller/releases](https://datalake.dambra-os.com/public/remote-controller/releases) |
| **Contacto** | damar23nnm@gmail.com |

---

## Cómo funciona

```text
Móvil / navegador (PWA)
    ↓ HTTPS + JWT
Servidor cloud (remoteControllerWeb)
    ↓ WebSocket /api/proxy
Desktop App (este repo)
    ↓ localhost:4800
API local + módulo nativo (mouse, brillo, apps…)
```

1. Creas cuenta en [remote-controller.bjrsoftware.uk](https://remote-controller.bjrsoftware.uk/)
2. Instalas la app de escritorio en tu PC
3. Inicias sesión en la app → el equipo queda vinculado
4. Desde la web abres **Control** y manejas el PC remotamente

---

## Descargas

### Windows

**Opción A — GitHub Releases (recomendado)**

1. Abre [Releases en GitHub](https://github.com/gummdoms/remoteController/releases)
2. Descarga el instalador `Remote Controllers Setup {version}.exe`
3. Ejecuta el instalador y sigue el asistente
4. Abre **Remote Controllers** desde el menú Inicio
5. Inicia sesión con tu cuenta de [remote-controller.bjrsoftware.uk](https://remote-controller.bjrsoftware.uk/)

**Opción B — Lago de datos**

Instalador publicado en:

```text
https://datalake.dambra-os.com/public/remote-controller/releases/windows/
```

URL de descarga (API pública):

```text
https://datalake.dambra-os.com/public/file?path=public/remote-controller/releases/windows&filename=Remote Controllers Setup {version}.exe
```

---

### Arch Linux

**Opción A — Repositorio pacman (recomendado)**

> El repositorio `[bjrsoftware]` solo responde cuando el mantenedor ha publicado
> el índice con `npm run dist:arch:release` (o cuando el workflow de CI ha
> subido los artefactos al data lake). Si `pacman -Sy` da *404*, usa la
> **Opción B** o publica el repositorio antes.

**1. Añade el repositorio** (una sola vez):

```bash
sudo tee -a /etc/pacman.conf <<'EOF'

[bjrsoftware]
SigLevel = Optional TrustAll
Server = https://datalake.dambra-os.com/public/remote-controller/releases/arch/$arch
EOF
```

O copia el bloque de `distros/archlinux/bjrsoftware.repo`.

**2. Instala:**

```bash
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

**3. Ejecuta** desde el menú **Remote Controllers** o con:

```bash
remotecontrollers
```

El paquete instala automáticamente con pacman las librerías de Electron y las
herramientas comunes (`ddcutil`, `polkit`, `xorg-xrandr`). El AppImage va
desempaquetado en `/opt/remotecontrollers`, así que **no necesitas `libfuse2`**.

Las herramientas que dependen de tu escritorio (`kscreen` en KDE, `wlr-randr` en
Sway, `pipewire` para audio) se instalan desde la propia app: pestaña de
servicios → **Instalar dependencias faltantes**.

**4. Actualiza** cuando haya una versión nueva:

```bash
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

**Opción B — Paquete local**

```bash
sudo pacman -U dist/remotecontrollers-bin-*-x86_64.pkg.tar.zst
```

**Opción C — GitHub Releases**

Descarga el `.pkg.tar.zst` desde [Releases](https://github.com/gummdoms/remoteController/releases) e instálalo con `pacman -U`.

---

### Otras distribuciones Linux (AppImage)

**1. Descarga** el AppImage desde [GitHub Releases](https://github.com/gummdoms/remoteController/releases) o desde:

```text
https://datalake.dambra-os.com/public/remote-controller/releases/linux/
```

**2. Dale permisos de ejecución:**

```bash
chmod +x "Remote Controllers-"*.AppImage
```

**3. Ejecuta:**

```bash
./"Remote Controllers-"*.AppImage
```

**4. (Opcional)** Integración en el menú:

```bash
mv "Remote Controllers-"*.AppImage ~/Applications/
# Crea un .desktop apuntando al AppImage
```

**Dependencias recomendadas** (brillo, audio, pantallas en Linux):

```bash
# Arch
sudo pacman -S --needed pipewire wireplumber ddcutil xorg-xrandr kscreen polkit
sudo gpasswd -a "$USER" i2c video input uinput

# Debian / Ubuntu
sudo apt install pipewire wireplumber ddcutil xrandr
sudo usermod -aG video,input "$USER"
```

Cierra sesión y vuelve a entrar para aplicar los grupos.

---

## Wayland y Hyprland

El mouse y el teclado remotos funcionan **con cualquier compositor Wayland**
(Hyprland, Sway, KDE Plasma, GNOME, COSMIC). El módulo nativo detecta la sesión
y crea un dispositivo virtual con `uinput`, porque XTest solo alcanza a
ventanas XWayland.

Requisito único: acceso a `/dev/uinput` (la app lo diagnostica en la pestaña de
servicios y puede corregirlo con `pkexec`):

```bash
sudo groupadd -f uinput
sudo usermod -aG input,uinput,video "$USER"
echo uinput | sudo tee /etc/modules-load.d/uinput.conf
echo 'KERNEL=="uinput", MODE="0660", GROUP="uinput", OPTIONS+="static_node=uinput"' \
  | sudo tee /etc/udev/rules.d/99-uinput.rules
sudo modprobe uinput
sudo udevadm control --reload-rules && sudo udevadm trigger
# Cierra sesión y vuelve a entrar
```

Control de pantallas por compositor:

| Sesión | Herramienta | Paquete |
|--------|-------------|---------|
| Hyprland | `hyprctl` | ya viene con Hyprland |
| KDE Plasma Wayland | `kscreen-doctor` | `kscreen` |
| Sway / wlroots | `wlr-randr` | `wlr-randr` |
| X11 | `xrandr` | `xorg-xrandr` |

La app muestra el backend de entrada activo (`uinput` o `XTest`) en la pestaña
de servicios.

---

## Dependencias del sistema (instalación automática)

La app comprueba al iniciar qué herramientas del sistema tiene disponibles y
puede instalarlas sola, según la distribución y el escritorio:

| Función | Herramienta | Arch | Debian/Ubuntu | Fedora | openSUSE |
|---------|-------------|------|---------------|--------|----------|
| Volumen | `wpctl` / `pactl` | `pipewire` | `pipewire-bin` | `wireplumber` | `pipewire-tools` |
| Brillo/contraste | `ddcutil` | `ddcutil` | `ddcutil` | `ddcutil` | `ddcutil` |
| Pantallas (KDE) | `kscreen-doctor` | `kscreen` | `kscreen` | `kscreen` | `kscreen6` |
| Pantallas (Sway) | `wlr-randr` | `wlr-randr` | `wlr-randr` | `wlr-randr` | `wlr-randr` |
| Pantallas (X11) | `xrandr` | `xorg-xrandr` | `x11-xserver-utils` | `xrandr` | `xrandr` |
| Permisos | `pkexec` | `polkit` | `pkexec` | `polkit` | `polkit` |

- En **Arch** el paquete declara las dependencias en `depends`, así que pacman las
  instala al instalar el paquete.
- En **AppImage** o en otras distribuciones, la app detecta el gestor
  (`pacman`, `apt`, `dnf`, `zypper`, `apk`) y ofrece **«Instalar dependencias
  faltantes»** con un diálogo `pkexec`. También puedes activar
  **«Instalar dependencias al iniciar»** para que se haga solo.
- Si no hay `pkexec`, el panel muestra el comando exacto para copiar y pegar.

---

## Desarrollo local

### Requisitos (Arch Linux)

```bash
sudo pacman -S --needed base-devel python make gcc pkgconf nodejs npm \
    libx11 libxtst libxext xorg-xrandr kscreen ddcutil brightnessctl \
    pipewire wireplumber electron
```

### Instalar y ejecutar

```bash
git clone https://github.com/gummdoms/remoteController.git
cd remoteController
npm run setup
npm start              # desarrollo
npm run start:prod     # contra https://remote-controller.bjrsoftware.uk
```

### Scripts npm útiles

| Script | Descripción |
|--------|-------------|
| `npm run setup` | Instala dependencias + módulos nativos + SASS |
| `npm start` | Electron en desarrollo |
| `npm run start:prod` | Electron contra cloud de producción |
| `npm run dist:win` | Genera instalador `.exe` |
| `npm run dist:linux` | Genera AppImage |
| `npm run dist:arch:pkg` | Genera `.pkg.tar.zst` para Arch |
| `npm run dist:arch:release` | Build Arch + índice pacman + subida al lago de datos |
| `npm run dist:release:upload` | Sube exe, AppImage y paquetes al lago de datos |

---

## Publicar releases (mantenedor)

Los artefactos se publican en **dos canales**:

| Canal | Uso |
|-------|-----|
| [GitHub Releases](https://github.com/gummdoms/remoteController/releases) | CI automático en cada push a `main` (`.exe`, AppImage, `.pkg`) |
| **Lago de datos** | Descargas públicas en `public/remote-controller/releases/` |

### Estructura en el lago de datos

```text
public/remote-controller/releases/
├── windows/          # Instalador NSIS (.exe)
├── linux/            # AppImage
└── arch/x86_64/      # Repo pacman (pkg + bjrsoftware.db + bjrsoftware.files)
```

**URL pública de un archivo:**

```text
https://datalake.dambra-os.com/public/file?path=public/remote-controller/releases/{plataforma}&filename={archivo}
```

**URL directa por carpeta** (pacman y descargas simples):

```text
https://datalake.dambra-os.com/public/remote-controller/releases/{plataforma}/{archivo}
```

### Configuración

Copia `.env.example` a `.env` (o reutiliza el de `remoteControllerWeb`):

```env
DATA_LAKE_URL=https://datalake.dambra-os.com
DATA_LAKE_USER=tu_usuario
DATA_LAKE_PASSWORD=tu_password
DATA_LAKE_STORAGE_PATH=public/remote-controller
```

### Flujo Arch Linux (pacman)

```bash
npm run dist:arch:release
```

Esto ejecuta:

1. `dist:arch:pkg` — compila AppImage + `.pkg.tar.zst`
2. `dist:arch:publish` — genera `dist/datalake-upload/` (5 archivos del repo)
3. `dist:arch:upload` — sube al lago de datos

Puedes ejecutar cada paso por separado:

```bash
npm run dist:arch:pkg       # solo el paquete .pkg.tar.zst
npm run dist:arch:publish   # solo el índice bjrsoftware.db
npm run dist:arch:upload    # solo la subida (requiere .env con DATA_LAKE_*)
```

El repositorio publicado debe contener **exactamente**:

```text
remotecontrollers-bin-<version>-<rel>-x86_64.pkg.tar.zst
bjrsoftware.db      bjrsoftware.files
bjrsoftware.db.tar.zst   bjrsoftware.files.tar.zst
```

Si falta `bjrsoftware.db` en la URL del repositorio, `pacman -Sy` falla con
*404*: significa que el índice nunca se subió (no que el servidor esté mal).

### Subir todos los artefactos (Windows + Linux + Arch)

Tras compilar localmente o descargar artefactos de CI:

```bash
npm run dist:win
npm run dist:linux
npm run dist:arch:pkg
npm run dist:arch:publish
npm run dist:release:upload
```

### Verificar subida

```bash
# Tamaño local
stat -c%s dist/datalake-upload/remotecontrollers-bin-*-x86_64.pkg.tar.zst

# Tamaño remoto (pacman)
curl -sI "https://datalake.dambra-os.com/public/remote-controller/releases/arch/x86_64/$(ls dist/datalake-upload/*.pkg.tar.zst | xargs basename)" \
  | grep -i content-length

# Comprobar que el índice del repositorio existe (debe dar 200)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://datalake.dambra-os.com/public/remote-controller/releases/arch/x86_64/bjrsoftware.db
```

Ambos valores deben coincidir.

---

## Solución de problemas

### La app no abre en COSMIC (Wayland)

COSMIC es un compositor Wayland. Si la ventana no aparece al lanzar desde el menú, revisa el log del launcher:

```bash
cat ~/.cache/remotecontrollers/launcher.log
```

Con el paquete de Arch (`remotecontrollers-bin`) el AppImage va desempaquetado y
no se usa FUSE. Si ejecutas el **AppImage suelto** en otra distribución, revisa:

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `dlopen(): error loading libfuse.so.2` | Falta `libfuse2` (Ubuntu 22.04+) | Instala `libfuse2`, o ejecuta con `APPIMAGE_EXTRACT_AND_RUN=1` |
| `setuid_sandbox_host.cc: The SUID sandbox helper...` | Sandbox de Chromium bloqueado (AppArmor/namespaces) | Añade `--no-sandbox` |
| App corre pero sin ventana visible | Bandeja del sistema sin soporte SNI | La ventana ya no depende de la bandeja (se ignora el error) |

Si instalaste el paquete con una versión anterior, actualiza y reinstala:

```bash
sudo pacman -Syu
sudo pacman -S remotecontrollers-bin
```

O prueba el AppImage directamente desde terminal para ver el error real:

```bash
remotecontrollers
# o si sale del AppImage directo:
APPIMAGE_EXTRACT_AND_RUN=1 "/opt/remotecontrollers/remotecontrollers.AppImage" --ozone-platform-hint=auto --no-sandbox
```

Si la app abre pero el **mouse/teclado remoto no responde en Wayland**, consulta la sección [Mouse / teclado con latencia](#mouse--teclado-con-latencia) y activa el *Modo Wayland experimental* en la pestaña de servicios, o usa una sesión X11.

### `pacman -Sy` no muestra `bjrsoftware`

Falta el bloque `[bjrsoftware]` en `/etc/pacman.conf`. Ver [Arch Linux](#arch-linux).

### El paquete Arch no compila (`ERROR: No se pudieron resolver todas las dependencias`)

Es el error típico al ejecutar `makepkg` en un equipo que no tiene instaladas
las dependencias de *runtime* (por ejemplo `libappindicator-gtk3`). El paquete
`remotecontrollers-bin` no compila nada, así que el script ya usa
`makepkg --nodeps`:

```bash
npm run dist:arch:pkg
```

Si aparece `makepkg: no se puede ejecutar como root`, ejecuta el comando con tu
usuario normal (sin `sudo`).

### La sesión se cerraba sola

Ya no ocurre: la sesión se guarda con refresh token y **solo** se borra cuando
pulsas cerrar sesión. Si hay un corte de red, la app reintenta en segundo plano
y muestra *«sin conexión, reintentando»* en vez de expulsarte.

### `suma de verificación` / paquete dañado

1. Regenera el índice: `npm run dist:arch:publish`
2. Vuelve a subir **todos** los archivos de `dist/datalake-upload/`: `npm run dist:arch:upload`
3. Verifica que el `content-length` remoto coincida con el local
4. En el cliente:

```bash
sudo rm -f /var/cache/pacman/pkg/remotecontrollers-bin-*.pkg.tar.zst
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

### Equipo no aparece en la web

- App desktop abierta y sesión iniciada
- Misma cuenta en [remote-controller.bjrsoftware.uk](https://remote-controller.bjrsoftware.uk/) y en la app
- Estado **En línea** en el dashboard de la app

### Mouse / teclado con latencia

La latencia depende de la red hasta el servidor cloud. Ajusta sensibilidad en **Configuración del mouse** del panel web.

---

## Archivos en `distros/archlinux/`

| Archivo | Función |
|---------|---------|
| `PKGBUILD` | Definición del paquete `remotecontrollers-bin` |
| `build-package.sh` | AppImage → `.pkg.tar.zst` |
| `publish-datalake.sh` | `repo-add` + prepara `dist/datalake-upload/` |
| `upload-datalake.sh` | Sube al lago de datos |
| `release.sh` | Build + publish + upload (flujo completo) |
| `bjrsoftware.repo` | Bloque para `/etc/pacman.conf` |
| `remotecontrollers.desktop` | Entrada de menú |
| `remotecontrollers.sh` | Launcher del AppImage empaquetado |

Documentación del servidor web: [remoteControllerWeb](../remoteControllerWeb/README.md)

---

## Licencia

ISC — Copyright © 2024-2026 BJR Software  
**Damar Narváez Martínez** — damar23nnm@gmail.com

<!-- AUTO-RELEASE-NOTES:START -->
<!-- AUTO-RELEASE-NOTES:END -->
