#!/usr/bin/env node
// Reconstruye los módulos nativos contra la versión de Electron en uso.
//
// Windows: reconstruye todos los módulos nativos (robotjs, @hensm/ddcci, node-interception)
//          mediante electron-builder install-app-deps.
// Linux/macOS: solo robotjs. @hensm/ddcci y node-interception son exclusivos de Windows
//          (API HighLevelMonitorConfiguration de Windows / driver Interception) y se cargan
//          bajo demanda con require + try/catch; intentar compilarlos en Linux rompe el build.
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';

function run(command) {
    console.log(`[rebuild-native] ${command}`);
    execSync(command, { stdio: 'inherit', shell: true });
}

try {
    if (isWindows) {
        run('electron-builder install-app-deps');
    } else {
        const robotjsDir = path.join(__dirname, '..', 'node_modules', 'robotjs');
        if (fs.existsSync(robotjsDir)) {
            run('electron-rebuild -f -o robotjs');
        } else {
            console.log('[rebuild-native] robotjs no instalado en esta plataforma; se omite el rebuild.');
        }
    }
} catch (error) {
    // Los módulos nativos son opcionales (fallback en runtime), por lo que un fallo
    // de reconstrucción no debe romper la instalación.
    console.warn('[rebuild-native] aviso: la reconstrucción de módulos nativos falló:', error.message);
}
