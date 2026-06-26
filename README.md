# Remote Controllers — Desktop App

Agente de escritorio para control remoto vía cloud. El panel web/PWA vive en el servidor; esta app mantiene el PC en línea y ejecuta comandos locales.

| Recurso | URL |
|---------|-----|
| Web / login | https://remote-controller.bjrsoftware.uk/ |
| Repo pacman (releases) | https://realses.bjrsoftware.uk/arch/os/x86_64/ |
| Contacto | damar23nnm@gmail.com |

---

## Arquitectura

```text
Móvil / navegador (PWA)
    ↓ HTTPS + JWT
Servidor cloud (web/)
    ↓ WebSocket /api/proxy
DesktopApp (este repo)
    ↓ localhost:4800
API local + módulo nativo (mouse, brillo, apps…)
```

- **Login en desktop:** vincula el equipo a tu cuenta cloud.
- **Control remoto:** desde `/control` en la web, no por IP local.
- **Sin pairing por código** en la versión actual: login directo en la app de escritorio.

### Carpetas importantes

```text
DesktopApp/
├── app.js                    # Electron + API local Express
├── desktop/                  # Agente cloud (WebSocket, auth, device-store)
├── distros/archlinux/        # PKGBUILD, scripts R2, repo pacman
├── modules/                  # Control nativo del mouse (C++)
├── static/                   # Assets del panel local (legacy)
└── views/                    # UI servida por API local
```

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
cd DesktopApp
npm run setup          # install + nativos + sass
npm start              # desarrollo (cloud URL por defecto en start:prod)
npm run start:prod     # apunta a https://remote-controller.bjrsoftware.uk
```

### Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm run setup` | `npm install` + `build:native` + `build:sass` |
| `npm start` | Electron en modo desarrollo |
| `npm run start:prod` | Electron contra cloud de producción |
| `npm run build:native` | Compila módulo C++ del mouse |
| `npm run build:sass` | Compila estilos SCSS |
| `npm run dist:linux` | Genera AppImage |
| `npm run dist:arch:pkg` | Genera `.pkg.tar.zst` para Arch |
| `npm run dist:arch:publish` | Genera índice pacman en `dist/r2-upload/` |
| `npm run dist:arch:upload` | Sube a R2 vía Wrangler (token con permiso R2) |
| `npm run dist:arch:release` | **Build + publish + rclone upload** (flujo completo) |

---

## Instalación en Arch Linux (usuarios finales)

### 1. Añadir el repositorio

Una sola vez:

```bash
sudo tee -a /etc/pacman.conf <<'EOF'

[bjrsoftware]
SigLevel = Optional TrustAll
Server = https://realses.bjrsoftware.uk/arch/os/$arch
EOF
```

O copia el bloque de `distros/archlinux/bjrsoftware.repo`.

### 2. Instalar

```bash
sudo pacman -Sy
# Debe aparecer la línea "bjrsoftware" al sincronizar
sudo pacman -S remotecontrollers-bin
```

### 3. Ejecutar

Desde el menú de aplicaciones **Remote Controllers**, o:

```bash
remotecontrollers
```

Inicia sesión con tu cuenta de https://remote-controller.bjrsoftware.uk/

### 4. Actualizar

```bash
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

### 5. Desinstalar

```bash
sudo pacman -R remotecontrollers-bin
```

### Dependencias opcionales (mejor experiencia en Linux)

```bash
sudo pacman -S --needed pipewire wireplumber ddcutil xorg-xrandr kscreen polkit
sudo gpasswd -a "$USER" i2c video input uinput
# Cierra sesión y vuelve a entrar para aplicar grupos
```

---

## Publicar releases (mantenedor)

Flujo para generar el paquete, el repo pacman y subirlo a **Cloudflare R2**.

### Estructura en R2

Bucket: `remote-controller`  
Ruta: `arch/os/x86_64/`

```text
arch/os/x86_64/
  remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst   # paquete (~127 MB)
  bjrsoftware.db.tar.zst                              # índice comprimido
  bjrsoftware.files.tar.zst
  bjrsoftware.db                                      # copia (R2 no soporta symlinks)
  bjrsoftware.files
