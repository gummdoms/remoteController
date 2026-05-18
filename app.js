const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, shell } = require('electron');
const express = require('express');
const https = require('https');
const os = require('os');
const { X509Certificate } = require('crypto');
const path = require('path');
const { exec, execFile, execSync, execFileSync } = require('child_process');
const asyncQueue = require('async'); // Para manejar la cola de tareas
const fs = require('fs');
let QRCode = null;
try {
    QRCode = require('qrcode');
} catch (error) {
    console.warn('⚠️ qrcode no está disponible. El endpoint de QR devolverá solo URL de descarga.');
}
let robot = null;
try {
    robot = require('robotjs');
    console.log('✅ robotjs cargado como fallback de control de entradas');
} catch (error) {
    console.warn('⚠️ robotjs no está disponible como fallback:', error.message);
}
const cors = require('cors');
const multer = require('multer');
const connApps = require('./classes/Apps.js');
const SettingsStore = require('./classes/Settings.js');
const displayControl = require('./platform/displayControl');
const audioControl = require('./platform/audioControl');
const displayMode = require('./platform/displayMode');

const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const currentDesktop = (process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || '').toLowerCase();
const isKDE = isLinux && /kde|plasma/.test(currentDesktop);

const ALERT_THRESHOLD_MS = 5 * 60 * 1000;
const hasRobotFallback = () => Boolean(robot);
const INPUT_PROVIDER_UNAVAILABLE_MSG = 'No hay módulos de control de entradas disponibles. Ejecute "npm run build:native" o instale la dependencia opcional robotjs.';
const isProviderUnavailableError = (error) => Boolean(error && error.message === INPUT_PROVIDER_UNAVAILABLE_MSG);
const sendInputError = (res, error, fallbackMessage) => {
    if (isProviderUnavailableError(error)) {
        return res.status(503).send({ error: INPUT_PROVIDER_UNAVAILABLE_MSG });
    }
    console.error(fallbackMessage, error);
    return res.status(500).send({ error: fallbackMessage });
};
const ensureDisplayControlAvailable = (res) => {
    if (displayControl.isSupported()) {
        return true;
    }
    if (res) {
        res.status(501).send({ error: displayControl.getUnavailableReason() });
    }
    return false;
};
const ensureAudioControlAvailable = (res) => {
    if (audioControl.isSupported()) {
        return true;
    }
    if (res) {
        res.status(501).send({ error: audioControl.getUnavailableReason() });
    }
    return false;
};
const ensureDisplayModeAvailable = (res) => {
    if (displayMode.isSupported()) {
        return true;
    }
    if (res) {
        res.status(501).send({ error: displayMode.getUnavailableReason() });
    }
    return false;
};
const parseBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
    }
    return Boolean(value);
};
const commandExists = (binary) => {
    if (!binary) {
        return false;
    }
    try {
        execSync(`command -v ${binary}`, { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

const modeToLegacyCode = (mode) => {
    const mapping = {
        internal: '4500',
        external: '4501',
        clone: '4502',
        extend: '4503'
    };
    return mapping[mode] || null;
};
function buildLinuxLogoutCommands() {
    if (!isLinux) {
        return [];
    }
    const commands = [];
    if (isKDE) {
        const kdeBinary = ['qdbus6', 'qdbus'].find(commandExists);
        if (kdeBinary) {
            commands.push(
                `${kdeBinary} org.kde.ksmserver /KSMServer org.kde.KSMServerInterface.logout 0 0 0`,
                `${kdeBinary} org.kde.ksmserver /KSMServer logout 0 0 0`,
                `${kdeBinary} org.kde.LogoutPrompt /LogoutPrompt logout`
            );
        }
    }

    if (process.env.XDG_SESSION_ID) {
        commands.push(`loginctl terminate-session ${process.env.XDG_SESSION_ID}`);
    }
    const user = process.env.USER || process.env.LOGNAME;
    if (user) {
        commands.push(`loginctl terminate-user ${user}`);
    } else {
        commands.push('loginctl terminate-user $(id -un)');
    }
    return commands;
}

const powerActionMap = {
    shutdown: {
        win32: [
            'shutdown /s /f /t 0',
            'shutdown.exe /s /f /t 0',
            'powershell -NoProfile -Command "Stop-Computer -Force"'
        ],
        linux: [
            'systemctl poweroff -i',
            'systemctl poweroff',
            'loginctl poweroff',
            'shutdown -P now',
            'poweroff'
        ]
    },
    restart: {
        win32: [
            'shutdown /r /f /t 0',
            'shutdown.exe /r /f /t 0',
            'powershell -NoProfile -Command "Restart-Computer -Force"'
        ],
        linux: [
            'systemctl reboot -i',
            'systemctl reboot',
            'loginctl reboot',
            'shutdown -r now',
            'reboot'
        ]
    },
    suspend: {
        win32: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
        linux: 'systemctl suspend'
    },
    logout: {
        win32: 'shutdown /l',
        linux: buildLinuxLogoutCommands
    }
};

function getPowerCommand(action) {
    const entry = powerActionMap[action];
    if (!entry) {
        return null;
    }
    const value = isWindows ? entry.win32 : isLinux ? entry.linux : null;
    const resolved = typeof value === 'function' ? value() : value;
    if (Array.isArray(resolved)) {
        return resolved.filter(Boolean);
    }
    return resolved || null;
}

function execCommandPromise(command, label) {
    return new Promise((resolve, reject) => {
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            if (stderr) {
                console.error(`stderr ${label}:`, stderr);
            }
            if (stdout) {
                console.log(`stdout ${label}:`, stdout);
            }
            resolve();
        });
        if (child && typeof child.unref === 'function') {
            child.unref();
        }
    });
}

async function runPowerCommand(action, label = action) {
    const command = getPowerCommand(action);
    if (!command || (Array.isArray(command) && !command.length)) {
        throw new Error(`La acción "${label}" no está soportada en este sistema.`);
    }
    const commands = Array.isArray(command) ? command : [command];
    const failures = [];

    for (const cmd of commands) {
        try {
            await execCommandPromise(cmd, label);
            return;
        } catch (error) {
            failures.push({ cmd, error: error.message });
            console.error(`Error al ejecutar ${label} con "${cmd}":`, error.message);
        }
    }

    const details = failures.map((entry) => `"${entry.cmd}": ${entry.error}`).join(' | ');
    throw new Error(`No se pudo ejecutar la acción "${label}". Intentos: ${details}`);
}

async function handlePowerRequest(action, res, label) {
    try {
        await runPowerCommand(action, label);
        res.send({ status: 'executing', action, platform: process.platform });
    } catch (error) {
        const status = /no está soportada/i.test(error.message) ? 501 : 500;
        res.status(status).send({ error: error.message });
    }
}
let scheduledShutdown = null;
let scheduledShutdownTimer = null;
let scheduledAlertTimeout = null;
let alertProcess = null;

function clearScheduledAlert() {
    if (scheduledAlertTimeout) {
        clearTimeout(scheduledAlertTimeout);
        scheduledAlertTimeout = null;
    }

    if (alertProcess) {
        try {
            alertProcess.kill();
        } catch (error) {
            console.warn('No se pudo finalizar el proceso de alerta:', error.message);
        }
        alertProcess = null;
    }
}

function clearScheduledShutdown() {
    if (scheduledShutdownTimer) {
        clearTimeout(scheduledShutdownTimer);
        scheduledShutdownTimer = null;
    }
    clearScheduledAlert();
    const hadSchedule = Boolean(scheduledShutdown);
    scheduledShutdown = null;
    return hadSchedule;
}

function formatTimeLabel(date) {
    try {
        return new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    } catch (error) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}

function launchNativeAlert(primaryLine, secondaryLine, displaySeconds = 25) {
    if (!nativeInput || !nativeInput.alertExecutable) {
        console.warn('No se encontró el ejecutable de alerta nativa.');
        return;
    }

    const executablePath = nativeInput.alertExecutable;
    if (!fs.existsSync(executablePath)) {
        console.warn('El ejecutable de alerta no está disponible en:', executablePath);
        return;
    }

    try {
        if (alertProcess) {
            alertProcess.kill();
            alertProcess = null;
        }

        alertProcess = execFile(
            executablePath,
            [primaryLine, secondaryLine, String(displaySeconds)],
            { windowsHide: true },
            (error) => {
                if (error && !error.killed) {
                    console.error('Error al mostrar la alerta de apagado:', error.message);
                }
            }
        );

        if (alertProcess && typeof alertProcess.unref === 'function') {
            alertProcess.unref();
        }

        if (alertProcess) {
            alertProcess.once('exit', () => {
                alertProcess = null;
            });
        }
    } catch (error) {
        console.error('Error inesperado al lanzar la alerta de apagado:', error.message);
    }
}

function triggerShutdownAlert(targetDate) {
    const remainingMs = Math.max(0, targetDate.getTime() - Date.now());
    const minutesLeft = Math.max(0, Math.ceil(remainingMs / 60000));

    let primaryLine = 'Apagado inminente';
    if (minutesLeft > 1) {
        primaryLine = `Apagado en ${minutesLeft} minutos`;
    } else if (minutesLeft === 1) {
        primaryLine = 'Apagado en 1 minuto';
    }

    const secondaryLine = `El equipo se apagará a las ${formatTimeLabel(targetDate)}.`;

    const displaySeconds = Math.min(45, Math.max(20, minutesLeft * 10 || 30));
    launchNativeAlert(primaryLine, secondaryLine, displaySeconds);
}

function scheduleAlertForShutdown(targetDate) {
    clearScheduledAlert();

    if (!nativeInput || !nativeInput.alertExecutable) {
        return;
    }

    const delay = targetDate.getTime() - Date.now();
    if (delay <= 0) {
        return;
    }

    const trigger = () => triggerShutdownAlert(targetDate);

    if (delay <= ALERT_THRESHOLD_MS) {
        trigger();
        return;
    }

    scheduledAlertTimeout = setTimeout(trigger, delay - ALERT_THRESHOLD_MS);
}

function scheduleSystemShutdown(targetDate) {
    const now = Date.now();
    const targetTs = targetDate.getTime();
    const delay = targetTs - now;

    if (Number.isNaN(targetTs) || delay <= 0) {
        throw new Error('La hora seleccionada ya pasó');
    }

    clearScheduledShutdown();

    scheduledShutdown = {
        createdAt: new Date(now).toISOString(),
        target: targetDate.toISOString()
    };

    scheduleAlertForShutdown(targetDate);

    scheduledShutdownTimer = setTimeout(() => {
        console.log('Ejecutando apagado programado');
        runPowerCommand('shutdown', 'apagado programado').catch((error) => {
            console.error('Error al ejecutar apagado programado:', error);
        });
        clearScheduledShutdown();
    }, delay);
}

function resolveTargetDateFromTimeString(timeString) {
    if (typeof timeString !== 'string') {
        return null;
    }

    const match = timeString.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
        return null;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    const now = new Date();
    const target = new Date(now);
    target.setSeconds(0, 0);
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }

    return target;
}

// Importar módulo nativo de control de entradas (mouse/teclado)
let nativeInput;
try {
    nativeInput = require('./modules');
    console.log('✅ Módulo nativo de entradas cargado correctamente');
} catch (error) {
    console.warn('⚠️ No se pudo cargar el módulo nativo de entradas. Se usará robotjs si está disponible.');
    console.warn('Para usar el módulo nativo, ejecute: cd modules && npm install');
    nativeInput = null;
}
const userDataPath = app.getPath('userData');

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

const resolvedPath = () => path.join(userDataPath, 'apps.db');

const uploadTempDir = path.join(userDataPath, 'uploads');
ensureDirectory(uploadTempDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guardamos temporalmente en la carpeta de datos del usuario para evitar rutas de solo lectura al empaquetar
        cb(null, uploadTempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const extension = path.extname(file.originalname); // Obtener la extensión del archivo
        cb(null, `${uniqueSuffix}${extension}`); // Generar un nombre único
    }
});

