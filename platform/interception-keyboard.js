const INTERCEPTION_RELEASES_URL = 'https://github.com/oblitum/Interception/releases/';

const EXTENDED_KEYS = new Set(['numpadenter', 'numpaddivide']);

const SCAN_CODE_MAP = new Map([
    ['backspace', 0x0E],
    ['tab', 0x0F],
    ['enter', 0x1C],
    ['return', 0x1C],
    ['esc', 0x01],
    ['escape', 0x01],
    ['space', 0x39],
    ['delete', 0x53],
    ['del', 0x53],
    ['insert', 0x52],
    ['home', 0x47],
    ['end', 0x4F],
    ['pageup', 0x49],
    ['pagedown', 0x51],
    ['up', 0x48],
    ['down', 0x50],
    ['left', 0x4B],
    ['right', 0x4D],
    ['capslock', 0x3A],
    ['numlock', 0x45],
    ['scrolllock', 0x46],
    ['printscreen', 0x37],
    ['pause', 0x45],
    ['pausebreak', 0x45],
    ['numpad0', 0x52],
    ['numpad1', 0x4F],
    ['numpad2', 0x50],
    ['numpad3', 0x51],
    ['numpad4', 0x4B],
    ['numpad5', 0x4C],
    ['numpad6', 0x4D],
    ['numpad7', 0x47],
    ['numpad8', 0x48],
    ['numpad9', 0x49],
    ['numpadadd', 0x4E],
    ['numpadsubtract', 0x4A],
    ['numpadmultiply', 0x37],
    ['numpaddivide', 0x35],
    ['numpaddecimal', 0x53],
    ['numpadenter', 0x1C],
    ['ctrl', 0x1D],
    ['control', 0x1D],
    ['lcontrol', 0x1D],
    ['shift', 0x2A],
    ['lshift', 0x2A],
    ['alt', 0x38],
    ['lalt', 0x38],
    ['meta', 0x5B],
    ['lmeta', 0x5B],
    ['win', 0x5B],
    ['rctrl', 0x1D],
    ['rcontrol', 0x1D],
    ['rshift', 0x36],
    ['ralt', 0x38],
    ['rmeta', 0x5C],
    ['rwin', 0x5C],
    ['f1', 0x3B],
    ['f2', 0x3C],
    ['f3', 0x3D],
    ['f4', 0x3E],
    ['f5', 0x3F],
    ['f6', 0x40],
    ['f7', 0x41],
    ['f8', 0x42],
    ['f9', 0x43],
    ['f10', 0x44],
    ['f11', 0x57],
    ['f12', 0x58]
]);

for (const [letter, code] of [
    ['a', 0x1E], ['b', 0x30], ['c', 0x2E], ['d', 0x20], ['e', 0x12], ['f', 0x21],
    ['g', 0x22], ['h', 0x23], ['i', 0x17], ['j', 0x24], ['k', 0x25], ['l', 0x26],
    ['m', 0x32], ['n', 0x31], ['o', 0x18], ['p', 0x19], ['q', 0x10], ['r', 0x13],
    ['s', 0x1F], ['t', 0x14], ['u', 0x16], ['v', 0x2F], ['w', 0x11], ['x', 0x2D],
    ['y', 0x15], ['z', 0x2C]
]) {
    SCAN_CODE_MAP.set(letter, code);
}
for (let i = 0; i <= 9; i += 1) {
    SCAN_CODE_MAP.set(String(i), 0x02 + i);
}

let interceptionModule = null;
let interceptionInstance = null;
let lastProbe = null;

function loadInterceptionModule() {
    if (process.platform !== 'win32') {
        return null;
    }
    if (interceptionModule) {
        return interceptionModule;
    }
    try {
        interceptionModule = require('node-interception');
        return interceptionModule;
    } catch (error) {
        interceptionModule = false;
        return null;
    }
}

function getKeyboardDevice() {
    const lib = loadInterceptionModule();
    if (!lib) {
        return null;
    }

    if (!interceptionInstance || interceptionInstance.isDestroyed()) {
        interceptionInstance = new lib.Interception();
    }

    const keyboards = interceptionInstance.getKeyboards();
    return keyboards.length > 0 ? keyboards[0] : null;
}