```

URL pública del repo: https://realses.bjrsoftware.uk/arch/os/x86_64/

---

### Opción rápida: script de actualización completo

Requiere **rclone** configurado (ver abajo):

```bash
cd DesktopApp
npm run dist:arch:release
```

Esto ejecuta:

1. `dist:arch:pkg` — compila AppImage + `.pkg.tar.zst`
2. `dist:arch:publish` — genera `dist/r2-upload/` con los 5 archivos
3. Borra el `.pkg` viejo en R2 y sube todo con rclone

Si tu remote de rclone no se llama `cloudflaredr2`:

```bash
RCLONE_REMOTE=cloudflaredr2 npm run dist:arch:release
```

---

### Paso a paso manual

#### 1. Compilar el paquete

```bash
cd DesktopApp
npm run setup              # solo la primera vez o tras cambios nativos
npm run dist:arch:pkg
```

Salida: `dist/remotecontrollers-bin-{version}-1-x86_64.pkg.tar.zst`

#### 2. Generar índice del repo

```bash
npm run dist:arch:publish
```

Salida: `dist/r2-upload/` con 5 archivos. El script imprime **size** y **sha256** del `.pkg`.

#### 3. Subir a R2

Elige una opción:

**A) rclone (recomendado)**

```bash
# Si el .pkg ya existía, bórralo primero para forzar re-subida
rclone delete cloudflaredr2:remote-controller/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst

rclone copy dist/r2-upload/ cloudflaredr2:remote-controller/arch/os/x86_64/ -v
```

Debe transferir ~**127 MiB** para el `.pkg`. Si solo transfiere ~2 KiB, el paquete no se actualizó — usa `rclone delete` antes.

**B) Panel Cloudflare**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → `remote-controller`
2. Carpeta `arch/os/x86_64/`
3. Sube los **5 archivos** de `dist/r2-upload/` sobrescribiendo los existentes

**C) Wrangler**

```bash
npm run dist:arch:upload
```

Requiere `CF_ACCOUNT_ID` y `CF_API_TOKEN` con permiso **R2 Object Read & Write** en `web/.env`.

#### 4. Verificar subida

```bash
# Tamaño local (lo imprime dist:arch:publish)
stat -c%s dist/r2-upload/remotecontrollers-bin-*-x86_64.pkg.tar.zst

# Tamaño en R2 directo
rclone size cloudflaredr2:remote-controller/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst

