# 🔧 Documentación Técnica - Mouse Controller Native

## 📐 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    MÓVIL (Cliente)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Interfaz HTML/CSS/JavaScript             │  │
│  │  • TouchpadController (fx-mouse.js)              │  │
│  │  • Captura touch events                          │  │
│  │  • Calcula delta X, Y                            │  │
│  └───────────────────┬──────────────────────────────┘  │
└────────────────────┼──────────────────────────────────┘
                      │ HTTP POST (JSON)
                      │ { dx: 10, dy: 5 }
                      ↓
┌─────────────────────────────────────────────────────────┐
│              ELECTRON APP (Servidor)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Express Server (app.js)                  │  │
│  │  • Endpoints REST                                │  │
│  │  • Middleware de validación                      │  │
│  │  • Throttling de requests                        │  │
│  └───────────────────┬──────────────────────────────┘  │
│                      │ require('./modules')             │
│                      ↓                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Módulo Nativo C++ (mouse_controller.node)   │  │
│  │  • moveRelative(dx, dy)                          │  │
│  │  • click(button)                                 │  │
│  │  • scroll(delta)                                 │  │
│  │  • getPosition()                                 │  │
│  └───────────────────┬──────────────────────────────┘  │
└────────────────────┼──────────────────────────────────┘
                      │ N-API Bridge
                      ↓
┌─────────────────────────────────────────────────────────┐
│                  WINDOWS API                            │
│  • SendInput() - User32.dll                             │
│  • GetCursorPos() - User32.dll                          │
│  • INPUT structure                                      │
│  • MOUSEEVENTF_MOVE (movimiento relativo)               │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Componentes Principales

### 1. **TouchpadController** (JavaScript - Cliente)

**Archivo:** `static/js/fx-mouse.js`

**Responsabilidades:**

- Capturar eventos táctiles (touch events)
- Calcular movimiento relativo (delta X, Y)
- Throttling de eventos (60fps)
- Enviar comandos al servidor vía fetch()

**Algoritmo de movimiento:**

```javascript
// 1. Capturar posición inicial
touchstart: (x1, y1)

// 2. Calcular delta mientras se mueve
touchmove: 
    deltaX = x2 - x1
    deltaY = y2 - y1
    
// 3. Aplicar sensibilidad
    dx = deltaX * sensitivity (default: 2.5)
    dy = deltaY * sensitivity
    
// 4. Actualizar última posición
    x1 = x2
    y1 = y2
    
// 5. Enviar al servidor
    POST /mouse/move { dx, dy }
```

**Configuración:**

- `sensitivity`: Multiplicador de velocidad (1.0 - 5.0)
- `throttleDelay`: Milisegundos entre envíos (default: 16ms)
- `isScrollMode`: Activar modo scroll

---

### 2. **Express Server** (Node.js - Servidor)

**Archivo:** `app.js`

**Endpoints implementados:**

| Endpoint | Método | Parámetros | Descripción |
|----------|--------|------------|-------------|
| `/mouse/move` | POST | `{dx, dy}` | Movimiento relativo |
| `/mouse/click` | POST | `{button}` | Click (left/right/middle) |
| `/mouse/doubleclick` | POST | - | Doble click |
| `/mouse/scroll` | POST | `{delta}` | Scroll vertical |
| `/mouse/position` | GET | - | Posición actual |
| `/mouse/down` | POST | `{button}` | Presionar botón |
| `/mouse/up` | POST | `{button}` | Soltar botón |

**Validación:**

```javascript
// Ejemplo de validación
if (typeof dx !== 'number' || typeof dy !== 'number') {
    return res.status(400).send({ error: 'dx y dy deben ser números' });
}
```

**Fallback automático:**

```javascript
if (mouseController) {
    // Usar módulo nativo (preferido)
    mouseController.moveRelative(dx, dy);
} else {
    // Fallback a robotjs
    const pos = robot.getMousePos();
    robot.moveMouse(pos.x + dx, pos.y + dy);
}
```

---

### 3. **Módulo Nativo C++**

**Archivo:** `modules/mouse-controller.cc`

