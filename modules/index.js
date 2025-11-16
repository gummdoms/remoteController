// Wrapper para facilitar el uso del módulo nativo
try {
    const path = require('path');
    const mouseController = require('./build/Release/mouse_controller.node');
    const isWindows = process.platform === 'win32';

    const exportsMap = { ...mouseController };
    if (isWindows) {
        exportsMap.alertExecutable = path.join(__dirname, 'build', 'Release', 'alert_controller.exe');
    }

    module.exports = exportsMap;
} catch (e) {
    console.error('Error al cargar el módulo nativo de mouse:', e.message);
    console.error('Ejecute: cd modules && npm install');
    throw e;
}