function probeDriver() {
    if (process.platform !== 'win32') {
        lastProbe = {
            ready: false,
            packageAvailable: false,
            keyboardCount: 0,
            message: 'Interception solo aplica en Windows.'
        };
        return lastProbe;
    }

    const lib = loadInterceptionModule();
    if (!lib) {
        lastProbe = {
            ready: false,
            packageAvailable: false,
            keyboardCount: 0,
            message: 'El módulo node-interception no está disponible en esta instalación.'
        };
        return lastProbe;
    }

    let instance = null;
    try {
        instance = new lib.Interception();
        const keyboardCount = instance.getKeyboards().length;
        const ready = keyboardCount > 0;
        lastProbe = {
            ready,
            packageAvailable: true,
            keyboardCount,
            message: ready
                ? `Driver Interception detectado (${keyboardCount} teclado(s)).`
                : 'Interception no detectado. Instala el driver desde GitHub y reinicia solo la primera vez.'
        };
        return lastProbe;
    } catch (error) {
        lastProbe = {
            ready: false,
            packageAvailable: true,
            keyboardCount: 0,
            message: `No se pudo contactar el driver Interception: ${error.message}`
        };
        return lastProbe;
    } finally {
        if (instance && !instance.isDestroyed()) {
            instance.destroy();
        }
        interceptionInstance = null;
    }
}

function getLastProbe() {
    return lastProbe || probeDriver();
}

function buildKeyState(keyDown, extended) {
    const { KeyState } = loadInterceptionModule();
    if (extended) {
        return keyDown ? KeyState.E0 : KeyState.E1;
    }
    return keyDown ? KeyState.DOWN : KeyState.UP;
}

function resolveScanCode(key) {
    const normalized = String(key || '').toLowerCase();
    if (!normalized) {
        return null;
    }
    if (SCAN_CODE_MAP.has(normalized)) {
        return SCAN_CODE_MAP.get(normalized);
    }
    if (normalized.length === 1) {
        return SCAN_CODE_MAP.get(normalized) ?? null;
    }
    return null;
}

function sendScanCode(scanCode, keyDown, extended = false) {
    const keyboard = getKeyboardDevice();
    if (!keyboard) {
        throw new Error('Driver Interception no disponible.');
    }

    const state = buildKeyState(keyDown, extended);
    const sent = keyboard.send({
        type: 'keyboard',
        code: scanCode,
        state,
        information: 0
    });

    if (!sent) {
        throw new Error('Interception no pudo enviar la tecla.');
    }
}

function sendKey(key, keyDown) {
    const normalized = String(key || '').toLowerCase();
    const scanCode = resolveScanCode(normalized);
    if (scanCode === null) {
        throw new Error(`Tecla no soportada por Interception: ${key}`);
    }
    sendScanCode(scanCode, keyDown, EXTENDED_KEYS.has(normalized));
}

function keyTap(key) {
    sendKey(key, true);
    sendKey(key, false);
}

function keyDown(key) {
    sendKey(key, true);
}

function keyUp(key) {
    sendKey(key, false);
}

function keyCombo(keys) {
    const normalized = keys.map((key) => String(key || '').toLowerCase()).filter(Boolean);
    if (!normalized.length) {
        throw new Error('Combo inválido');
    }

    const modifiers = normalized.slice(0, -1);
    const mainKey = normalized[normalized.length - 1];

    try {
        modifiers.forEach((key) => {
            keyDown(key);
        });
        keyTap(mainKey);
    } finally {
        for (let i = modifiers.length - 1; i >= 0; i -= 1) {
            keyUp(modifiers[i]);
        }
    }
}

function typeText(text) {
    const value = String(text || '');
    for (const char of value) {
        const lower = char.toLowerCase();
        const needsShift = char !== lower && char.toUpperCase() === char;
        if (needsShift) {
            keyDown('shift');
        }
        keyTap(lower);
        if (needsShift) {
            keyUp('shift');
        }
    }
}

function destroy() {
    if (interceptionInstance && !interceptionInstance.isDestroyed()) {
        interceptionInstance.destroy();
    }
    interceptionInstance = null;
}

module.exports = {
    INTERCEPTION_RELEASES_URL,
    probeDriver,
    getLastProbe,
    isSupported: () => process.platform === 'win32',
    isPackageAvailable: () => Boolean(loadInterceptionModule()),
    isDriverReady: () => getLastProbe().ready,
    keyTap,
    keyDown,
    keyUp,
    keyCombo,
    typeText,
    destroy
};
