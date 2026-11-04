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

### Debian / Ubuntu (.deb)

Compatible con **Debian 12 y 13** (y posteriores) y **Ubuntu 22.04, 24.04, 24.10, 25.04, 25.10, 26.04, 26.10…** (amd64).

**Opción A — GitHub Releases (recomendado)**

1. Abre [Releases en GitHub](https://github.com/gummdoms/remoteController/releases)
2. Descarga `remotecontrollers_<versión>-1_amd64.deb`
3. Instálalo (apt resuelve e instala las dependencias):

```bash
sudo apt install ./remotecontrollers_*_amd64.deb
```

**Opción B — Lago de datos**

```bash
wget https://datalake.dambra-os.com/public/remote-controller/releases/debian/remotecontrollers_1.0.8-1_amd64.deb
sudo apt install ./remotecontrollers_1.0.8-1_amd64.deb
```

**Opción C — Paquete local compilado por ti**

```bash
npm run dist:deb
sudo apt install ./dist/remotecontrollers_*_amd64.deb
```

> Usa siempre `apt install ./archivo.deb` (con `./`) para que apt resuelva las
> dependencias; `dpkg -i` por sí solo no las instala.

Después de instalar, cierra sesión y vuelve a entrar para aplicar los grupos y
abre **Remote Controllers** desde el menú o ejecuta:

```bash
remotecontrollers
```

El paquete:

- **No necesita FUSE ni `libfuse2`**: el AppImage va desempaquetado en
  `/opt/remotecontrollers`.
- Instala `chrome-sandbox` con **setuid root**, así que el sandbox de Chromium
  funciona incluso con la restricción de *user namespaces* de Ubuntu 23.10+.
- Declara sus dependencias en `Depends` (con alternativas `| …t64` para
  Ubuntu 24.04+ y Debian 13): `libgtk-3-0`, `libnss3`, `libgbm1`, `libasound2`,
  `ddcutil`, `x11-xserver-utils`, `pkexec`, `xdg-utils`…
- Configura `/dev/uinput` (regla udev + módulo al arrancar) y añade al usuario a
  los grupos `input`, `uinput`, `video` e `i2c` desde el `postinst`.

Actualizar = instalar el `.deb` nuevo:

```bash
sudo apt install ./remotecontrollers_<nueva-versión>-1_amd64.deb
```

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
- En **Debian/Ubuntu** el `.deb` las declara en `Depends`, así que
  `apt install ./remotecontrollers_*_amd64.deb` lo deja todo listo.
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
| `npm run dist:deb` | Genera `.deb` para Debian/Ubuntu |
| `npm run dist:deb:release` | Build `.deb` + subida al lago de datos |
| `npm run dist:arch:pkg` | Genera `.pkg.tar.zst` para Arch |
| `npm run dist:arch:release` | Build Arch + índice pacman + subida al lago de datos |
| `npm run dist:release:upload` | Sube exe, AppImage y paquetes al lago de datos |

---

## Publicar releases (mantenedor)

Los artefactos se publican en **dos canales**:

| Canal | Uso |
|-------|-----|
| [GitHub Releases](https://github.com/gummdoms/remoteController/releases) | CI automático en cada push a `main` (`.exe`, AppImage, `.pkg`, `.deb`) |
| **Lago de datos** | Descargas públicas en `public/remote-controller/releases/` |

### Estructura en el lago de datos

```text
public/remote-controller/releases/
├── windows/          # Instalador NSIS (.exe)
├── linux/            # AppImage
├── debian/           # Paquete .deb (Debian / Ubuntu)
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
DATA_LAKE_UPLOAD_URL=            # opcional: host sin Cloudflare para >100 MB
DATA_LAKE_USER=tu_usuario
DATA_LAKE_PASSWORD=tu_password
DATA_LAKE_STORAGE_PATH=public/remote-controller
RELEASES_BASE=https://datalake.dambra-os.com/public/remote-controller/releases
```

Sustituye el dominio por el real (por ejemplo `https://datalake.damnova.com`).

`DATA_LAKE_URL` se usa para las URLs públicas. `DATA_LAKE_UPLOAD_URL` se usa
solo para **subir** (útil si el binario supera el límite de Cloudflare).

#### Credenciales en GitHub Actions

Cada valor se lee **primero de *Repository variables* y, si no existe, de
*Repository secrets*** (`Settings → Secrets and variables → Actions`), así que
puedes configurarlas en cualquiera de las dos pestañas:

| Nombre | Obligatoria | Uso |
|--------|-------------|-----|
| `DATA_LAKE_URL` | sí | URL pública del lago de datos |
| `DATA_LAKE_USER` | sí | Usuario |
| `DATA_LAKE_PASSWORD` | sí | Contraseña (mejor como *secret*) |
| `DATA_LAKE_UPLOAD_URL` | no | Host de subida sin Cloudflare |
| `DATA_LAKE_STORAGE_PATH` | no | Prefijo de almacenamiento |
| `RELEASES_BASE` | no | Base pública para verificar descargas |
| `TS_AUTHKEY` | no | Auth key de Tailscale (crear con *Ephemeral*) |
| `DATA_LAKE_TAILSCALE_HOST` | no | Host a usar si solo hay Tailscale |

**Prioridad del host de subida** (el workflow lo escribe en el resumen del job):

1. `DATA_LAKE_UPLOAD_URL` — si está definido se usa **tal cual**, nunca se
   sustituye por la IP por defecto.
2. Tailscale — `DATA_LAKE_TAILSCALE_HOST` o, si no existe,
   `http://100.105.212.100:30001` (solo cuando el runner se unió a la tailnet).
3. `DATA_LAKE_URL` — subida directa por Cloudflare.

El paso **Check data lake credentials** añade al *job summary* una tabla con qué
variables están definidas y cuáles están vacías, para detectar de un vistazo si
el valor se puso en la pestaña equivocada.

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

### Subir todos los artefactos (Windows + Linux + Debian + Arch)

Tras compilar localmente o descargar artefactos de CI:

```bash
npm run dist:win
npm run dist:linux
npm run dist:deb
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

### `413 Payload Too Large` al subir releases (Cloudflare)

Cloudflare limita el **cuerpo de cada petición a 100 MB** en planes Free/Pro.
El instalador `.exe` y el `.pkg.tar.zst` suelen superarlo, así que el paso
«Upload assets to data lake» falla con `413` y el repositorio pacman no se
publica.

Soluciones (de más simple a más compleja):

1. **Subdominio DNS-only** (recomendado): crea `upload.datalake.dambra-os.com`
   apuntando directo al servidor, **sin el proxy naranja** de Cloudflare, con
   certificado Let's Encrypt. Luego define el secret `DATA_LAKE_UPLOAD_URL` con
   ese host. Las descargas siguen por Cloudflare.
2. **Cloudflare R2**: subir los binarios pesados con la API S3 (admite hasta
   5 GiB por PUT) y servir el repositorio desde un dominio propio.
3. **Tailscale** (configurado): el runner entra en la tailnet con
   `tailscale/github-action` usando el secret `TS_AUTHKEY`, y el workflow pone
   solo `DATA_LAKE_UPLOAD_URL=http://100.105.212.100:30001` (servidor
   `server-prod`). Las descargas siguen por Cloudflare; solo la subida va por la
   tailnet.

   La auth key debe crearse en el panel de Tailscale con la casilla
   **Ephemeral** marcada (así el nodo desaparece solo al terminar el job); no se
   pasa `--ephemeral` por CLI porque `tailscale up` no acepta ese flag.

   Comprobado: 105 MB subidos en ~7 s por esa IP, sin `413`. No hace falta
   exponer el origen a Internet.

Mientras no se corrija el host, el workflow sigue subiendo el resto de archivos
(no aborta todo) y omite el índice `bjrsoftware.db` si el `.pkg.tar.zst` falló,
para no dejar un repositorio roto.

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

## Archivos en `distros/`

**`distros/common/`** — compartidos por todos los paquetes Linux:

| Archivo | Función |
|---------|---------|
| `remotecontrollers.sh` | Launcher del AppImage empaquetado (Wayland/X11, fallback `--no-sandbox`) |
| `remotecontrollers.desktop` | Entrada de menú |

**`distros/debian/`** — paquete `.deb` (Debian/Ubuntu):

| Archivo | Función |
|---------|---------|
| `build-deb.sh` | AppImage → `.deb` en `dist/` |
| `release.sh` | Build + subida al lago de datos |
| `remotecontrollers.postinst` | Crea grupo `uinput`, recarga udev y añade el usuario a los grupos |
| `remotecontrollers-uinput.rules` | Regla udev de `/dev/uinput` (grupo `uinput` + `uaccess`) |
| `remotecontrollers-uinput.conf` | Carga el módulo `uinput` al arrancar |
| `copyright` | Metadatos de licencia para `/usr/share/doc` |

**`distros/archlinux/`** — paquete pacman:

| Archivo | Función |
|---------|---------|
| `PKGBUILD` | Definición del paquete `remotecontrollers-bin` |
| `build-package.sh` | AppImage → `.pkg.tar.zst` |
| `publish-datalake.sh` | `repo-add` + prepara `dist/datalake-upload/` |
| `upload-datalake.sh` | Sube al lago de datos |
| `release.sh` | Build + publish + upload (flujo completo) |
| `bjrsoftware.repo` | Bloque para `/etc/pacman.conf` |
| `remotecontrollers.install` | Mensajes del paquete pacman |

Documentación del servidor web: [remoteControllerWeb](../remoteControllerWeb/README.md)

---

## Licencia

ISC — Copyright © 2024-2026 BJR Software  
**Damar Narváez Martínez** — damar23nnm@gmail.com

<!-- AUTO-RELEASE-NOTES:START -->
<!-- AUTO-RELEASE-NOTES:END -->
