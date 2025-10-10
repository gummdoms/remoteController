# Mouse Controller - Módulo Nativo

Módulo nativo C++ para control del mouse en Windows con movimiento relativo (tipo touchpad).

## Instalación

```bash
cd modules
npm install
```

## Requisitos

- Node.js (compatible con Electron)
- Python 3.x
- Visual Studio Build Tools (o Visual Studio con C++)
- Windows SDK

## Funciones disponibles

### `moveRelative(dx, dy)`

Mueve el mouse de manera relativa (como touchpad).

- `dx`: Delta X (movimiento horizontal)
- `dy`: Delta Y (movimiento vertical)

### `getPosition()`

Obtiene la posición actual del mouse.
Retorna: `{ x: number, y: number }`

### `click(button)`

Realiza un click.

- `button`: 'left' | 'right' | 'middle' (default: 'left')

### `doubleClick()`

Realiza doble click izquierdo.

### `scroll(delta)`

Realiza scroll.

- `delta`: Cantidad de scroll (positivo: arriba, negativo: abajo)

### `mouseDown(button)`

Mantiene presionado un botón.

### `mouseUp(button)`

Suelta un botón.

## Ejemplo de uso

```javascript
const mouse = require('./modules');

// Mover el mouse 10px a la derecha y 5px abajo (relativo)
mouse.moveRelative(10, 5);

// Click izquierdo
mouse.click('left');

// Obtener posición
const pos = mouse.getPosition();
console.log(`Mouse en: ${pos.x}, ${pos.y}`);

// Scroll
mouse.scroll(120); // Scroll arriba
```

## Compilar manualmente

```bash
node-gyp configure
node-gyp build
```
