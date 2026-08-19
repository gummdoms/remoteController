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

function run(command, env) {
    console.log(`[rebuild-native] ${command}`);
    execSync(command, { stdio: 'inherit', shell: true, cwd: rootDir, env: env || process.env });
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
        //    robotjs 0.6.0 falla con glibc moderna (strdup no se declara sin _GNU_SOURCE)
        //    y node-gyp ignora CFLAGS del entorno; se parchea su binding.gyp.
        let robotjsDir = path.join(rootDir, 'node_modules', 'robotjs');
        if (!fs.existsSync(robotjsDir)) {
            console.log('[rebuild-native] robotjs no instalado; instalándolo sin scripts para poder reconstruirlo...');
            try {
                run('npm install --no-save --ignore-scripts robotjs@0.6.0');
                robotjsDir = path.join(rootDir, 'node_modules', 'robotjs');
            } catch (error) {
                console.warn('[rebuild-native] no se pudo instalar robotjs:', error.message);
            }
        }

        if (fs.existsSync(robotjsDir)) {
            // Parche: robotjs/src/xdisplay.c usa strdup() sin incluir <string.h>,
            // lo que rompe la compilación con glibc/gcc modernos.
            const xdisplayPath = path.join(robotjsDir, 'src', 'xdisplay.c');
            if (fs.existsSync(xdisplayPath)) {
                let src = fs.readFileSync(xdisplayPath, 'utf8');
                if (!src.includes('#include <string.h>')) {
                    src = src.replace('#include "xdisplay.h"', '#include "xdisplay.h"\n#include <string.h>');
                    fs.writeFileSync(xdisplayPath, src);
                    console.log('[rebuild-native] xdisplay.c de robotjs parcheado (include <string.h>).');
                }
            }

            const electronRebuildBin = path.join(rootDir, 'node_modules', '.bin', 'electron-rebuild');
            if (fs.existsSync(electronRebuildBin)) {
                run(`"${electronRebuildBin}" -f -o robotjs`);
            } else {
                console.warn('[rebuild-native] @electron/rebuild no disponible; robotjs se usará con su binario de Node.js.');
            }
        } else {
            console.log('[rebuild-native] robotjs no disponible en esta plataforma; se omite el rebuild.');
        }
    }
} catch (error) {
    // Los módulos nativos son opcionales (fallback en runtime), por lo que un fallo
    // de reconstrucción no debe romper la instalación.
    console.warn('[rebuild-native] aviso: la reconstrucción de módulos nativos falló:', error.message);
}
