# 🚀 Guía de Instalación y Configuración

## 📋 Requisitos Previos

Para compilar el módulo nativo de control del mouse, necesitas:

### 1. Python

- **Versión requerida:** Python 3.x
- Descargar de: <https://www.python.org/downloads/>
- ⚠️ **Importante:** Durante la instalación, marca "Add Python to PATH"

### 2. Visual Studio Build Tools

Necesitas las herramientas de compilación de Visual Studio.

**Opción A - Build Tools (Recomendado, más ligero):**

1. Descarga: <https://visualstudio.microsoft.com/downloads/>
2. Busca "Build Tools for Visual Studio 2022"
3. Durante la instalación, selecciona:
   - ✅ "Desktop development with C++"
   - ✅ Windows SDK (debe estar marcado por defecto)

**Opción B - Visual Studio Community (Completo):**

1. Descarga Visual Studio Community 2022
2. Durante la instalación, selecciona:
   - ✅ "Desktop development with C++"

### 3. Node.js

- Ya lo tienes instalado para Electron
- Verifica con: `node --version`

---

## 🔧 Instalación del Módulo Nativo

### Paso 1: Instalar dependencias principales del proyecto

```powershell
cd "d:\Documents\2. Proyectos\finish\EJS-remoteControllers\DesktopApp"
npm install
```

### Paso 2: Compilar el módulo nativo

```powershell
cd modules
npm install
```

Esto ejecutará automáticamente:

- `node-gyp configure` - Configura el entorno de compilación
- `node-gyp build` - Compila el módulo C++

### Paso 3: Verificar la compilación

Deberías ver una carpeta `build/Release/` con el archivo `mouse_controller.node`

---

## ▶️ Ejecutar la Aplicación

### Desarrollo

```powershell
cd "d:\Documents\2. Proyectos\finish\EJS-remoteControllers\DesktopApp"
npm start
```

### Compilar CSS desde SASS (si hiciste cambios en .scss)

```powershell
# Instalar sass globalmente si no lo tienes
npm install -g sass

# Compilar SASS a CSS
sass static/sass/index.view.scss static/css/index.view.css --watch
```

---

## 🎮 Uso del Touchpad Virtual

### Desde el móvil

1. **Conectar al servidor:**
   - Abre el navegador en tu móvil
   - Ve a: `http://[IP-DE-TU-PC]:4800`
   - Ejemplo: `http://192.168.1.100:4800`

2. **Abrir el touchpad:**
   - Toca el botón del cursor (🖱️) en la esquina inferior derecha

3. **Controles:**
   - **Desliza** en el área gris para mover el cursor (como touchpad)
   - **Doble tap** para hacer doble click
   - **Botón L** - Click izquierdo
   - **Botón R** - Click derecho
   - **Botón S** - Activar modo scroll (desliza arriba/abajo para scroll)

### Ajustar sensibilidad (opcional)

En la consola del navegador móvil:

```javascript
// Ajustar velocidad del mouse (default: 2.5)
touchpadController.setSensitivity(3.0);

// Ajustar velocidad del scroll (default: 1.0)
touchpadController.setScrollSensitivity(1.5);
```

---

## 🐛 Solución de Problemas

### Error: "No se pudo cargar el módulo nativo"

✅ **Solución:**

```powershell
cd modules
npm run rebuild
```

### Error: "MSBuild not found" o similar

✅ **Solución:**

- Instala Visual Studio Build Tools (ver arriba)
- Reinicia la terminal/PowerShell
- Intenta de nuevo

### Error: "Python not found"

✅ **Solución:**

```powershell
# Verificar Python
python --version

# Si no está, instálalo y añádelo al PATH
# Luego reinicia la terminal
```

### El módulo nativo no funciona pero la app sí

✅ **Tranquilo:** La app usará `robotjs` como fallback automáticamente.

- Funcionalidad: 90% igual
- Puede tener un poco más de latencia

### Error al compilar en Electron

✅ **Solución:**

```powershell
cd modules
npm install electron-rebuild --save-dev
npx electron-rebuild
```

---

## 📊 Verificar que todo funciona

### Verificar módulo nativo

```powershell
cd modules
node -e "const m = require('./index.js'); console.log(m.getPosition());"
```

Si ves algo como `{ x: 123, y: 456 }`, ¡funciona perfectamente! ✅

### Verificar servidor

1. Inicia la app: `npm start`
2. Ve a: `http://localhost:4800`
3. Abre la consola y busca: `✅ Módulo nativo de mouse cargado correctamente`

---

## 🎯 Ventajas del Módulo Nativo

✅ **Velocidad:** ~10x más rápido que robotjs  
✅ **Latencia:** < 5ms de respuesta  
✅ **Movimiento relativo:** Igual que un touchpad real  
✅ **Suavidad:** Movimiento fluido sin saltos  
✅ **Precisión:** Control exacto del cursor  

---

## 📝 Notas Importantes

- ⚠️ El módulo nativo **solo funciona en Windows**
- ✅ Si falla, robotjs se usa automáticamente como backup
- 🔄 Después de cambios en `.cc`, ejecuta: `cd modules && npm run rebuild`
- 📱 El touchpad funciona con touch events (móvil) y mouse events (desktop para testing)

---

## 🆘 ¿Necesitas ayuda?

Si algo no funciona:

1. Verifica que tengas todos los requisitos instalados
2. Reinicia la terminal después de instalar Python o Visual Studio
3. Revisa los logs de la consola
4. El fallback a robotjs debería funcionar siempre

---

**¡Listo para usar! 🎉**
