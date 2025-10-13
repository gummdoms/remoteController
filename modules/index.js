// Wrapper para facilitar el uso del módulo nativo
try {
    const path = require('path');
    const mouseController = require('./build/Release/mouse_controller.node');

    module.exports = Object.assign({}, mouseController, {
        alertExecutable: path.join(__dirname, 'build', 'Release', 'alert_controller.exe')
    });
} catch (e) {
    console.error('Error al cargar el módulo nativo de mouse:', e.message);
    console.error('Ejecute: cd modules && npm install');
    throw e;
}