const upload = multer({ storage: storage });


const dbPath = resolvedPath();
ensureDirectory(path.dirname(dbPath));
const db = new connApps(dbPath);
const settingsStore = new SettingsStore(dbPath);

const MOUSE_POINTER_MIN = 0.5;
const MOUSE_POINTER_MAX = 6;
const MOUSE_SCROLL_MIN = 0.5;
const MOUSE_SCROLL_MAX = 18;

const queue = asyncQueue.queue(async (task, callback) => {
    try {
        await task();
    } catch (error) {
        console.error('Error al ejecutar la tarea:', error);
    } finally {
        callback();
    }
}, 1);


let mainWindow;
let tray = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function showMainWindow() {
    if (!mainWindow) {
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }

    mainWindow.focus();
}

if (!hasSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        showMainWindow();
    });
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        frame: false,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    const emitWindowState = () => {
        if (!mainWindow || !mainWindow.webContents) {
            return;
        }
        mainWindow.webContents.send('windowStateChanged', {
            isMaximized: mainWindow.isMaximized()
        });
    };

    mainWindow.webContents.on('did-finish-load', () => {
        emitWindowState();
    });

    mainWindow.on('maximize', emitWindowState);
    mainWindow.on('unmaximize', emitWindowState);

    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('close', (event) => {
        if (!app.quitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
};
const createTray = () => {
    tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Ver App', click: () => { showMainWindow(); } },
        { label: 'Salir', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Remote Controller');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        showMainWindow();
    });
};

if (hasSingleInstanceLock) {
    app.whenReady().then(() => {
        if (!mainWindow) {
            createWindow();
        }
        if (!tray) {
            createTray();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            showMainWindow();
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('before-quit', () => {
    app.quitting = true;
});

ipcMain.on('closeApp', () => {
    mainWindow.hide()
});
ipcMain.on('showApp', () => {
    mainWindow.show()
});
ipcMain.on('exitApp', () => {
    app.quit();
});
ipcMain.on('minimizeApp', () => {
    mainWindow.minimize();
});
ipcMain.on('toggleMaximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window:getState', () => {
    return {
        isMaximized: Boolean(mainWindow && mainWindow.isMaximized())
    };
});
const server = express();
const REQUEST_BODY_LIMIT = '10mb';
const HTTP_PORT = Number(process.env.HTTP_PORT || 4800);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 5443);
const defaultCertsDir = app.isPackaged ? path.join(userDataPath, 'certs') : path.join(__dirname, 'certs');
const CERTS_DIR = process.env.CERTS_DIR || defaultCertsDir;
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || path.join(CERTS_DIR, 'server.key');
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || path.join(CERTS_DIR, 'server.crt');
const ROOT_CA_PUBLIC_PATH = path.join(CERTS_DIR, 'rootCA.crt');
let mkcertExecutablePath = null;
let httpServer = null;
let httpsServer = null;
let certificateRuntimeState = {
    ok: false,
    ip: null,
    message: 'Certificado no inicializado'
};

function getPrimaryLocalIPv4() {
    const interfaces = os.networkInterfaces();
    const preferred = [];
    const fallback = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
        if (!Array.isArray(addresses)) {
            continue;
        }

        for (const entry of addresses) {
            if (!entry || entry.family !== 'IPv4' || entry.internal) {
                continue;
            }

            if (entry.address.startsWith('169.254.')) {
                continue;
            }

            const target = {
                name: name.toLowerCase(),
                address: entry.address
            };

            if (/ethernet|wi-?fi|wlan|en\d+|eth\d+/.test(target.name)) {
                preferred.push(target.address);
            } else {
                fallback.push(target.address);
            }
        }
    }

    return preferred[0] || fallback[0] || null;
}

function getServiceHost() {
    return certificateRuntimeState.ip || getPrimaryLocalIPv4() || 'localhost';
}

function getServiceUrls() {
    const host = getServiceHost();
    return {
        host,
        http: `http://${host}:${HTTP_PORT}/`,
        https: `https://${host}:${HTTPS_PORT}/`
    };
}

function getAutostartState() {
    if (isLinux) {
        try {
            const autostartPath = path.join(app.getPath('home'), '.config', 'autostart', 'remotecontrollers.desktop');
            const enabled = fs.existsSync(autostartPath);
            return {
                supported: true,
                enabled,
                message: enabled
                    ? 'Autoinicio activado en Linux.'
                    : 'Autoinicio desactivado en Linux.'
            };
        } catch (error) {
            return {
                supported: false,
                enabled: false,
                message: `No se pudo leer el estado de autoinicio en Linux: ${error.message}`
            };
        }
    }

    try {
        const settings = app.getLoginItemSettings();
        return {
            supported: true,
            enabled: Boolean(settings.openAtLogin),
            message: settings.openAtLogin ? 'Autoinicio activado.' : 'Autoinicio desactivado.'
        };
    } catch (error) {
        return {
            supported: false,
            enabled: false,
            message: error.message
        };
    }
}

function setAutostartState(enabled) {
    const shouldEnable = Boolean(enabled);

    if (isLinux) {
        const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
        const autostartPath = path.join(autostartDir, 'remotecontrollers.desktop');

        try {
            ensureDirectory(autostartDir);

            if (!shouldEnable) {
                if (fs.existsSync(autostartPath)) {
                    fs.unlinkSync(autostartPath);
                }
                return {
                    supported: true,
                    enabled: false,
                    message: 'Autoinicio desactivado en Linux.'
                };
            }

            const execPath = process.env.APPIMAGE || app.getPath('exe');
            const escapedExec = String(execPath).replace(/"/g, '\\"');
            const desktopFile = [
                '[Desktop Entry]',
                'Type=Application',
                'Version=1.0',
                'Name=Remote Controllers',
                'Comment=Servicio remoto',
                `Exec="${escapedExec}"`,
                'Terminal=false',
                'X-GNOME-Autostart-enabled=true'
            ].join('\n');

            fs.writeFileSync(autostartPath, `${desktopFile}\n`, { mode: 0o644 });

            return {
                supported: true,
                enabled: true,
                message: 'Autoinicio activado en Linux.'
            };
        } catch (error) {
            throw new Error(`No se pudo configurar el autoinicio en Linux: ${error.message}`);
        }
    }

    const options = { openAtLogin: shouldEnable };

    if (isLinux && process.env.APPIMAGE) {
        options.path = process.env.APPIMAGE;
    }

    try {
        app.setLoginItemSettings(options);
        return getAutostartState();
    } catch (error) {
        throw new Error(`No se pudo configurar el autoinicio: ${error.message}`);
    }
}

function getInputPermissionDiagnosis() {
    if (!isLinux) {
        return {
            platform: process.platform,
            sessionType: null,
            needsAttention: false,
            message: 'Diagnóstico de permisos de entrada disponible solo en Linux.',
            checks: []
        };
    }

    const sessionType = (process.env.XDG_SESSION_TYPE || 'unknown').toLowerCase();
    const groupCheck = (() => {
        try {
            const groups = execSync('id -nG', { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean);
            return {
                ok: groups.includes('input') && groups.includes('uinput'),
                groups
            };
        } catch (error) {
            return {
                ok: false,
                groups: [],
                error: error.message
            };
        }
    })();

    const uinputCheck = (() => {
        try {
            const exists = fs.existsSync('/dev/uinput');
            const writable = exists ? fs.accessSync('/dev/uinput', fs.constants.R_OK | fs.constants.W_OK) === undefined : false;
            return { ok: exists && writable, exists, writable };
        } catch (error) {
            return { ok: false, exists: fs.existsSync('/dev/uinput'), writable: false, error: error.message };
        }
    })();

    const needsAttention = sessionType === 'wayland' || !groupCheck.ok || !uinputCheck.ok;
    const checks = [
        {
            name: 'Sesión Linux',
            ok: sessionType !== 'unknown',
            details: `XDG_SESSION_TYPE=${sessionType}`
        },
        {
            name: 'Grupos input/uinput',
            ok: groupCheck.ok,
            details: groupCheck.groups.join(' ') || groupCheck.error || 'No disponible'
        },
        {
            name: 'Acceso a /dev/uinput',
            ok: uinputCheck.ok,
            details: `exists=${uinputCheck.exists} writable=${uinputCheck.writable}`
        }
    ];

    const recommendedCommands = [
        'sudo groupadd -f uinput',
        'sudo usermod -aG input,uinput,video $USER',
        'echo uinput | sudo tee /etc/modules-load.d/uinput.conf',
        "echo 'KERNEL==\"uinput\", MODE=\"0660\", GROUP=\"uinput\", OPTIONS+=\"static_node=uinput\"' | sudo tee /etc/udev/rules.d/99-uinput.rules",
        'sudo modprobe uinput',
        'sudo udevadm control --reload-rules && sudo udevadm trigger',
        'Reinicia sesión para aplicar grupos'
    ];

    return {
        platform: process.platform,
        sessionType,
        needsAttention,
        message: needsAttention
            ? 'Se detectaron condiciones que pueden provocar el aviso de privilegios de entrada en Linux.'
            : 'Configuración de permisos de entrada en buen estado.',
        checks,
        recommendedCommands
    };
}

function buildLinuxInputFixScript() {
    return [
        'set -e',
        'groupadd -f uinput',
        'usermod -aG input,uinput,video "$SUDO_USER"',
        'echo uinput > /etc/modules-load.d/uinput.conf',
        "echo 'KERNEL==\"uinput\", MODE=\"0660\", GROUP=\"uinput\", OPTIONS+=\"static_node=uinput\"' > /etc/udev/rules.d/99-uinput.rules",
        'modprobe uinput',
        'udevadm control --reload-rules',
        'udevadm trigger'
    ].join('\n');
}

async function applyLinuxInputPermissionFix() {
    if (!isLinux) {
        throw new Error('Esta acción solo está disponible en Linux.');
    }
    if (!commandExists('pkexec')) {
        throw new Error('pkexec no está disponible. Instala polkit para aplicar la configuración automática.');
    }

    const tempScriptPath = path.join(app.getPath('temp'), `remotecontrollers-input-fix-${Date.now()}.sh`);
    fs.writeFileSync(tempScriptPath, buildLinuxInputFixScript(), { mode: 0o700 });

    try {
        await execCommandPromise(`pkexec /bin/bash "${tempScriptPath}"`, 'aplicar permisos de entrada linux');
        return {
            ok: true,
            message: 'Configuración aplicada. Reinicia sesión para que los grupos se reflejen en tu usuario.',
            diagnosis: getInputPermissionDiagnosis()
        };
    } finally {
        try {
            fs.unlinkSync(tempScriptPath);
        } catch (error) {
            // Ignorar limpieza.
        }
    }
}

ipcMain.handle('service:getStatus', () => {
    return {
        urls: getServiceUrls(),
        autostart: getAutostartState(),
        platform: process.platform,
        sessionType: process.env.XDG_SESSION_TYPE || null,
        inputDiagnosis: getInputPermissionDiagnosis()
    };
});

ipcMain.handle('service:setAutostart', (event, payload) => {
    return setAutostartState(Boolean(payload?.enabled));
});

ipcMain.handle('service:openUrl', async (event, payload) => {
    const mode = payload?.mode === 'https' ? 'https' : 'http';
    const urls = getServiceUrls();
    const targetUrl = mode === 'https' ? urls.https : urls.http;
    await shell.openExternal(targetUrl);
    return { ok: true, url: targetUrl };
});

ipcMain.handle('service:diagnoseInputPermission', () => {
    return getInputPermissionDiagnosis();
});

ipcMain.handle('service:applyInputPermissionFix', async () => {
    return applyLinuxInputPermissionFix();
});

function findMkcertExecutable() {
    if (mkcertExecutablePath && fs.existsSync(mkcertExecutablePath)) {
        return mkcertExecutablePath;
    }

    if (process.env.MKCERT_PATH && fs.existsSync(process.env.MKCERT_PATH)) {
        mkcertExecutablePath = process.env.MKCERT_PATH;
        return mkcertExecutablePath;
    }

    try {
        if (isWindows) {
            const found = execSync('where mkcert', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
                .split(/\r?\n/)
                .map((value) => value.trim())
                .find(Boolean);
            if (found && fs.existsSync(found)) {
                mkcertExecutablePath = found;
                return mkcertExecutablePath;
            }
        } else {
            const found = execSync('command -v mkcert', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            if (found && fs.existsSync(found)) {
                mkcertExecutablePath = found;
                return mkcertExecutablePath;
            }
        }
    } catch (error) {
        // Ignorar: probaremos rutas alternativas.
    }

    if (isWindows) {
        const wingetPackagesDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
        if (fs.existsSync(wingetPackagesDir)) {
            try {
                const packages = fs.readdirSync(wingetPackagesDir).filter((item) => item.toLowerCase().includes('mkcert'));
                for (const pkg of packages) {
                    const candidate = path.join(wingetPackagesDir, pkg, 'mkcert.exe');
                    if (fs.existsSync(candidate)) {
                        mkcertExecutablePath = candidate;
                        return mkcertExecutablePath;
                    }
                }
            } catch (error) {
                // Ignorar
            }
        }
    }

    return null;
}

function runMkcert(args) {
    const executable = findMkcertExecutable();
    if (!executable) {
        throw new Error('mkcert no está instalado en el sistema.');
    }
    return execFileSync(executable, args, { encoding: 'utf8' });
}

function certificateSupportsIp(ipAddress) {
    if (!ipAddress || !fs.existsSync(HTTPS_CERT_PATH)) {
        return false;
    }

    try {
        const cert = new X509Certificate(fs.readFileSync(HTTPS_CERT_PATH));
        const san = cert.subjectAltName || '';
        return san.includes(`IP Address:${ipAddress}`);
    } catch (error) {
        return false;
    }
}

function syncRootCaForClients() {
    const caroot = runMkcert(['-CAROOT']).trim();
    const rootCaPemPath = path.join(caroot, 'rootCA.pem');
    if (!fs.existsSync(rootCaPemPath)) {
        throw new Error('No se encontró rootCA.pem en el directorio de mkcert.');
    }
    fs.copyFileSync(rootCaPemPath, ROOT_CA_PUBLIC_PATH);
}

function ensureRootCaFileAvailable() {
    if (fs.existsSync(ROOT_CA_PUBLIC_PATH)) {
        return { ok: true, message: 'rootCA.crt disponible' };
    }

    try {
        ensureDirectory(CERTS_DIR);
        syncRootCaForClients();
        if (fs.existsSync(ROOT_CA_PUBLIC_PATH)) {
            return { ok: true, message: 'rootCA.crt sincronizado' };
        }
    } catch (error) {
        // Intentar regeneración completa como fallback.
    }

    const regenResult = ensureLocalHttpsCertificate(false);
    certificateRuntimeState = regenResult;

    if (fs.existsSync(ROOT_CA_PUBLIC_PATH)) {
        return { ok: true, message: 'rootCA.crt regenerado' };
    }

    return {
        ok: false,
        message: regenResult?.message || 'No se pudo preparar rootCA.crt'
    };
}

function ensureLocalHttpsCertificate(force = false) {
    ensureDirectory(CERTS_DIR);

    const ipAddress = getPrimaryLocalIPv4();
    if (!ipAddress) {
        return {
            ok: false,
            ip: null,
            message: 'No se detectó una IP IPv4 local válida para generar certificado.'
        };
    }

    const requiresNewCertificate = force
        || !fs.existsSync(HTTPS_KEY_PATH)
        || !fs.existsSync(HTTPS_CERT_PATH)
        || !certificateSupportsIp(ipAddress)
        || !fs.existsSync(ROOT_CA_PUBLIC_PATH);

    if (!requiresNewCertificate) {
        return {
            ok: true,
            ip: ipAddress,
            message: 'Certificado vigente para la IP actual.'
        };
    }

    try {
        runMkcert(['-install']);
        runMkcert(['-key-file', HTTPS_KEY_PATH, '-cert-file', HTTPS_CERT_PATH, 'localhost', '127.0.0.1', '::1', ipAddress]);
        syncRootCaForClients();

        return {
            ok: true,
            ip: ipAddress,
            message: `Certificado generado para ${ipAddress}`
        };
    } catch (error) {
        return {
            ok: false,
            ip: ipAddress,
            message: `No se pudo generar certificado automáticamente: ${error.message}`
        };
    }
}

function loadHttpsCredentials() {
    if (!fs.existsSync(HTTPS_KEY_PATH) || !fs.existsSync(HTTPS_CERT_PATH)) {
        return null;
    }

    try {
        return {
            key: fs.readFileSync(HTTPS_KEY_PATH),
            cert: fs.readFileSync(HTTPS_CERT_PATH)
        };
    } catch (error) {
        console.error('No se pudieron cargar los certificados HTTPS:', error.message);
        return null;
    }
}

function startApiServers() {
    if (!httpServer) {
        httpServer = server.listen(HTTP_PORT, () => {
            console.log(`Servidor HTTP en el puerto ${HTTP_PORT}`);
        });
    }

    if (httpsServer) {
        try {
            httpsServer.close();
        } catch (error) {
            console.error('No se pudo cerrar el servidor HTTPS previo:', error.message);
        }
        httpsServer = null;
    }

    const credentials = loadHttpsCredentials();
    if (!credentials) {
        console.warn('HTTPS deshabilitado: faltan certificados en certs/server.key y certs/server.crt');
        return;
    }

    httpsServer = https.createServer(credentials, server).listen(HTTPS_PORT, () => {
        console.log(`Servidor HTTPS en el puerto ${HTTPS_PORT}`);
    });
}

server.use(cors()); // Usa cors para habilitar CORS en todas las rutas
server.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
server.use(express.json({ limit: REQUEST_BODY_LIMIT }));
server.use((err, req, res, next) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        return res.status(413).send({
            error: 'El tamaño de la solicitud es demasiado grande',
            limit: REQUEST_BODY_LIMIT
        });
    }
    next(err);
});
if (hasSingleInstanceLock) {
    certificateRuntimeState = ensureLocalHttpsCertificate(false);
    if (!certificateRuntimeState.ok) {
        console.warn(certificateRuntimeState.message);
    }
    startApiServers();
}
//pagina de inicio *//los htmls se encuentran en la carpeta views
server.use(express.static(path.join(__dirname, 'views')));
server.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
server.use('/static', express.static(path.join(__dirname, 'static')));
//usar tambien ../dashboard/img/icons/ para los iconos de las carpetas y archivos pero no esta en la raiz del proyecto esta otro nivel atras
server.use('/dashboard/img/icons', express.static(path.join(__dirname, '../dashboard/img/icons')));
server.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

server.get('/cert/rootca', (req, res) => {
    const rootCaState = ensureRootCaFileAvailable();
    if (!rootCaState.ok || !fs.existsSync(ROOT_CA_PUBLIC_PATH)) {
        return res.status(404).send({
            error: 'No existe rootCA.crt. Regenera el certificado.',
            details: rootCaState.message
        });
    }

    try {
        let payload = null;
        try {
            payload = fs.readFileSync(ROOT_CA_PUBLIC_PATH);
        } catch (firstError) {
            // Reintento: regenerar/sincronizar y volver a leer.
            const retryState = ensureRootCaFileAvailable();
            if (!retryState.ok || !fs.existsSync(ROOT_CA_PUBLIC_PATH)) {
                throw firstError;
            }
            payload = fs.readFileSync(ROOT_CA_PUBLIC_PATH);
        }

        res.setHeader('Content-Type', 'application/x-pem-file');
        res.setHeader('Content-Disposition', 'attachment; filename="rootCA.crt"');
        return res.send(payload);
    } catch (error) {
        console.error('Error al descargar rootCA.crt:', error.message);
        return res.status(500).send({ error: 'No se pudo descargar rootCA.crt', details: error.message });
    }
});

server.get('/cert/info', async (req, res) => {
    const ipAddress = certificateRuntimeState.ip || getPrimaryLocalIPv4();
    const host = ipAddress || 'localhost';
    const rootCaDownloadUrl = `http://${host}:${HTTP_PORT}/cert/rootca`;
    const httpsUrl = `https://${host}:${HTTPS_PORT}`;
    const rootCaState = ensureRootCaFileAvailable();
    let qrDataUrl = null;

    if (QRCode) {
        try {
            qrDataUrl = await QRCode.toDataURL(rootCaDownloadUrl, {
                width: 280,
                margin: 1
            });
        } catch (error) {
            qrDataUrl = null;
        }
    }

    return res.send({
        ok: certificateRuntimeState.ok,
        message: certificateRuntimeState.message,
        ip: host,
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT,
        httpsUrl,
        rootCaDownloadUrl,
        qrDataUrl,
        certExists: fs.existsSync(HTTPS_CERT_PATH) && fs.existsSync(HTTPS_KEY_PATH),
        rootCaExists: fs.existsSync(ROOT_CA_PUBLIC_PATH),
        rootCaMessage: rootCaState.message
    });
});

server.post('/cert/regenerate', (req, res) => {
    const result = ensureLocalHttpsCertificate(true);
    certificateRuntimeState = result;

    if (!result.ok) {
        return res.status(500).send(result);
    }

    startApiServers();
    return res.send(result);
});

server.get('/brillo', async (req, res) => {
    if (!ensureDisplayControlAvailable(res)) {
        return;
    }
    const displayId = req.query?.displayId;
    try {
        const valores = await displayControl.getBrightnessList(displayId);
        if (!valores.length) {
            res.status(503).send({ error: 'No se pudo leer el brillo de los monitores' });
            return;
        }
        res.send({ brillo: valores[0]?.value ?? null, lista: valores });
    } catch (error) {
        console.error('Error al leer brillo:', error);
        res.status(500).send({ error: 'No se pudo leer el brillo de los monitores' });
    }
});

server.post('/brillo', (req, res) => {
    if (!ensureDisplayControlAvailable(res)) {
        return;
    }
    const brillo = Number(req.body.brillo);
    const displayId = req.body?.displayId;
    if (!Number.isFinite(brillo) || brillo < 0 || brillo > 100) {
        res.status(400).send({ error: 'El brillo debe ser un número entre 0 y 100' });
        return;
    }
    queue.push(async () => {
        await displayControl.setBrightness(brillo, displayId);
    });
    res.send({ status: 'ok' });
});

server.get('/contraste', async (req, res) => {
    if (!ensureDisplayControlAvailable(res)) {
        return;
    }
    const displayId = req.query?.displayId;
    try {
        const valores = await displayControl.getContrastList(displayId);
        if (!valores.length) {
            res.status(503).send({ error: 'No se pudo leer el contraste de los monitores' });
            return;
        }
        res.send({ contraste: valores[0]?.value ?? null, lista: valores });
    } catch (error) {
        console.error('Error al leer contraste:', error);
        res.status(500).send({ error: 'No se pudo leer el contraste de los monitores' });
    }
});

server.post('/contraste', (req, res) => {
    if (!ensureDisplayControlAvailable(res)) {
        return;
    }
    const contraste = Number(req.body.contraste);
    const displayId = req.body?.displayId;
    if (!Number.isFinite(contraste) || contraste < 0 || contraste > 100) {
        res.status(400).send({ error: 'El contraste debe ser un número entre 0 y 100' });
        return;
    }
    queue.push(async () => {
        await displayControl.setContrast(contraste, displayId);
    });
    res.send({ status: 'ok' });
});

server.get('/monitores', async (req, res) => {
    if (!ensureDisplayControlAvailable(res)) {
        return;
    }
    try {
        const lista = await displayControl.getMonitorList();
        res.send(lista);
    } catch (error) {
        console.error('Error al obtener lista de monitores:', error);
        res.status(500).send({ error: 'No se pudo obtener la lista de monitores' });
    }
});

server.post('/programarApagado', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
        const timeString = req.body?.time;
        const targetDate = resolveTargetDateFromTimeString(timeString);

        if (!targetDate) {
            res.status(400).send({ error: 'Hora inválida. Usa el formato HH:MM (24h).' });
            return;
        }

        scheduleSystemShutdown(targetDate);

        res.send({
            status: 'scheduled',
            target: scheduledShutdown.target
        });
    } catch (error) {
        console.error('Error al programar apagado:', error);
        res.status(500).send({ error: error.message || 'No se pudo programar el apagado' });
    }
});

server.get('/programarApagado', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!scheduledShutdown) {
        res.send({ active: false });
        return;
    }

    const targetTs = Date.parse(scheduledShutdown.target);
    const remaining = targetTs - Date.now();

    if (!Number.isFinite(targetTs) || remaining <= 0) {
        clearScheduledShutdown();
        res.send({ active: false });
        return;
    }

    res.send({
        active: true,
        target: scheduledShutdown.target,
        remainingMs: remaining
    });
});

server.delete('/programarApagado', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const hadSchedule = clearScheduledShutdown();
    const cancelCommand = isWindows ? 'shutdown /a' : isLinux ? 'shutdown -c' : null;
    if (cancelCommand) {
        exec(cancelCommand, () => { /* Ignorar resultado; detiene cualquier apagado pendiente */ });
    }
    res.send({ status: hadSchedule ? 'cancelled' : 'inactive' });
});