# Tamaño en URL pública (lo que usa pacman)
curl -sI https://realses.bjrsoftware.uk/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst | grep -i content-length
```

Los tres deben coincidir (ej. `132812217`).

#### 5. Purgar caché Cloudflare

El dominio `realses.bjrsoftware.uk` cachea archivos. Tras cada release:

1. Cloudflare → dominio → **Caching** → **Purge Cache**
2. Purga estas URLs (o todo `realses.bjrsoftware.uk/arch/*`):

```text
https://realses.bjrsoftware.uk/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst
https://realses.bjrsoftware.uk/arch/os/x86_64/bjrsoftware.db
https://realses.bjrsoftware.uk/arch/os/x86_64/bjrsoftware.db.tar.zst
https://realses.bjrsoftware.uk/arch/os/x86_64/bjrsoftware.files
https://realses.bjrsoftware.uk/arch/os/x86_64/bjrsoftware.files.tar.zst
```

**Regla permanente (recomendado):** Cache Rules → `realses.bjrsoftware.uk/arch/*` → **Bypass cache**.

Verifica que ya no esté cacheado:

```bash
curl -sI https://realses.bjrsoftware.uk/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst | grep -iE 'content-length|cf-cache'
# content-length: 132812217
# cf-cache-status: MISS  (no HIT)
```

---

## Configurar rclone para Cloudflare R2

```bash
sudo pacman -S rclone
rclone config
```

| Pregunta | Valor |
|----------|-------|
| Tipo de storage | `4` (s3) |
| Provider | `Cloudflare` |
| env_auth | `false` |
| access_key_id | Access Key del token R2 |
| secret_access_key | Secret del token R2 |
| endpoint | `https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| bucket_acl / object_lock | Enter (defaults) |
| Nombre del remote | ej. `cloudflaredr2` |

Crear token R2: Dashboard → **R2** → **Manage R2 API Tokens** → Object Read & Write en `remote-controller`.

Probar:

```bash
rclone lsd cloudflaredr2:
# Debe listar: remote-controller
```

---

## Instalación local sin repo (prueba)

```bash
sudo pacman -U dist/remotecontrollers-bin-*-x86_64.pkg.tar.zst
remotecontrollers
```

---

## Solución de problemas

### `pacman -Sy` no muestra `bjrsoftware`

Falta el bloque `[bjrsoftware]` en `/etc/pacman.conf`. Ver [Añadir el repositorio](#1-añadir-el-repositorio).

### `suma de verificación` / paquete dañado

Causas habituales:

1. **Índice y paquete desincronizados** — subiste `.db` nuevo pero dejaste `.pkg` viejo en R2.
2. **Caché Cloudflare** — la URL pública sirve archivo viejo (`cf-cache-status: HIT`).

```bash
# Regenerar todo
npm run dist:arch:publish

# Forzar subida del paquete
rclone delete cloudflaredr2:remote-controller/arch/os/x86_64/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst
rclone copy dist/r2-upload/ cloudflaredr2:remote-controller/arch/os/x86_64/ -v

# Purgar caché Cloudflare (panel web)

# Verificar tamaños coinciden, luego instalar
sudo rm -f /var/cache/pacman/pkg/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

### rclone muy rápido (~2 KiB, no ~127 MiB)

Rclone omitió el `.pkg` pensando que ya existía. Usa `rclone delete` del `.pkg` antes de `rclone copy`, o el script `npm run dist:arch:release`.

### `zsh: no matches found` al borrar caché pacman

```bash
sudo rm -f /var/cache/pacman/pkg/remotecontrollers-bin-1.0.5-1-x86_64.pkg.tar.zst
```

### Equipo no aparece en la web

- App desktop abierta y sesión iniciada.
- Estado **En línea** en el dashboard de la app.
- Misma cuenta en web y desktop.

### Mouse / touchpad lento desde el móvil

La latencia depende de la red hasta el servidor cloud. El relay usa fire-and-forget para movimientos. Configura sensibilidad en el panel **Configuración del mouse** (se guarda en D1 por equipo).

---

## Archivos en `distros/archlinux/`

| Archivo | Función |
|---------|---------|
| `PKGBUILD` | Definición del paquete `remotecontrollers-bin` |
| `build-package.sh` | AppImage → `.pkg.tar.zst` |
| `publish-r2.sh` | `repo-add` + prepara `dist/r2-upload/` |
| `upload-r2.sh` | Sube a R2 vía Wrangler |
| `release.sh` | Build + publish + rclone (flujo completo) |
| `bjrsoftware.repo` | Bloque para `/etc/pacman.conf` |
| `remotecontrollers.desktop` | Entrada de menú |
| `remotecontrollers.sh` | Launcher del AppImage empaquetado |

Documentación adicional del servidor web: `../web/README.md`

---

## Licencia
ISC — Copyright © 2024-2026 BJR Software  
**Damar Narváez Martínez** — damar23nnm@gmail.com
=======
Si tienes preguntas o problemas, revisa `INSTALL.md` para una guía más detallada.

<!-- AUTO-RELEASE-NOTES:START -->
## Release Documentado Por Copilot

- Rama: main
- Commit: 74f6ea52ab9e7a38dde114c1fc87bc40f5e2bf50
- Mensaje principal: Merge pull request #7 from gummdoms/DamarN/dev

Actions Generar Assets separados
- Fecha: 2026-05-18 18:56 UTC

### Mejoras detectadas
- Merge pull request #7 from gummdoms/DamarN/dev (74f6ea5)
- Actions Generar Assets separados (f4f54f3)
- docs: actualizar resumen automatico de release [skip ci] (001549f)
- Merge pull request #6 from gummdoms/DamarN/dev (d0ae8f7)
- Actions Generar Assets separados (44a5c52)

### Artefactos
- Windows: instalador NSIS (.exe)
- Linux: AppImage
- Arch Linux: .pkg.tar.zst
