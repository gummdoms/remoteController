// =====================================================
// EJEMPLOS DE USO DEL MÓDULO NATIVO DE MOUSE
// =====================================================

const mouseController = require('./modules');

console.log('🖱️ Ejemplos de uso del Mouse Controller\n');

// ===== EJEMPLO 1: Movimiento Relativo =====
console.log('1️⃣ Movimiento Relativo (como touchpad):');
console.log('   Mueve el mouse 100px a la derecha y 50px abajo desde donde está\n');

mouseController.moveRelative(100, 50);
setTimeout(() => {
    mouseController.moveRelative(-100, -50); // Volver atrás
}, 1000);

// ===== EJEMPLO 2: Obtener Posición =====
setTimeout(() => {
    console.log('2️⃣ Obtener Posición Actual:');
    const pos = mouseController.getPosition();
    console.log(`   Posición: x=${pos.x}, y=${pos.y}\n`);
}, 1500);

// ===== EJEMPLO 3: Click =====
setTimeout(() => {
    console.log('3️⃣ Realizar Click:');
    console.log('   Click izquierdo en la posición actual\n');
    mouseController.click('left');
}, 2000);

// ===== EJEMPLO 4: Doble Click =====
setTimeout(() => {
    console.log('4️⃣ Doble Click:');
    console.log('   Doble click en la posición actual\n');
    mouseController.doubleClick();
}, 2500);

// ===== EJEMPLO 5: Click Derecho =====
setTimeout(() => {
    console.log('5️⃣ Click Derecho:');
    console.log('   Click derecho (menú contextual)\n');
    mouseController.click('right');
}, 3000);

// ===== EJEMPLO 6: Scroll =====
setTimeout(() => {
    console.log('6️⃣ Scroll:');
    console.log('   Scroll hacia arriba (120 unidades)\n');
    mouseController.scroll(120);
}, 3500);

setTimeout(() => {
    console.log('   Scroll hacia abajo (-120 unidades)\n');
    mouseController.scroll(-120);
}, 4000);

// ===== EJEMPLO 7: Drag & Drop Simulado =====
setTimeout(() => {
    console.log('7️⃣ Drag & Drop (Simulado):');
    console.log('   Presionar botón izquierdo, mover, y soltar\n');

    // Presionar
    mouseController.mouseDown('left');

    // Mover mientras está presionado
    setTimeout(() => {
        mouseController.moveRelative(100, 0);
    }, 100);

    // Soltar
    setTimeout(() => {
        mouseController.mouseUp('left');
    }, 200);
}, 4500);

// ===== EJEMPLO 8: Movimiento Suave (Simulado) =====
setTimeout(() => {
    console.log('8️⃣ Movimiento Suave:');
    console.log('   Mover el cursor suavemente en un círculo\n');

    const steps = 20;
    const radius = 50;

    for (let i = 0; i < steps; i++) {
        setTimeout(() => {
            const angle = (i / steps) * 2 * Math.PI;
            const dx = Math.cos(angle) * radius / steps * 2;
            const dy = Math.sin(angle) * radius / steps * 2;
            mouseController.moveRelative(Math.round(dx), Math.round(dy));
        }, i * 50);
    }
}, 5500);

// ===== EJEMPLO 9: Simulación de Touchpad =====
setTimeout(() => {
    console.log('9️⃣ Simulación de Touchpad:');
    console.log('   Simulando deslizamientos rápidos\n');

    // Deslizar a la derecha
    mouseController.moveRelative(200, 0);

    setTimeout(() => {
        // Deslizar hacia arriba
        mouseController.moveRelative(0, -200);
    }, 300);

    setTimeout(() => {
        // Deslizar a la izquierda
        mouseController.moveRelative(-200, 0);
    }, 600);

    setTimeout(() => {
        // Deslizar hacia abajo
        mouseController.moveRelative(0, 200);
    }, 900);
}, 7000);

// ===== EJEMPLO 10: API REST Simulation =====
setTimeout(() => {
    console.log('🔟 Ejemplo de uso vía API REST:');
    console.log('   Así es como el servidor Express llama al módulo:\n');
    console.log(`
    // En app.js:
    server.post('/mouse/move', (req, res) => {
        const { dx, dy } = req.body;
        mouseController.moveRelative(dx, dy);
        res.send({ status: 'ok' });
    });
    
    // Desde el móvil (JavaScript):
    fetch('http://192.168.1.100:4800/mouse/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dx: 10, dy: 5 })
    });
    `);
}, 8500);

// Finalizar
setTimeout(() => {
    console.log('\n✅ Ejemplos completados!\n');
    console.log('Notas:');
    console.log('  - Todas las funciones son síncronas y muy rápidas');
    console.log('  - El movimiento es relativo, no absoluto');
    console.log('  - Usa SendInput() de Windows API para eventos reales');
    console.log('  - Latencia < 5ms en la mayoría de los casos\n');

    process.exit(0);
}, 10000);

// =====================================================
// TIPS Y MEJORES PRÁCTICAS
// =====================================================

/*

1. MOVIMIENTO RELATIVO:
   - Usa moveRelative() para movimientos tipo touchpad
   - Los valores dx/dy son en píxeles
   - Valores grandes = movimiento rápido
   - Valores pequeños = movimiento preciso

2. THROTTLING:
   - En aplicaciones de red, limita las llamadas
   - Usa un delay de ~16ms entre movimientos (60fps)
   - El módulo es rápido, pero la red puede saturarse

3. SENSIBILIDAD:
   - Multiplica dx/dy por un factor de sensibilidad
   - Ejemplo: sensitivity * dx
   - Valor recomendado: 2.0 - 4.0

4. SCROLL:
   - Valores positivos = scroll arriba
   - Valores negativos = scroll abajo
   - Un "tick" de scroll = 120 unidades
   - Para scroll suave, usa valores pequeños (30-60)

5. CLICKS:
   - click() hace down + up automáticamente
   - Para drag & drop, usa mouseDown() y mouseUp()
   - doubleClick() es más preciso que 2 clicks manuales

6. RENDIMIENTO:
   - El módulo es extremadamente rápido
   - Todas las funciones son síncronas
   - No bloquea el event loop de Node.js
   - Usa SendInput() que es la API más rápida de Windows

7. COMPATIBILIDAD:
   - Solo Windows (usa Windows API)
   - Compatible con Electron
   - Compatible con Node.js 12+
   - Requiere compilación con node-gyp

8. DEBUGGING:
   - Usa getPosition() para verificar movimientos
   - Los eventos son reales del sistema operativo
   - Los programas ven los eventos como si fueran del usuario

*/