server.get('/volumen', async (req, res) => {
    if (!ensureAudioControlAvailable(res)) {
        return;
    }
    try {
        const volumen = await audioControl.getVolume();
        res.send({ volumen });
    } catch (error) {
        console.error('Error al obtener el volumen:', error);
        res.status(500).send({ error: 'No se pudo obtener el volumen actual' });
    }
});

server.post('/volumen', async (req, res) => {
    if (!ensureAudioControlAvailable(res)) {
        return;
    }
    const valor = Number(req.body.volumen);
    if (!Number.isFinite(valor)) {
        res.status(400).send({ error: 'El volumen debe ser un número entre 0 y 100' });
        return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(valor)));
    try {
        await audioControl.setVolume(clamped);
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error al ajustar el volumen:', error);
        res.status(500).send({ error: 'No se pudo ajustar el volumen' });
    }
});

server.get('/muted', async (req, res) => {
    if (!ensureAudioControlAvailable(res)) {
        return;
    }
    try {
        const muted = await audioControl.getMuted();
        res.send({ muted });
    } catch (error) {
        console.error('Error al leer estado de silencio:', error);
        res.status(500).send({ error: 'No se pudo obtener el estado de silencio' });
    }
});

server.post('/muted', async (req, res) => {
    if (!ensureAudioControlAvailable(res)) {
        return;
    }
    try {
        await audioControl.setMuted(parseBoolean(req.body.muted));
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error al actualizar estado de silencio:', error);
        res.status(500).send({ error: 'No se pudo actualizar el estado de silencio' });
    }
});

