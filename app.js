const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, shell } = require('electron');
const express = require('express');
const bodyParser = require('body-parser');
const ddcci = require("@hensm/ddcci");
//const audio = require('win-audio').speaker;
const loudness = require('loudness');
const path = require('path');
const { exec } = require('child_process');
const asyncQueue = require('async'); // Para manejar la cola de tareas
const fs = require('fs');
const robot = require('robotjs');
const cors = require('cors');
const multer = require('multer');
const connApps = require('./classes/Apps.js');

// Importar módulo nativo de control de entradas (mouse/teclado)
let nativeInput;
try {
    nativeInput = require('./modules');
    console.log('✅ Módulo nativo de entradas cargado correctamente');
} catch (error) {
    console.warn('⚠️ No se pudo cargar el módulo nativo de entradas. Usando robotjs como fallback.');
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

const queue = asyncQueue.queue(async (task, callback) => {
    try {
        await task();
    } catch (error) {
        console.error('Error al ejecutar la tarea:', error);
    } finally {
        callback();
    }
}, 1);
const getMonitorListSafe = () => {
    try {
        return ddcci.getMonitorList();
    } catch (error) {
        console.warn('No se pudo obtener la lista de monitores DDC/CI:', error.message);
        return [];
    }
};

async function ajustarBrillo(brillo) {
    for (const monitor of getMonitorListSafe()) {
        try {
            await ddcci.setBrightness(monitor, brillo);
        } catch (error) {
            console.warn(`No se pudo ajustar el brillo del monitor ${monitor}:`, error.message);
        }
    }
}

async function brilloActual() {
    const valores = [];
    for (const monitor of getMonitorListSafe()) {
        try {
            valores.push(await ddcci.getBrightness(monitor));
        } catch (error) {
            console.warn(`No se pudo obtener el brillo del monitor ${monitor}:`, error.message);
        }
    }
    return valores;
}

async function ajustarContraste(contraste) {
    for (const monitor of getMonitorListSafe()) {
        try {
            await ddcci.setContrast(monitor, contraste);
        } catch (error) {
            console.warn(`No se pudo ajustar el contraste del monitor ${monitor}:`, error.message);
        }
    }
}

async function contrasteActual() {
    const valores = [];
    for (const monitor of getMonitorListSafe()) {
        try {
            valores.push(await ddcci.getContrast(monitor));
        } catch (error) {
            console.warn(`No se pudo obtener el contraste del monitor ${monitor}:`, error.message);
        }
    }
    return valores;
}


let mainWindow;
let tray = null;
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
        { label: 'Ver App', click: () => { mainWindow.show(); } },
        { label: 'Salir', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Remote Controller');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });
};

app.whenReady().then(() => {
    createWindow();
    createTray();
});

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
const server = express();
server.use(cors()); // Usa cors para habilitar CORS en todas las rutas
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(express.json());
server.listen(4800, () => {
    console.log('Servidor en el puerto 4800');
});
//pagina de inicio *//los htmls se encuentran en la carpeta views
server.use(express.static(path.join(__dirname, 'views')));
server.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
server.use('/static', express.static(path.join(__dirname, 'static')));
//usar tambien ../dashboard/img/icons/ para los iconos de las carpetas y archivos pero no esta en la raiz del proyecto esta otro nivel atras
server.use('/dashboard/img/icons', express.static(path.join(__dirname, '../dashboard/img/icons')));
server.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
server.get('/brillo', async (req, res) => {
    const valores = await brilloActual();
    if (!valores.length) {
        res.status(503).send({ error: 'No se pudo leer el brillo de los monitores' });
        return;
    }
    res.send({ brillo: valores[0], lista: valores });
});

server.post('/brillo', (req, res) => {
    let brillo = parseInt(req.body.brillo);
    if (isNaN(brillo) || brillo < 0 || brillo > 100) {
        res.status(400).send({ error: 'El brillo debe ser un número entre 0 y 100' });
        return;
    }
    queue.push(async () => {
        await ajustarBrillo(brillo);
    });
    res.send({ status: 'ok' });
});

server.get('/contraste', async (req, res) => {
    const valores = await contrasteActual();
    if (!valores.length) {
        res.status(503).send({ error: 'No se pudo leer el contraste de los monitores' });
        return;
    }
    res.send({ contraste: valores[0], lista: valores });
});

server.post('/contraste', (req, res) => {
    let contraste = parseInt(req.body.contraste);
    if (isNaN(contraste) || contraste < 0 || contraste > 100) {
        res.status(400).send({ error: 'El contraste debe ser un número entre 0 y 100' });
        return;
    }
    queue.push(async () => {
        await ajustarContraste(contraste);
    });
    res.send({ status: 'ok' });
});

server.get('/monitores', (req, res) => {
    res.send(getMonitorListSafe());
});

async function getVolume() {
    try {
        return await loudness.getVolume();
    } catch (error) {
        console.error('Error al obtener el volumen:', error);
        return null;
    }
}
async function setVolume(vol) {
    try {
        vol = parseInt(vol);
        if (isNaN(vol)) {
            vol = 0;
        } else if (vol < 0) {
            vol = 0;
        } else if (vol > 100) {
            vol = 100;
        }
        await loudness.setVolume(vol);
    } catch (error) {
        console.error('Error al ajustar el volumen:', error);
    }
}
async function setMuted(muted) {
    try {
        await loudness.setMuted(muted);
    } catch (error) {
        console.error('Error al silenciar/des-silenciar el volumen:', error);
    }
}
async function getMuted() {
    try {
        return await loudness.getMuted();
    } catch (error) {
        console.error('Error al obtener el estado de silencio:', error);
        return null;
    }
}
async function setUnmute() {
    try {
        await loudness.setMuted(false);
    } catch (error) {
        console.error('Error al des-silenciar el volumen:', error);
    }
}
server.get('/volumen', async (req, res) => {
    const volumen = await getVolume();
    res.send({ volumen });
});
server.post('/volumen', async (req, res) => {
    await setVolume(req.body.volumen);
    res.send({ status: 'ok' });
});
server.get('/muted', async (req, res) => {
    const muted = await getMuted();
    res.send({ muted });
});

server.post('/muted', async (req, res) => {
    await setMuted(req.body.muted);
    res.send({ status: 'ok' });
});

server.get('/unmute', async (req, res) => {
    await setUnmute();
    res.send({ status: 'ok' });
});

//reproducir audio de la pc para verificacion de audio
server.get('/reproducirSonido', (req, res) => {
    // Envía la señal al proceso de renderizado de Electron para reproducir el sonido
    if (mainWindow) {
        mainWindow.webContents.send('reproducirSonido');
    }
    res.send({ status: 'ok' });
});


//activar solo la pantalla de pc, es decir que el segundo monitor no se active
server.get('/soloPc', (req, res) => {
    //dejar activa solo la pantalla de la pc
    exec('DisplaySwitch.exe /internal', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al activar solo la pantalla de la pc:', error);
            return;
        }
        console.log('Pantalla de la pc activada');
    });
});

