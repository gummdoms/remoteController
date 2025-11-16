1. Alcance – qué debe funcionar en ambas plataformas

Entrada (mouse/teclado/scroll/combinaciones): hoy depende del addon mouse-controller.cc. En Linux necesitamos el mismo set de funciones (moveRelative, click, keyDown, keyCombo, etc.) para que el resto del código no cambie.
Alertas visuales de apagado: actualmente es alert_controller.exe. Requiere un equivalente multiplataforma (idealmente una ventana Electron).
Comandos del sistema: /soloPc, /duplicado, /extender, /apagar, /reiniciar, /suspender, /cerrarSesion, /estadoPantalla, /leerDirectorio, control de brillo/contraste y audio; todos hoy son comandos o librerías específicas de Windows.
Empaquetado: electron-builder solo crea NSIS. Necesitas targets Linux (AppImage, pacman, etc.) asegurando que los nuevos binarios nativos se compilen en postinstall.
2. Arquitectura propuesta multiplataforma

Addon N-API único con #ifdef:

Mantén mouse-controller.cc como entrada principal, pero divídelo internamente en archivos por plataforma:
src/win/input_win.cpp (contenido actual).
src/linux/input_linux.cpp que implemente las mismas funciones usando uinput (para Wayland y X11) o XTest (solo X11).
En binding.gyp agrega condiciones OS=="linux" para compilar el archivo Linux, enlazar contra -ludev -lrt o -lXtst según ruta elegida, y mantener la configuración MSVC para Windows.
index.js debe detectar process.platform y exportar el addon; para Linux puede no tener alertExecutable, sino una bandera que indique que se usa la alerta Electron.
Abstracción de comandos del sistema (app.js):

Crea un módulo ./platform/systemActions.js que exponga funciones switchDisplay(mode), shutdown(type), suspend(), listDrives(), etc.
Implementa dos archivos: systemActions.win.js (actual shellouts) y systemActions.linux.js (usa systemctl poweroff|reboot|suspend, loginctl terminate-user, xrandr --output …, wlr-randr, o expone hooks para configurar). Usa exports = require('./systemActions.' + process.platform + '.js').
Para brillo/contraste, el lado Linux puede invocar ddcutil setvcp 10 <valor> o brightnessctl set <valor>%. Requiere documentar permisos (grupo i2c, video).
Audio: reemplaza win-audio con pactl/wpctl en Linux, manteniendo la interfaz setVolume/getVolume.
Alertas de apagado:

Sustituye alert_controller.exe por una ventana frameless en Electron (por ejemplo alert.html). El backend le envía IPC con el mensaje y duración. Windows puede seguir usando el EXE si prefieres, pero con el nuevo enfoque ambos OS comparten la misma vista y evitamos compilar dos binarios.
Si quieres retener el EXE en Windows por estética, conviértelo en una implementación opcional (nativeInput.alertExecutable solo si process.platform === 'win32').
Empaquetado y scripts:

En package.json, añade secciones linux (AppImage, pacman) y afterPack para copiar el addon compilado.
Agrega comandos npm run build:native:linux que ejecute npm install dentro de modules usando el toolchain correcto (node-gyp rebuild --arch=x64 --target=$(electron -v)).
Documenta dependencias del sistema (ej. sudo pacman -S base-devel libx11 libxtst libxkbcommon udev).
3. Plan de implementación detallado

Refactor del addon:

Crear carpetas modules/src/common, modules/src/win, modules/src/linux.
Extraer la lógica N-API compartida a src/common/addon.cpp que llama a funciones virtuales PlatformInput.
Escribir src/linux/input_linux.cpp (uinput recomendado para Wayland). Pasos: abrir uinput, crear dispositivo virtual, soportar EV_REL para moveRelative, EV_KEY para clicks y teclas, EV_SYN para sincronizar. Gestionar mapeo de teclas (usa linux/uinput.h keycodes).
Actualizar binding.gyp con conditions: para Linux añadir cflags_cc: -std=c++17, libraries: -ludev.
Probar con npx electron-rebuild en ambos OS.
Capa de abstracción en app.js:

Introducir const systemActions = require('./platform/systemActions');.
Reemplazar llamadas directas a exec('DisplaySwitch.exe …'), exec('shutdown …'), etc., por los métodos de systemActions.
Implementar platform/systemActions.win.js con el código actual.
Implementar platform/systemActions.linux.js usando comandos Linux (ej.: exec('systemctl poweroff'), exec('xrandr --output ' + monitor + ' --off')). Para monitor modes complejos, podrías usar librerías como node-xrandr o permitir scripts configurables.
Brillo/contraste y audio:

Crear platform/displayControl.win.js (usa @hensm/ddcci) y platform/displayControl.linux.js (invoca ddcutil o accede a /sys/class/backlight/*). Abstraer en un índice común.
Cambiar win-audio por un wrapper que usa loudness en Windows y pactl/wpctl en Linux pero con la misma interfaz.
Alerta multiplataforma:

Añadir alertWindow.js y alert.html al proyecto.
Cuando se programe un apagado, abrir esa ventana (o enviar IPC a una ventana existente) con los textos.
En Windows puedes conservar la opción de usar el EXE si nativeInput.alertExecutable está disponible, pero ya no es obligatorio.
Empaquetado y documentación:

Actualizar README.md con instrucciones específicas para Linux (dependencias del sistema, permisos para uinput, grupos uinput, video).
Extender package.json build con:
Añadir scripts postinstall en package.json para crear el dispositivo uinput si es necesario (o documentar un servicio systemd que lo habilite).
Pruebas:

En Windows: ejecutar npm run setup, validar que el addon sigue soportando todo.
En Garuda: instalar dependencias, ejecutar npm run setup, comprobar endpoints /mouse/*, /teclear, /apagar, /extender, etc., bajo X11 y Wayland si es posible.