server.get('/unmute', async (req, res) => {
    if (!ensureAudioControlAvailable(res)) {
        return;
    }
    try {
        await audioControl.setMuted(false);
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error al des-silenciar el audio:', error);
        res.status(500).send({ error: 'No se pudo restablecer el audio' });
    }
});

//reproducir audio de la pc para verificacion de audio
server.get('/reproducirSonido', (req, res) => {
    // Envía la señal al proceso de renderizado de Electron para reproducir el sonido
    if (mainWindow) {
        mainWindow.webContents.send('reproducirSonido');
    }
    res.send({ status: 'ok' });
});


const handleDisplayModeChange = async (mode, res, successMessage) => {
    if (!ensureDisplayModeAvailable(res)) {
        return;
    }
    try {
        await displayMode.setMode(mode);
        res.send({ status: 'ok', mode });
    } catch (error) {
        console.error(successMessage, error);
        res.status(500).send({ error: error.message || 'No se pudo cambiar el modo de pantalla' });
    }
};

server.get('/soloPc', async (req, res) => {
    await handleDisplayModeChange('internal', res, 'Error al activar solo la pantalla principal');
});

server.get('/duplicado', async (req, res) => {
    await handleDisplayModeChange('clone', res, 'Error al duplicar pantalla');
});

server.get('/extender', async (req, res) => {
    await handleDisplayModeChange('extend', res, 'Error al extender pantalla');
});

