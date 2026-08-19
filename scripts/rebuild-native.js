#!/usr/bin/env node
// Reconstruye los módulos nativos contra la versión de Electron en uso.
//
// Windows: reconstruye todos los módulos nativos (robotjs, @hensm/ddcci, node-interception)
//          mediante electron-builder install-app-deps.
// Linux/macOS:
//   1. Elimina de node_modules los módulos exclusivos de Windows (@hensm/ddcci y
//      node-interception). Si se quedan instalados, electron-builder intenta compilarlos
//      durante el empaquetado (dist:linux) y rompe el build en Linux.
//   2. Reconstruye solo robotjs (los módulos de Windows se cargan bajo demanda con
//      require + try/catch, por lo que no deben compilarse en otras plataformas).
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');
const WIN_ONLY_MODULES = ['@hensm/ddcci', 'node-interception'];

function run(command) {
    console.log(`[rebuild-native] ${command}`);
    execSync(command, { stdio: 'inherit', shell: true });
}

try {
    if (isWindows) {
        run('electron-builder install-app-deps');
    } else {
        // 1) Eliminar módulos de Windows que npm pudo instalar como opcionales.
        for (const name of WIN_ONLY_MODULES) {
            const moduleDir = path.join(rootDir, 'node_modules', name);
            if (fs.existsSync(moduleDir)) {
                console.log(`[rebuild-native] Eliminando módulo de Windows "${name}" en ${process.platform}...`);
                fs.rmSync(moduleDir, { recursive: true, force: true });
            }
        }

        // 2) Reconstruir robotjs para la versión de Electron en uso.
        const robotjsDir = path.join(rootDir, 'node_modules', 'robotjs');
        if (fs.existsSync(robotjsDir)) {
            const electronRebuildBin = path.join(rootDir, 'node_modules', '.bin', 'electron-rebuild');
            if (fs.existsSync(electronRebuildBin)) {
                run(`"${electronRebuildBin}" -f -o robotjs`);
            } else {
                console.warn('[rebuild-native] @electron/rebuild no disponible; robotjs se usará con su binario de Node.js.');
            }
        } else {
            console.log('[rebuild-native] robotjs no instalado en esta plataforma; se omite el rebuild.');
        }
    }
} catch (error) {
    // Los módulos nativos son opcionales (fallback en runtime), por lo que un fallo
    // de reconstrucción no debe romper la instalación.
    console.warn('[rebuild-native] aviso: la reconstrucción de módulos nativos falló:', error.message);
}