#### Estructura INPUT (Windows API)

```cpp
typedef struct tagINPUT {
    DWORD type;           // INPUT_MOUSE = 0
    union {
        MOUSEINPUT mi;
        KEYBDINPUT ki;
        HARDWAREINPUT hi;
    };
} INPUT;

typedef struct tagMOUSEINPUT {
    LONG dx;              // Delta X (movimiento horizontal)
    LONG dy;              // Delta Y (movimiento vertical)
    DWORD mouseData;      // Datos adicionales (ej: scroll)
    DWORD dwFlags;        // Flags de operación
    DWORD time;           // Timestamp (0 = automático)
    ULONG_PTR dwExtraInfo;
} MOUSEINPUT;
```

#### Flags importantes

```cpp
// Movimiento
MOUSEEVENTF_MOVE       = 0x0001  // Movimiento relativo
MOUSEEVENTF_ABSOLUTE   = 0x8000  // Movimiento absoluto

// Clicks
MOUSEEVENTF_LEFTDOWN   = 0x0002
MOUSEEVENTF_LEFTUP     = 0x0004
MOUSEEVENTF_RIGHTDOWN  = 0x0008
MOUSEEVENTF_RIGHTUP    = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP   = 0x0040

// Scroll
MOUSEEVENTF_WHEEL      = 0x0800  // Scroll vertical
MOUSEEVENTF_HWHEEL     = 0x1000  // Scroll horizontal
```

#### Función principal: MoveMouseRelative

```cpp
Napi::Value MoveMouseRelative(const Napi::CallbackInfo& info) {
    // 1. Validar argumentos
    if (!info[0].IsNumber() || !info[1].IsNumber()) {
        throw TypeError("Argumentos deben ser números");
    }
    
    // 2. Obtener deltas
    int dx = info[0].As<Napi::Number>().Int32Value();
    int dy = info[1].As<Napi::Number>().Int32Value();
    
    // 3. Crear estructura INPUT
    INPUT input = {0};
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE; // ⭐ RELATIVO
    
    // 4. Enviar evento
    UINT result = SendInput(1, &input, sizeof(INPUT));
    
    // 5. Verificar resultado
    return Napi::Boolean::New(env, result > 0);
}
```

#### Ventajas de SendInput()

- ✅ **Más rápido** que otras APIs
- ✅ **No bloqueante** (no interfiere con eventos del usuario)
- ✅ **Eventos reales** del sistema (indistinguibles de hardware)
- ✅ **Thread-safe**
- ✅ **Soporta UIPI** (User Interface Privilege Isolation)

---

## 🔬 Análisis de Rendimiento

### Latencia típica

```
Touch Event Captured (móvil)
    ↓ < 1ms
JavaScript calcula delta
    ↓ < 1ms
fetch() envía request
    ↓ ~10-30ms (WiFi)
Express recibe request
    ↓ < 1ms
Llama módulo nativo
    ↓ < 1ms
SendInput() ejecuta
    ↓ < 2ms
Cursor se mueve
    ↓
TOTAL: ~15-35ms
```

### Comparación con RobotJS

| Operación | Módulo Nativo | RobotJS | Diferencia |
|-----------|---------------|---------|------------|
| moveRelative() | ~0.5ms | ~5ms | **10x más rápido** |
| click() | ~0.3ms | ~3ms | **10x más rápido** |
| getPosition() | ~0.1ms | ~1ms | **10x más rápido** |
| scroll() | ~0.4ms | ~4ms | **10x más rápido** |

### Throughput

```
Módulo Nativo:
- ~2000 operaciones/segundo
- Sin lag perceptible

RobotJS:
- ~200 operaciones/segundo
- Lag visible en movimientos rápidos
```

---

## 🛠️ Compilación

### Requisitos del compilador

1. **Python 3.x** (para node-gyp)
2. **Visual Studio Build Tools 2019/2022**
   - Desktop development with C++
   - Windows SDK 10

### Proceso de compilación