server.get('/mostrarSecundaria', async (req, res) => {
    await handleDisplayModeChange('external', res, 'Error al mostrar pantalla secundaria');
});

server.get('/estadoPantalla', async (req, res) => {
    if (!ensureDisplayModeAvailable(res)) {
        return;
    }
    try {
        const state = await displayMode.getState();
        const legacyCode = state.legacyCode || modeToLegacyCode(state.mode) || '4600';
        res.send({ estado: legacyCode, mode: state.mode, backend: displayMode.name });
    } catch (error) {
        console.error('Error al obtener el estado de la pantalla:', error);
        res.status(500).send({ error: 'Error al obtener el estado de la pantalla' });
    }
});

//apagar pc
server.get('/apagar', (req, res) => {
    handlePowerRequest('shutdown', res, 'apagar');
});

//reiniciar pc
server.get('/reiniciar', (req, res) => {
    handlePowerRequest('restart', res, 'reiniciar');
});

//cerrar sesion
server.get('/cerrarSesion', (req, res) => {
    handlePowerRequest('logout', res, 'cerrar sesión');
});

//suspender pc
server.get('/suspender', (req, res) => {
    handlePowerRequest('suspend', res, 'suspender');
});

const SPECIAL_KEYS = new Set([
    'backspace', 'enter', 'return', 'space', 'tab', 'esc', 'escape',
    'insert', 'delete', 'del', 'home', 'end', 'pageup', 'pagedown',
    'up', 'down', 'left', 'right', 'capslock', 'numlock', 'scrolllock',
    'numpad0', 'numpad1', 'numpad2', 'numpad3', 'numpad4',
    'numpad5', 'numpad6', 'numpad7', 'numpad8', 'numpad9',
    'printscreen', 'pause', 'pausebreak',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    'media_play', 'media_stop', 'media_next', 'media_prev',
    'volume_up', 'volume_down', 'volume_mute', 'lwin', 'rwin', 'win', 'windows',
    'ctrl', 'control', 'lctrl', 'rctrl', 'alt', 'lalt', 'ralt', 'shift', 'lshift', 'rshift', 'mayus'
]);

