# 🖱️ Remote Controllers - Control de Mouse Táctil

## 🎯 Características Principales

### ✅ Implementado

- 🖱️ **Touchpad Virtual** con movimiento relativo (como trackpad de portátil)
- ⚡ **Módulo Nativo C++** para control del mouse (Windows API)
- 📱 **Touch events** optimizados para móviles
- 🖱️ **Mouse events** para testing en desktop
- 🎚️ Control de brillo, contraste y volumen
- 🖥️ Gestión de múltiples monitores
- ⚙️ Control de energía (apagar, reiniciar, suspender)
- ⌨️ Teclado virtual
- 📦 Lanzador de aplicaciones personalizado

## 🚀 Instalación Rápida

### Requisitos

1. **Python 3.x** - [Descargar](https://www.python.org/downloads/)
2. **Visual Studio Build Tools 2019/2022** - [Descargar](https://visualstudio.microsoft.com/downloads/)
3. **Node.js** - Ya instalado con Electron
4. *(Linux)* **Herramientas del sistema**
    - `ddcutil` + pertenecer a los grupos `i2c` y `video` para controlar brillo/contraste en monitores externos (DDC/CI).
    - `brightnessctl` *(opcional)* para paneles internos sin DDC/CI.
    - `xrandr` para sesiones X11 o `wlr-randr` para sesiones Wayland (Hyprland/Sway) a fin de cambiar modos de pantalla (`soloPc`, `duplicado`, etc.).
    - En Wayland (KDE Plasma) instala `kscreen` (incluye `kscreen-doctor`). Si `XDG_SESSION_TYPE=wayland` y `XDG_CURRENT_DESKTOP` contiene `KDE`/`plasma`, la app usará automáticamente este backend para controlar los modos.

### Instalación

```powershell
# Clonar/descargar el proyecto
cd "d:\Documents\2. Proyectos\finish\EJS-remoteControllers\DesktopApp"

# Instalar dependencias principales
npm install

# Compilar módulo nativo de mouse
cd modules
npm install
cd ..

# Compilar SASS (si haces cambios)
npm install -g sass
sass static/sass/index.view.scss static/css/index.view.css
```

### Arch Linux (KDE Plasma)

```bash
# Dependencias de compilación + runtime Linux/KDE
sudo pacman -S --needed base-devel python make gcc pkgconf libx11 libxtst libxext \
    xorg-xrandr kscreen ddcutil brightnessctl pipewire wireplumber

# Permisos para ddcutil (reinicia sesión después de esto)
sudo gpasswd -a "$USER" i2c
sudo gpasswd -a "$USER" video

# Instalar dependencias y compilar nativos para Electron
npm install
npm run build:native

# Compilar estilos
npm run build:sass

# Ejecutar
npm start
```

Empaquetado para Linux (estable):

```bash
npm run dist:linux
```

Empaquetado pacman (opcional para Arch):

```bash
sudo pacman -S --needed libxcrypt-compat
npm run dist:linux:pacman
```

### Ejecutar

```powershell
npm start
```

## 📱 Uso desde el Móvil

### 1. Conectar

- Asegúrate de estar en la misma red WiFi que tu PC
- Abre el navegador del móvil
- Ve a: `http://[IP-DE-TU-PC]:4800` (modo HTTP)
- Ejemplo: `http://192.168.1.100:4800`
- Para micrófono/voz usa HTTPS local: `https://[IP-DE-TU-PC]:5443`
- Si tienes certificados en `certs/server.key` y `certs/server.crt`, la app levanta HTTP+HTTPS automáticamente.

### HTTPS local (recomendado para dictado por voz)

1. Genera certificados locales (ejemplo con `mkcert`):

```powershell
mkcert -install
mkcert -key-file certs/server.key -cert-file certs/server.crt localhost 127.0.0.1 ::1 192.168.1.100
```

1. Reemplaza `192.168.1.100` por la IP local real del PC.
1. Reinicia la app con `npm start`.
1. En el móvil abre `https://TU_IP:5443`.

Notas:

- Si no existen los certificados, solo se habilita HTTP.
- Puedes cambiar rutas/puertos con `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH`, `HTTP_PORT`, `HTTPS_PORT`.

### 2. Touchpad Virtual

#### Abrir el touchpad

- Toca el botón del **cursor** (🖱️) en la esquina inferior derecha

#### Controles

- **Desliza** en el área gris → Mueve el cursor (movimiento relativo)
- **Doble tap** → Doble click
- **Botón L** → Click izquierdo
- **Botón R** → Click derecho  
- **Botón S** → Activa modo scroll (desliza arriba/abajo)

#### Ajustar sensibilidad

Abre la consola del navegador móvil (DevTools) y escribe:

```javascript
// Velocidad del cursor (default: 2.5)
touchpadController.setSensitivity(3.0);

// Velocidad del scroll (default: 1.0)
touchpadController.setScrollSensitivity(1.5);
```

## 🎮 Características del Touchpad

### Movimiento Relativo

- ✅ Funciona como un **touchpad de portátil**
- ✅ No se mueve a una posición absoluta
- ✅ Se mueve **desde donde está** el cursor
- ✅ Suave y preciso

### Tecnología

- **Módulo Nativo C++** usando Windows API (SendInput)
- **Latencia < 5ms**
- **60 FPS** de respuesta
- **Throttling inteligente** para no saturar la red
- **Fallback automático** a robotjs si el módulo nativo falla

## 🛠️ Estructura del Proyecto

```
DesktopApp/
├── modules/                      # Módulo nativo C++
│   ├── mouse-controller.cc      # Código C++ del controlador
│   ├── binding.gyp              # Configuración de compilación
│   ├── package.json             # Dependencias del módulo
│   └── index.js                 # Wrapper JavaScript
│
├── static/
│   ├── js/
│   │   ├── fx-mouse.js          # Lógica del touchpad
│   │   ├── fx.js                # Funciones generales
│   │   ├── index.js             # Lógica principal
│   │   └── controller_app.js    # Control de apps
│   │
│   ├── sass/
│   │   ├── _touchpad.scss       # Estilos del touchpad ⭐
│   │   ├── _const.scss          # Variables
│   │   └── index.view.scss      # Estilos principales
│   │
│   └── css/
│       └── index.view.css       # CSS compilado
│
├── views/
│   └── index.html               # Interfaz principal
│
├── app.js                       # Servidor Express + Electron
├── package.json                 # Dependencias del proyecto
├── INSTALL.md                   # Guía de instalación completa
└── README.md                    # Este archivo
```

## 🔧 Desarrollo

### Compilar SASS en tiempo real

```powershell
sass static/sass/index.view.scss static/css/index.view.css --watch
```

### Recompilar módulo nativo

```powershell
cd modules
npm run rebuild
```

### Rebuild para Electron

```powershell
cd modules
npm install electron-rebuild --save-dev
npx electron-rebuild
```

## 📡 API REST

### Endpoints del Mouse

#### Mover (Relativo)

```
POST /mouse/move
Body: { "dx": number, "dy": number }
```

#### Click

```
POST /mouse/click
Body: { "button": "left" | "right" | "middle" }
```

#### Doble Click

```
POST /mouse/doubleclick
```

#### Scroll

```
POST /mouse/scroll
Body: { "delta": number }
```

#### Obtener Posición

```
GET /mouse/position
Response: { "position": { "x": number, "y": number } }
```

#### Mouse Down/Up

```
POST /mouse/down
POST /mouse/up
Body: { "button": "left" | "right" | "middle" }
```

### Otros Endpoints

- `POST /brillo` - Ajustar brillo
- `POST /contraste` - Ajustar contraste  
- `POST /volumen` - Ajustar volumen
- `GET /soloPc` - Solo pantalla principal
- `GET /duplicado` - Duplicar pantallas
- `GET /extender` - Extender pantallas
- `GET /apagar` - Apagar PC
- `GET /reiniciar` - Reiniciar PC
- `GET /suspender` - Suspender PC

## 🎨 Personalización

### Cambiar colores del touchpad

Edita `static/sass/_touchpad.scss`:

```scss
.container-touchpad {
    background: linear-gradient(135deg, #TU_COLOR_1 0%, #TU_COLOR_2 100%);
}
```

Luego compila:

```powershell
sass static/sass/index.view.scss static/css/index.view.css
```

### Ajustar tamaño del touchpad

```scss
.touchpad-area {
    height: 350px; // Cambiar altura
}
```

## 🐛 Solución de Problemas

### El módulo nativo no carga

✅ La app usará **robotjs** como fallback automáticamente
✅ Funcionalidad al 90%, solo un poco más de latencia

### Error al compilar el módulo

```powershell
cd modules
npm run clean
npm install
```

### El touchpad no responde

1. Verifica que estés en la misma red
2. Revisa la consola del navegador (F12)
3. Prueba con el mouse en desktop para descartar problemas de red

### El cursor va muy rápido/lento

Ajusta la sensibilidad en la consola del navegador:

```javascript
touchpadController.setSensitivity(2.0); // Más lento
touchpadController.setSensitivity(4.0); // Más rápido
```

## 📊 Comparación: Módulo Nativo vs RobotJS

| Característica | Módulo Nativo C++ | RobotJS |
|----------------|-------------------|---------|
| Velocidad | ⚡ ~10x más rápido | 🐌 Lento |
| Latencia | ✅ < 5ms | ⚠️ ~50ms |
| Movimiento relativo | ✅ Nativo | ⚠️ Simulado |
| Suavidad | ✅ Perfecta | ⚠️ Con saltos |
| Precisión | ✅ Exacta | ✅ Buena |
| Compilación | ⚠️ Requiere Build Tools | ✅ Pre-compilado |

## 🎯 Ventajas del Movimiento Relativo

### ¿Por qué movimiento relativo?

- ✅ Funciona como un **touchpad real**
- ✅ No necesitas tocar en la posición exacta
- ✅ Más **intuitivo** y natural
- ✅ Funciona en cualquier **resolución de pantalla**
- ✅ No hay problemas de **calibración**

### Vs. Movimiento Absoluto

| Relativo (Touchpad) | Absoluto (Touch Screen) |
|---------------------|-------------------------|
| ✅ Natural e intuitivo | ❌ Requiere mapeo exacto |
| ✅ Funciona en multi-monitor | ❌ Problemas con resoluciones |
| ✅ Preciso | ⚠️ Puede descalibrarse |
| ✅ No cansa el brazo | ❌ Necesitas estirar el brazo |

## 🌟 Próximas Mejoras

- [ ] Gestos multi-touch (pellizcar para zoom)
- [ ] Modo "dibujo" de alta precisión
- [ ] Perfiles de sensibilidad guardados
- [ ] Soporte para trackpad físico Bluetooth
- [ ] Módulos nativos para Linux y macOS
- [ ] Arrastrar y soltar (drag & drop)
- [ ] Click and hold automático

## 📄 Licencia

ISC - Copyright © 2024 BJRSOFTWARE

## 👨‍💻 Autor

**Damar Narváez Martínez**

---

## 🎉 ¡Disfruta tu control remoto

Si tienes preguntas o problemas, revisa `INSTALL.md` para una guía más detallada.

<!-- AUTO-RELEASE-NOTES:START -->
## Release Documentado Por Copilot

- Rama: main
- Commit: d23ae72ed69be6a05905bc867be86683dcb0ea98
- Mensaje principal: Merge pull request #5 from gummdoms/DamarN/dev

Actions Archvilinux
- Fecha: 2026-05-18 18:37 UTC

### Mejoras detectadas
- Merge pull request #5 from gummdoms/DamarN/dev (d23ae72)
- Actions Archvilinux (f743b1d)
- Merge pull request #4 from gummdoms/DamarN/dev (2adde8c)
- Actions fix (42f5129)
- Merge pull request #3 from gummdoms/DamarN/dev (f6e3126)
- Actions (6d83922)
- Merge pull request #2 from gummdoms/DamarN/dev (c2e383f)
- Actions (25487b1)
- Merge pull request #1 from gummdoms/DamarN/dev (4b50382)
- Actions (8e24c54)
- Actions (35072d2)
- compositor linux (a560094)
- Ajuste de control de cursor (a19aba1)
- Ajuste de autoinicio (34428a9)
- feat: mejorar diseño y funcionalidad de las secciones de URL en la interfaz (c6def8b)
- feat: enhance UI and functionality of the remote controller application (fd916a1)
- feat: mejorar gestión de certificados y actualizar service worker para recarga automática (90fee6a)
- feat: replace vcxproj with Makefile for mouse_controller build system (1b42291)
- Proyecto (2d80dd4)
- feat: Añadir gestión de certificados HTTPS con interfaz modal y generación automática (ec3afbc)

### Artefactos
- Windows: instalador NSIS (.exe)
- Linux: AppImage
- Arch Linux: .pkg.tar.zst
<!-- AUTO-RELEASE-NOTES:END -->