```bash
# 1. node-gyp configure
#    - Genera archivos .vcxproj (Visual Studio)
#    - Detecta Python y MSVC
#    - Configura rutas de includes

# 2. node-gyp build
#    - Compila mouse-controller.cc
#    - Enlaza con node.lib
#    - Genera mouse_controller.node

# Salida:
#   modules/build/Release/mouse_controller.node
```

### Estructura binding.gyp

```json
{
  "targets": [{
    "target_name": "mouse_controller",
    "sources": ["mouse-controller.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
  }]
}
```

### Dependencias enlazadas automáticamente

- `User32.lib` - SendInput(), GetCursorPos()
- `Kernel32.lib` - Funciones del sistema
- `node.lib` - API de Node.js

---

## 🔒 Seguridad

### UIPI (User Interface Privilege Isolation)

Windows Vista+ implementa UIPI para prevenir ataques:

```
Proceso de menor privilegio → NO puede → Proceso de mayor privilegio
```

**Implicación:**

- El módulo puede controlar ventanas del mismo nivel o inferior
- NO puede controlar ventanas de administrador si la app no es admin
- Solución: Ejecutar la app con privilegios de administrador

### Mitigación de inyección

El servidor valida todos los inputs:

```javascript
// Validación de tipos
if (typeof dx !== 'number' || typeof dy !== 'number') {
    return res.status(400);
}

// Limitar rango (opcional)
if (Math.abs(dx) > 1000 || Math.abs(dy) > 1000) {
    return res.status(400);
}
```

---

## 🧪 Testing

### Probar el módulo nativo

```powershell
# Test básico
node modules/examples.js

# Test manual
node -e "const m = require('./modules'); m.moveRelative(100, 100);"
```

### Debugging

```cpp
// En mouse-controller.cc
#include <iostream>

std::cout << "dx=" << dx << " dy=" << dy << std::endl;
```

Recompilar:

```bash
cd modules
npm run rebuild
```

---

## 📊 Optimizaciones Implementadas

### 1. Throttling (Cliente)

```javascript
// Limitar envíos a 60fps
const throttleDelay = 16; // ms
if (now - lastSendTime < throttleDelay) return;
```

### 2. Batching (Futuro)

```javascript
// Acumular deltas y enviar en batch
const batch = [];
batch.push({ dx, dy });
if (batch.length >= 10) {
    fetch('/mouse/moveBatch', { body: JSON.stringify(batch) });
}
```

### 3. Predicción (Futuro)

```javascript
// Predecir movimiento y aplicar client-side
const predicted = calculateTrajectory(velocity, time);
applyPredictedMovement(predicted);
```

---

## 🐛 Errores Comunes

### Error: "node-gyp not found"

```bash
npm install -g node-gyp
```

### Error: "MSBuild not found"

- Instalar Visual Studio Build Tools
- Reiniciar terminal

### Error: "Python not found"

```bash
npm config set python "C:\Python314\python.exe"
```

### El módulo no carga en Electron

```bash
cd modules
npm install electron-rebuild --save-dev
npx electron-rebuild
```

---

## 📚 Referencias

### Windows API