const MODIFIER_KEYS = new Set([
    'ctrl', 'control', 'lctrl', 'rctrl', 'alt', 'lalt', 'ralt',
    'shift', 'lshift', 'rshift', 'mayus', 'win', 'windows', 'lwin', 'rwin', 'super', 'meta'
]);

const ROBOT_KEY_ALIASES = new Map([
    ['return', 'enter'],
    ['del', 'delete'],
    ['escape', 'esc'],
    ['win', 'command'],
    ['windows', 'command'],
    ['lwin', 'command'],
    ['rwin', 'command'],
    ['super', 'command'],
    ['meta', 'command'],
    ['ctrl', 'control'],
    ['control', 'control'],
    ['lctrl', 'control'],
    ['rctrl', 'control'],
    ['lalt', 'alt'],
    ['ralt', 'alt'],
    ['lshift', 'shift'],
    ['rshift', 'shift'],
    ['mayus', 'shift'],
    ['numpad0', 'numpad_0'],
    ['numpad1', 'numpad_1'],
    ['numpad2', 'numpad_2'],
    ['numpad3', 'numpad_3'],
    ['numpad4', 'numpad_4'],
    ['numpad5', 'numpad_5'],
    ['numpad6', 'numpad_6'],
    ['numpad7', 'numpad_7'],
    ['numpad8', 'numpad_8'],
    ['numpad9', 'numpad_9'],
    ['pausebreak', 'pause']
]);

function normalizeKeyName(key) {
    return typeof key === 'string' ? key.toLowerCase() : '';
}

function convertRobotKeyName(key) {
    const normalized = normalizeKeyName(key);
    return ROBOT_KEY_ALIASES.get(normalized) || normalized;
}

function handleKeyAction(key, action) {
    const normalized = normalizeKeyName(key);
    const safeAction = action === 'down' ? 'down' : action === 'up' ? 'up' : null;
    if (!normalized || !safeAction) {
        throw new Error('Acción de tecla inválida');
    }

    if (nativeInput && typeof nativeInput.keyDown === 'function' && typeof nativeInput.keyUp === 'function') {
        if (safeAction === 'down') {
            nativeInput.keyDown(normalized);
        } else {
            nativeInput.keyUp(normalized);
        }
        return;
    }

    if (!hasRobotFallback()) {
        throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
    }
    const robotKey = convertRobotKeyName(normalized);
    robot.keyToggle(robotKey, safeAction);
}

function handleComboInput(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error('Combo inválido');
    }

    const normalized = keys
        .map(normalizeKeyName)
        .filter(Boolean);

    if (!normalized.length) {
        throw new Error('Combo inválido');
    }

    if (nativeInput && typeof nativeInput.keyCombo === 'function') {
        nativeInput.keyCombo(normalized);
        return;
    }

    if (!hasRobotFallback()) {
        throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
    }
    const modifiers = normalized.filter(key => MODIFIER_KEYS.has(key));
    const mainKeys = normalized.filter(key => !MODIFIER_KEYS.has(key));

    if (!mainKeys.length) {
        modifiers.forEach(mod => robot.keyTap(convertRobotKeyName(mod)));
        return;
    }

    const primary = convertRobotKeyName(mainKeys[mainKeys.length - 1]);
    const robotModifiers = modifiers.map(convertRobotKeyName);

    if (!robotModifiers.length) {
        robot.keyTap(primary);
        return;
    }

    try {
        robotModifiers.forEach(mod => robot.keyToggle(mod, 'down'));
        robot.keyTap(primary);
    } finally {
        for (let i = robotModifiers.length - 1; i >= 0; i -= 1) {
            robot.keyToggle(robotModifiers[i], 'up');
        }
    }
}