//Duplicado de pantalla
server.get('/duplicado', (req, res) => {
    //duplicar pantalla
    exec('DisplaySwitch.exe /clone', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al duplicar pantalla:', error);
            return;
        }
        console.log('Pantalla duplicada');
    });

});

//Extender pantalla
server.get('/extender', (req, res) => {
    //extender pantalla
    exec('DisplaySwitch.exe /extend', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al extender pantalla:', error);
            return;
        }
        console.log('Pantalla extendida');
    });

});

//Mostrar pantalla secundaria
server.get('/mostrarSecundaria', (req, res) => {
    //mostrar pantalla secundaria
    exec('DisplaySwitch.exe /external', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al mostrar pantalla secundaria:', error);
            return;
        }
        console.log('Pantalla secundaria activada');
    });

});

//ver si la pantalla esta ampliada, duplicada, extendida o solo la pc
server.get('/estadoPantalla', (req, res) => {
    const scriptPath = path.join(__dirname, 'GetDisplayState.ps1');
    //verificar si existe el scriptº
    if (!fs.existsSync(scriptPath)) {
        //crearlo
        let dataScript = `
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DisplaySwitch {
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
"@

$primaryMonitor = [DisplaySwitch]::GetSystemMetrics(80)
$otherMonitors = [DisplaySwitch]::GetSystemMetrics(79)

if ($primaryMonitor -eq 0) {
    Write-Output "4500"
} elseif ($otherMonitors -eq 1) {
    Write-Output "4501"
} elseif ($otherMonitors -eq 2) {
    Write-Output "4502"
} elseif ($otherMonitors -ge 3) {
    Write-Output "4503"
} else {
    Write-Output "4600"
}

        `;

        fs.writeFileSync(scriptPath, dataScript);
    }
    exec(`powershell.exe -File "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error('Error al obtener el estado de la pantalla:', error);
            res.status(500).send({ error: 'Error al obtener el estado de la pantalla' });
            return;
        }
        if (stderr) {
            console.error('Stderr:', stderr);
            res.status(500).send({ error: 'Error al obtener el estado de la pantalla' });
            return;
        }
        const estado = stdout.trim();
        console.log('Estado de la pantalla:', estado);
        res.send({ estado });
    });
});

//apagar pc
server.get('/apagar', (req, res) => {
    //apagar pc
    exec('shutdown /s /t 0', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al apagar pc:', error);
            return;
        }
        console.log('Pc apagada');
    });

});

//reiniciar pc
server.get('/reiniciar', (req, res) => {
    //reiniciar pc
    exec('shutdown /r /t 0', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al reiniciar pc:', error);
            return;
        }
        console.log('Pc reiniciada');
    });

});

//cerrar sesion
server.get('/cerrarSesion', (req, res) => {
    //cerrar sesion
    exec('shutdown /l', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al cerrar sesion:', error);
            return;
        }
        console.log('Sesion cerrada');
    });

});

//suspender pc
server.get('/suspender', (req, res) => {
    //suspender pc
    exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', (error, stdout, stderr) => {
        if (error) {
            console.error('Error al suspender pc:', error);
            return;
        }
        console.log('Pc suspendida');
    });

});

const SPECIAL_KEYS = new Set([
    'backspace', 'enter', 'return', 'space', 'tab', 'esc', 'escape',
    'insert', 'delete', 'del', 'home', 'end', 'pageup', 'pagedown',
    'up', 'down', 'left', 'right', 'capslock', 'numlock', 'scrolllock',
    'printscreen', 'pause',
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
    ['mayus', 'shift']
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

    const modifiers = normalized.filter(key => MODIFIER_KEYS.has(key));
    const mainKeys = normalized.filter(key => !MODIFIER_KEYS.has(key));

    if (!mainKeys.length) {
        modifiers.forEach(mod => robot.keyTap(convertRobotKeyName(mod)));
        return;
    }

    const primary = convertRobotKeyName(mainKeys[mainKeys.length - 1]);
    const robotModifiers = modifiers.map(convertRobotKeyName);
    robot.keyTap(primary, robotModifiers);
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
        console.error('Error al teclear:', error);
        res.status(500).send({ error: 'Error al teclear' });
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

server.get('/leerDirectorio', (req, res) => {
    let dirPath = req.query.path;
    if (dirPath === '/') {
        // Listar discos en Windows
        exec('wmic logicaldisk get name', (error, stdout, stderr) => {
            if (error) {
                console.error('Error al listar discos:', error);
                res.status(500).send('Error al listar discos');
                return;
            }
            const drives = stdout.split('\r\r\n').filter(value => /[A-Za-z]:/.test(value));
            let data = drives.map(drive => f_html('folder', drive.trim(), drive.trim() + '/')).join('');
            res.send(data);
        });
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
            // Fallback a robotjs
            const currentPos = robot.getMousePos();
            robot.moveMouse(currentPos.x + dx, currentPos.y + dy);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error moviendo mouse:', error);
        res.status(500).send({ error: 'Error al mover el mouse' });
    }
});

// Click
server.post('/mouse/click', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.click(button);
        } else {
            robot.mouseClick(button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error en click:', error);
        res.status(500).send({ error: 'Error al hacer click' });
    }
});

// Doble click
server.post('/mouse/doubleclick', (req, res) => {
    try {
        if (nativeInput) {
            nativeInput.doubleClick();
        } else {
            robot.mouseClick('left', true); // true = double click
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error en doble click:', error);
        res.status(500).send({ error: 'Error al hacer doble click' });
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
            robot.scrollMouse(0, delta > 0 ? 1 : -1);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error en scroll:', error);
        res.status(500).send({ error: 'Error al hacer scroll' });
    }
});

// Obtener posición actual del mouse
server.get('/mouse/position', (req, res) => {
    try {
        let position;
        if (nativeInput) {
            position = nativeInput.getPosition();
        } else {
            position = robot.getMousePos();
        }
        res.send({ position });
    } catch (error) {
        console.error('Error obteniendo posición:', error);
        res.status(500).send({ error: 'Error al obtener posición del mouse' });
    }
});

// Mouse down (mantener presionado)
server.post('/mouse/down', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.mouseDown(button);
        } else {
            robot.mouseToggle('down', button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error en mouse down:', error);
        res.status(500).send({ error: 'Error al presionar botón del mouse' });
    }
});

// Mouse up (soltar botón)
server.post('/mouse/up', (req, res) => {
    const { button = 'left' } = req.body;

    try {
        if (nativeInput) {
            nativeInput.mouseUp(button);
        } else {
            robot.mouseToggle('up', button);
        }
        res.send({ status: 'ok' });
    } catch (error) {
        console.error('Error en mouse up:', error);
        res.status(500).send({ error: 'Error al soltar botón del mouse' });
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