- [SendInput()](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
- [INPUT structure](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-input)
- [Mouse Input](https://learn.microsoft.com/en-us/windows/win32/inputdev/mouse-input)

### N-API

- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-api](https://github.com/nodejs/node-addon-api)

### node-gyp

- [GitHub](https://github.com/nodejs/node-gyp)
- [Documentation](https://github.com/nodejs/node-gyp/blob/main/README.md)

---

## 🐧 Backends de entrada en Linux (X11 y Wayland)

El módulo nativo `mouse_controller.node` elige el backend en tiempo de ejecución:

| Sesión | Backend | Detalle |
|--------|---------|---------|
| X11 | `XTest` (`libXtst`) | Inyección clásica sobre el servidor X. |
| Wayland (Hyprland, Sway, KDE, GNOME, COSMIC) | `uinput` | Crea un dispositivo virtual (`/dev/uinput`) y emite eventos `EV_REL` / `EV_KEY`. Funciona con cualquier compositor porque los eventos entran por el kernel. |
| Sin `DISPLAY` ni acceso a `/dev/uinput` | `none` | Se reporta error 503 en los endpoints de entrada. |

`nativeInput.getInputBackend()` devuelve:

```json
{ "backend": "uinput", "wayland": true, "uinputReady": true, "error": "" }
```

### Permisos necesarios para uinput

```bash
sudo groupadd -f uinput
sudo usermod -aG input,uinput,video "$USER"
echo uinput | sudo tee /etc/modules-load.d/uinput.conf
echo 'KERNEL=="uinput", MODE="0660", GROUP="uinput", OPTIONS+="static_node=uinput"' \
  | sudo tee /etc/udev/rules.d/99-uinput.rules
sudo modprobe uinput
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Después hay que cerrar sesión y volver a entrar para que los grupos se apliquen.
La app puede aplicar esto sola desde la interfaz (botón de corrección de permisos,
usa `pkexec`).

> XTest no sirve en Wayland: solo alcanza a ventanas XWayland. Por eso el
> módulo detecta `XDG_SESSION_TYPE=wayland` / `WAYLAND_DISPLAY` y se pasa a
> `uinput` automáticamente.

### Modos de pantalla por compositor

| Compositor | Backend | Comando |
|------------|---------|---------|
| Windows | `windows-backend` | `DisplaySwitch.exe` |
| KDE Plasma (Wayland) | `linux-kscreen` | `kscreen-doctor` |
| Hyprland | `linux-hyprland` | `hyprctl monitors -j` / `hyprctl keyword monitor` |
| Sway / wlroots | `linux-wlr-randr` | `wlr-randr` |
| X11 | `linux-xrandr` | `xrandr` |

---

## Dependencias del sistema en Linux

Módulo: `platform/dependencies/linux-deps.js`.

1. Detecta la distro leyendo `/etc/os-release` y el gestor disponible
   (`pacman`, `apt-get`, `dnf`, `zypper`, `apk`).
2. Agrupa las herramientas por **funcionalidad**, no por binario: por ejemplo
   `audio` acepta `wpctl` **o** `pactl`, y `display` elige el binario según la
   sesión (`hyprctl` → `kscreen-doctor` → `wlr-randr` → `xrandr`).
3. `installMissing()` genera un script temporal y lo ejecuta con
   `pkexec /bin/bash`, usando los nombres de paquete de cada distro.
4. El resultado se expone por IPC (`service:getDependencies`,
   `service:installDependencies`, `service:setAutoInstallDeps`) y la UI lo
   muestra en la tarjeta «Componentes del sistema».

En Arch el paquete **no necesita ese instalador** para las dependencias base:
van declaradas en `depends` y pacman las instala. El instalador cubre las
herramientas específicas del escritorio y el caso AppImage en otras distros.

El paquete pacman **desempaqueta el AppImage** en `prepare()` con
`--appimage-extract`, así que no depende de `fuse2` ni monta squashfs.

---

## Persistencia de sesión

La sesión cloud se guarda en `userData/auth-session.json` con permisos `0600`
y escritura atómica. Reglas de diseño:

1. **Nunca se cierra automáticamente.** Solo `logout()` (acción explícita del
   usuario) borra el archivo.
2. Si el token caduca se intenta renovar con `POST /api/auth/refresh`
   (refresh token). Si el servidor no expone ese endpoint, se conserva la
   sesión y se marca `expired: true` para que la interfaz pida re-login.
3. Los fallos de red (`status = 0` o `5xx`) marcan `offline: true` y se
   reintentan en el siguiente latido; nunca se borran credenciales.
4. `sessionManager.startKeepAlive()` ejecuta un latido cada 10 minutos
   (`SESSION_KEEPALIVE_MS`) que renueva el token y reconecta el agente cloud.
5. El WebSocket usa **backoff exponencial con jitter** y detección de
   conexiones zombis (`ping`/`pong` + marca de último mensaje). Si el servidor
   cierra con `4401`, `cloudAgent` llama a `sessionManager.handleUnauthorized()`,
   que renueva la sesión y vuelve a registrar el equipo sin pedir contraseña.

---

**Última actualización:** Octubre 2026  
**Versión del módulo:** 1.0.0  
**Autor:** Damar Narváez Martínez