function resolveCharacter({ char, codePoint }) {
    if (typeof char === 'string' && char.length > 0) {
        return char;
    }
    if (Number.isInteger(codePoint)) {
        try {
            return String.fromCodePoint(codePoint);
        } catch (error) {
            throw new Error('CodePoint inválido');
        }
    }
    throw new Error('Caracter inválido');
}

function handleCharacterInput(payload) {
    const key = typeof payload === 'object'
        ? resolveCharacter(payload)
        : resolveCharacter({ char: payload });

    const normalized = normalizeKeyName(key);
    const isSpecial = SPECIAL_KEYS.has(normalized);

    if (nativeInput && typeof nativeInput.typeText === 'function' && typeof nativeInput.keyTap === 'function') {
        if (isSpecial) {
            nativeInput.keyTap(normalized);
        } else {
            nativeInput.typeText(key);
        }
        return;
    }

    if (!hasRobotFallback()) {
        throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
    }
    if (isSpecial) {
        const robotKey = convertRobotKeyName(normalized);
        robot.keyTap(robotKey);
    } else {
        robot.typeString(key);
    }
}

function handleInputPayload(body) {
    if (!body) {
        throw new Error('Payload inválido');
    }

    const { combo, key, action } = body;

    if (Array.isArray(combo) && combo.length) {
        handleComboInput(combo);
        return;
    }

    if (key && action) {
        handleKeyAction(key, action);
        return;
    }

    handleCharacterInput(body);
}

server.post('/teclear', (req, res) => {
    try {
        handleInputPayload(req.body || {});
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al teclear');
    }
});

server.get('/reiniciarApp', (req, res) => {
    app.relaunch();
    app.quit();
});

server.get('/cerrarApp', (req, res) => {
    app.quit();
});

server.get('/ocultarApp', (req, res) => {
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            queue.push(async () => {
                mainWindow.hide();
            });
        }
    }
});

server.get('/mostrarApp', (req, res) => {
    if (mainWindow) {
        if (!mainWindow.isVisible()) {
            //mainWindow.show();
            queue.push(async () => {
                mainWindow.show();
            });
        }
    }
});


function r_icons(type) {
    return `/static/img/icons/${type}.png`;
}

function f_html(type, name, path) {
    let classFile = "";
    if (type === 'folder') {
        classFile = "event_folder";
    } else {
        classFile = "event_file";
    }
    return `
    <div class="itm">
        <div class="${classFile}" data-path="${path}">
            <img src="${r_icons(type)}">
            ${name}
        </div>
    </div>
    `;
}

function leer_directorio(directorio, ignorar = []) {
    let html = '';
    try {
        const archivos = fs.readdirSync(directorio, { withFileTypes: true });
        for (const archivo of archivos) {
            if (!ignorar.includes(archivo.name)) {
                const filePath = path.join(directorio, archivo.name);
                if (archivo.isDirectory()) {
                    html += f_html('folder', archivo.name, filePath + '/');
                } else {
                    let extension = path.extname(archivo.name);
                    if (extension.startsWith('.')) {
                        extension = extension.slice(1); // Quitar el punto de la extensión
                    }
                    html += f_html(extension || 'file', archivo.name, filePath);
                }
            }
        }
    } catch (error) {
        console.error(`Error al leer el directorio ${directorio}:`, error);
    }
    return html;
}

function getWindowsDrives() {
    try {
        const stdout = execSync(
            'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"',
            { encoding: 'utf8' }
        );

        const drives = stdout
            .split(/\r?\n/)
            .map(value => value.trim())
            .filter(value => /^[A-Za-z]:\\?$/.test(value))
            .map(value => value.replace(/\\$/, ''));

        if (drives.length) {
            return Array.from(new Set(drives));
        }
    } catch (error) {
        console.error('Error al listar discos con PowerShell:', error.message);
    }

    const fallback = [];
    for (let code = 65; code <= 90; code += 1) {
        const drive = `${String.fromCharCode(code)}:`;
        if (fs.existsSync(`${drive}\\`)) {
            fallback.push(drive);
        }
    }
    return fallback;
}

server.get('/leerDirectorio', (req, res) => {
    let dirPath = req.query.path;
    if (dirPath === '/') {
        if (isWindows) {
            const drives = getWindowsDrives();
            if (!drives.length) {
                return res.status(500).send('Error al listar discos');
            }
            const data = drives.map(drive => f_html('folder', drive, `${drive}/`)).join('');
            return res.send(data);
        }

        if (!fs.existsSync('/')) {
            return res.status(404).send('El directorio no existe');
        }

        const data = leer_directorio('/');
        return res.send(data);
    } else if (fs.existsSync(dirPath)) {
        if (fs.statSync(dirPath).isDirectory()) {
            let data = leer_directorio(dirPath);
            res.send(data);
        } else {
            res.status(400).send('No es un directorio');
        }
    } else {
        res.status(404).send('El directorio no existe');
    }
});

function listDirectoryEntries(dirPath) {
    const entries = [];
    const directoryItems = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of directoryItems) {
        const absolutePath = path.join(dirPath, item.name);
        entries.push({
            name: item.name,
            path: absolutePath,
            type: item.isDirectory() ? 'folder' : 'file'
        });
    }

    entries.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return entries;
}

server.get('/leerDirectorioTransfer', (req, res) => {
    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '/';

    if (requestedPath === '/') {
        if (isWindows) {
            const drives = getWindowsDrives();
            if (!drives.length) {
                return res.status(500).send({ error: 'Error al listar discos' });
            }

            const entries = drives.map(drive => ({
                name: drive,
                path: `${drive}${path.sep}`,
                type: 'folder'
            }));

            return res.send({
                currentPath: '/',
                parentPath: null,
                entries
            });
        }

        if (!fs.existsSync('/')) {
            return res.status(404).send({ error: 'El directorio no existe' });
        }

        try {
            const entries = listDirectoryEntries('/');
            return res.send({
                currentPath: '/',
                parentPath: null,
                entries
            });
        } catch (error) {
            console.error('Error al leer el directorio raíz:', error);
            return res.status(500).send({ error: 'Error al leer el directorio' });
        }
    }

    if (!fs.existsSync(requestedPath)) {
        return res.status(404).send({ error: 'El directorio no existe' });
    }

    if (!fs.statSync(requestedPath).isDirectory()) {
        return res.status(400).send({ error: 'No es un directorio' });
    }

    try {
        const entries = listDirectoryEntries(requestedPath);
        const normalizedPath = path.normalize(requestedPath);
        const parentPath = path.dirname(normalizedPath);
        const hasParent = parentPath && parentPath !== normalizedPath;

        return res.send({
            currentPath: requestedPath,
            parentPath: hasParent ? parentPath : null,
            entries
        });
    } catch (error) {
        console.error('Error al leer el directorio para transferencia:', error);
        return res.status(500).send({ error: 'Error al leer el directorio' });
    }
});

