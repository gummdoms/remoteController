// Wrapper para facilitar el uso del módulo nativo
try {
    const mouseController = require('./build/Release/mouse_controller.node');
    module.exports = mouseController;
} catch (e) {
    console.error('Error al cargar el módulo nativo de mouse:', e.message);
    console.error('Ejecute: cd modules && npm install');
    throw e;
}
