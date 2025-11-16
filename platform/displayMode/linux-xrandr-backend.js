const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const backendName = 'linux-xrandr';
const isLinux = process.platform === 'linux';
const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
const hasDisplay = Boolean(process.env.DISPLAY);
let hasCommand = false;

if (isLinux && hasDisplay && sessionType !== 'wayland') {
    try {
        execFileSync('which', ['xrandr'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const unavailableReason = 'Instala xrandr y ejecuta la aplicación en una sesión X11 para controlar los modos de pantalla.';

function isSupported() {
    return isLinux && hasDisplay && sessionType !== 'wayland' && hasCommand;
}

async function listOutputs() {
    const { stdout } = await execFileAsync('xrandr', ['--query']);
    const outputs = [];
    const lines = stdout.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const match = line.match(/^(\S+)\s+(connected|disconnected)(?:\s+primary)?\s*(\d+x\d+\+\d+\+\d+)?/);
        if (!match) {
            continue;
        }
        const [, name, status] = match;
        if (status !== 'connected') {
            continue;
        }
        const primary = /\sprimary\s/.test(rawLine);
        const geometryMatch = rawLine.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
        const geometry = geometryMatch ? {
            width: Number(geometryMatch[1]),
            height: Number(geometryMatch[2]),
            x: Number(geometryMatch[3]),
            y: Number(geometryMatch[4])
        } : null;
        outputs.push({ name, primary, geometry });
    }
    return outputs;
}

function selectPrimaryAndSecondary(outputs) {
    if (!outputs.length) {
        return { primary: null, secondary: null };
    }
    const internal = outputs.find((output) => /eDP|LVDS|DSI/i.test(output.name));
    const primary = internal || outputs.find((output) => output.primary) || outputs[0];
    const secondary = outputs.find((output) => output.name !== primary.name);
    return { primary, secondary };
}

function buildDisableArgs(outputs, excludeNames) {
    const args = [];
    outputs.forEach((output) => {
        if (!excludeNames.includes(output.name)) {
            args.push('--output', output.name, '--off');
        }
    });
    return args;
}

async function setModeInternal(primary, outputs) {
    const args = ['--output', primary.name, '--auto', '--primary'];
    args.push(...buildDisableArgs(outputs, [primary.name]));
    await execFileAsync('xrandr', args);
}

async function setModeExternal(primary, secondary, outputs) {
    const args = ['--output', secondary.name, '--auto', '--primary'];
    args.push('--output', primary.name, '--off');
    args.push(...buildDisableArgs(outputs, [primary.name, secondary.name]));
    await execFileAsync('xrandr', args);
}

async function setModeClone(primary, secondary, outputs) {
    const args = [
        '--output', primary.name, '--auto', '--primary',
        '--output', secondary.name, '--auto', '--same-as', primary.name
    ];
    args.push(...buildDisableArgs(outputs, [primary.name, secondary.name]));
    await execFileAsync('xrandr', args);
}

async function setModeExtend(primary, secondary, outputs) {
    const args = [
        '--output', primary.name, '--auto', '--primary',
        '--output', secondary.name, '--auto', '--right-of', primary.name
    ];
    args.push(...buildDisableArgs(outputs, [primary.name, secondary.name]));
    await execFileAsync('xrandr', args);
}

async function setMode(mode) {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    const outputs = await listOutputs();
    const { primary, secondary } = selectPrimaryAndSecondary(outputs);
    if (!primary) {
        throw new Error('No se detectó ningún monitor conectado.');
    }
    if ((mode === 'external' || mode === 'clone' || mode === 'extend') && !secondary) {
        throw new Error('Se requiere un segundo monitor para este modo.');
    }
    switch (mode) {
        case 'internal':
            await setModeInternal(primary, outputs);
            break;
        case 'external':
            await setModeExternal(primary, secondary, outputs);
            break;
        case 'clone':
            await setModeClone(primary, secondary, outputs);
            break;
        case 'extend':
            await setModeExtend(primary, secondary, outputs);
            break;
        default:
            throw new Error(`Modo desconocido: ${mode}`);
    }
}

function inferMode(outputs) {
    const active = outputs.filter((output) => output.geometry);
    if (!active.length) {
        return 'unknown';
    }
    if (active.length === 1) {
        return active[0].primary ? 'internal' : 'external';
    }
    const positions = new Set(active.map((output) => {
        if (!output.geometry) {
            return `${output.name}-none`;
        }
        return `${output.geometry.x},${output.geometry.y}`;
    }));
    if (positions.size === 1) {
        return 'clone';
    }
    return 'extend';
}

async function getState() {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    try {
        const outputs = await listOutputs();
        return { mode: inferMode(outputs), legacyCode: null };
    } catch (error) {
        console.warn('No se pudo obtener estado de pantallas con xrandr:', error.message);
        return { mode: 'unknown', legacyCode: null };
    }
}

module.exports = {
    name: backendName,
    isSupported,
    getUnavailableReason: () => unavailableReason,
    setMode,
    getState
};