server.get('/descargarArchivo', (req, res) => {
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';

    if (!filePath) {
        return res.status(400).send({ error: 'La ruta del archivo es requerida' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send({ error: 'El archivo no existe' });
    }

    if (!fs.statSync(filePath).isFile()) {
        return res.status(400).send({ error: 'La ruta no corresponde a un archivo' });
    }

    return res.download(filePath, path.basename(filePath), (error) => {
        if (error && !res.headersSent) {
            console.error('Error al descargar archivo:', error);
            res.status(500).send({ error: 'No se pudo descargar el archivo' });
        }
    });
});

function mover_archivo(archivo, destino) {
    fs.rename(archivo, path.join(destino, path.basename(archivo)), (error) => {
        if (error) {
            console.error('Error al mover el archivo:', error);
        }
    });
}

server.post('/moverArchivo', (req, res) => {
    const { archivo, destino } = req.body;
    if (!fs.existsSync(archivo)) {
        res.status(404).send({ error: 'El archivo no existe' });
        return;
    }
    if (!fs.existsSync(destino)) {
        res.status(404).send({ error: 'El destino no existe' });
        return;
    }
    mover_archivo(archivo, destino);
    res.send({ status: 'ok' });
});

async function openWeb(url) {
    const open = (await import('open')).default; // Importación dinámica de `open`
    await open(url);
}

server.post('/abrirUrl', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send({ error: 'La URL es requerida' });
    }

    try {
        await openWeb(url);
        res.send({ status: 'ok' });
    } catch (err) {
        console.error('Error al abrir la URL:', err);
        res.status(500).send({ error: 'No se pudo abrir la URL' });
    }
});

server.post('/abrirAplicacion', (req, res) => {
    let { aplicacion } = req.body;

    if (!aplicacion) {
        return res.status(400).send({ error: 'La aplicación es requerida' });
    }

    // Verificar si el archivo existe
    if (!fs.existsSync(aplicacion)) {
        return res.status(404).send({ error: 'La aplicación no existe en la ruta especificada' });
    }

    try {
        const result = shell.openPath(aplicacion);
        if (result) {
            console.error('Error al abrir la aplicación:', result);
            return res.status(500).send({ error: 'No se pudo abrir la aplicación' });
        }
    } catch (error) {
        console.error('Error al abrir la aplicación:', error);
        res.status(500).send({ error: 'No se pudo abrir la aplicación' });
    }
});

server.get('/getAplicaciones', async (req, res) => {
    try {
        const aplicaciones = await db.getApps();
        res.send(aplicaciones);
    } catch (error) {
        console.error('Error al obtener las aplicaciones:', error);
        res.status(500).send({ error: 'Error al obtener las aplicaciones' });
    }
});

server.post('/transferirArchivo', upload.single('archivo'), (req, res) => {
    const { path: destino } = req.body; // Ruta de destino
    const archivo = req.file; // Archivo cargado

    if (!archivo || !destino) {
        return res.status(400).send({ error: 'El archivo y la ruta de destino son requeridos' });
    }

    try {
        const destinoPath = path.join(destino, archivo.originalname);

        // Crear la carpeta de destino si no existe
        if (!fs.existsSync(destino)) {
            fs.mkdirSync(destino, { recursive: true });
        }

        // Copiar el archivo al destino
        fs.copyFileSync(archivo.path, destinoPath);

        // Eliminar el archivo original
        fs.unlinkSync(archivo.path);

        res.send({ status: 'ok', message: 'Archivo transferido correctamente', path: destinoPath });
    } catch (error) {
        console.error('Error al transferir el archivo:', error);
        res.status(500).send({
            error: 'Error al transferir el archivo',
            details: error.message
        });
    }
});



// =============================================
// ENDPOINTS PARA CONTROL DEL MOUSE NATIVO
// =============================================

// Mover mouse de manera RELATIVA (como touchpad)
server.post('/mouse/move', (req, res) => {
    const { dx, dy } = req.body;

    if (typeof dx !== 'number' || typeof dy !== 'number') {
        return res.status(400).send({ error: 'dx y dy deben ser números' });
    }

    try {
        if (nativeInput) {
            // Usar módulo nativo (más rápido y preciso)
            nativeInput.moveRelative(dx, dy);
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            // Fallback a robotjs
            const currentPos = robot.getMousePos();
            robot.moveMouse(currentPos.x + dx, currentPos.y + dy);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al mover el mouse');
    }
});

// Click
server.post('/mouse/click', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.click(button);
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            robot.mouseClick(button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al hacer click');
    }
});

// Doble click
server.post('/mouse/doubleclick', (req, res) => {
    try {
        if (nativeInput) {
            nativeInput.doubleClick();
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            robot.mouseClick('left', true); // true = double click
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al hacer doble click');
    }
});

// Scroll
server.post('/mouse/scroll', (req, res) => {
    const { delta } = req.body;

    if (typeof delta !== 'number') {
        return res.status(400).send({ error: 'delta debe ser un número' });
    }

    try {
        if (nativeInput) {
            nativeInput.scroll(delta);
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            robot.scrollMouse(0, delta > 0 ? 1 : -1);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al hacer scroll');
    }
});

server.get('/mouse/config', async (req, res) => {
    try {
        const config = await settingsStore.getMouseConfig();
        res.send(config);
    } catch (error) {
        console.error('Error al obtener la configuración del mouse:', error);
        res.status(500).send({ error: 'No se pudo obtener la configuración del mouse' });
    }
});

server.post('/mouse/config', async (req, res) => {
    const { pointerSpeed, scrollSpeed } = req.body;

    const pointerValue = Number(pointerSpeed);
    const scrollValue = Number(scrollSpeed);

    if (!Number.isFinite(pointerValue) || !Number.isFinite(scrollValue)) {
        return res.status(400).send({ error: 'Los valores enviados no son válidos' });
    }

    const clampedPointer = Math.min(MOUSE_POINTER_MAX, Math.max(MOUSE_POINTER_MIN, pointerValue));
    const clampedScroll = Math.min(MOUSE_SCROLL_MAX, Math.max(MOUSE_SCROLL_MIN, scrollValue));

    try {
        const config = await settingsStore.saveMouseConfig(clampedPointer, clampedScroll);
        res.send(config);
    } catch (error) {
        console.error('Error al guardar la configuración del mouse:', error);
        res.status(500).send({ error: 'No se pudo guardar la configuración del mouse' });
    }
});

// Obtener posición actual del mouse
server.get('/mouse/position', (req, res) => {
    try {
        let position;
        if (nativeInput) {
            position = nativeInput.getPosition();
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            position = robot.getMousePos();
        }
        res.send({ position });
    } catch (error) {
        sendInputError(res, error, 'Error al obtener posición del mouse');
    }
});

// Mouse down (mantener presionado)
server.post('/mouse/down', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.mouseDown(button);
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            robot.mouseToggle('down', button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al presionar botón del mouse');
    }
});

// Mouse up (soltar botón)
server.post('/mouse/up', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.mouseUp(button);
        } else {
            if (!hasRobotFallback()) {
                throw new Error(INPUT_PROVIDER_UNAVAILABLE_MSG);
            }
            robot.mouseToggle('up', button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        sendInputError(res, error, 'Error al soltar botón del mouse');
    }
});


server.post('/AddAplicacion', async (req, res) => {
    try {
        const { name, path: appPath, type, icon } = req.body;

        // Validar los datos
        if (!name || !appPath || !type || !icon) {
            return res.status(400).send({ error: 'Todos los campos son obligatorios' });
        }

        // Verificar si la aplicación ya existe
        const existingApp = await db.getAppByName(name);
        if (existingApp) {
            return res.status(400).send({ error: 'La aplicación ya existe' });
        }

        // Insertar en la base de datos
        const result = await db.insertApp(name, appPath, icon, type);
        res.send({ status: 'ok', id: result.id });
    } catch (error) {
        console.error('Error al agregar la aplicación:', error);
        res.status(500).send({
            error: 'Error al agregar la aplicación',
            details: error.message
        });
    }
});