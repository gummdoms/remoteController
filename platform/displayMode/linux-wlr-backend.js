const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const backendName = 'linux-wlr-randr';
const isLinux = process.platform === 'linux';
const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
const hasDisplay = Boolean(process.env.WAYLAND_DISPLAY) || Boolean(process.env.DISPLAY);
let hasCommand = false;

if (isLinux && sessionType === 'wayland' && hasDisplay) {
    try {
        execFileSync('which', ['wlr-randr'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const unavailableReason = 'Instala wlr-randr (wlroots) para controlar las pantallas en sesiones Wayland.';

function isSupported() {
    return isLinux && sessionType === 'wayland' && hasDisplay && hasCommand;
}

function parseOutputs(raw) {
    const outputs = [];
    const lines = raw.split(/\r?\n/);
    let current = null;
    lines.forEach((line) => {
        if (!line.trim()) {
            return;
        }
        if (!/^\s/.test(line)) {
            if (current) {
                outputs.push(current);
            }
            const match = line.match(/^(\S+)\s+"([^"]+)"\s*(.*)$/);
            if (!match) {
                current = null;
                return;
            }
            const [, name, description, status] = match;
            const disconnected = /disconnected/i.test(status);
            current = {
                name,
                description,
                connected: !disconnected,
                enabled: !/disabled/i.test(status),
                primary: /primary/i.test(status),
                position: { x: 0, y: 0 },
                currentMode: null,
                width: null,
                height: null
            };
            return;
        }
        if (!current) {
            return;
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('Enabled:')) {
            current.enabled = /yes|true/i.test(trimmed);
            return;
        }
        if (trimmed.startsWith('Primary:')) {
            current.primary = /yes|true/i.test(trimmed);
            return;
        }
        if (trimmed.startsWith('Position:')) {
            const match = trimmed.match(/Position:\s*(\d+),(\d+)/i);
            if (match) {
                current.position = { x: Number(match[1]), y: Number(match[2]) };
            }
            return;
        }
        const modeMatch = trimmed.match(/(\d+)x(\d+)@([\d.]+)Hz.*\(current\)/i);
        if (modeMatch) {
            current.currentMode = `${modeMatch[1]}x${modeMatch[2]}@${modeMatch[3]}`;
            current.width = Number(modeMatch[1]);
            current.height = Number(modeMatch[2]);
            return;
        }
        const preferredMatch = trimmed.match(/(\d+)x(\d+)@([\d.]+)Hz.*\(preferred\)/i);
        if (preferredMatch && !current.currentMode) {
            current.currentMode = `${preferredMatch[1]}x${preferredMatch[2]}@${preferredMatch[3]}`;
            current.width = Number(preferredMatch[1]);
            current.height = Number(preferredMatch[2]);
        }
    });
    if (current) {
        outputs.push(current);
    }
    return outputs.filter((output) => output.connected);
}

async function listOutputs() {
    const { stdout } = await execFileAsync('wlr-randr', []);
    return parseOutputs(stdout);
}

function guessInternal(outputs) {
    return outputs.find((output) => /eDP|LVDS|DSI/i.test(output.name)) || outputs.find((output) => output.primary) || outputs[0];
}

function guessSecondary(outputs, primary) {
    return outputs.find((output) => output.name !== primary.name);
}

function buildOutputArgs(configs) {
    const args = [];
    configs.forEach((cfg) => {
        args.push('--output', cfg.name);
        if (!cfg.on) {
            args.push('--off');
            return;
        }
        args.push('--on');
        if (typeof cfg.x === 'number' && typeof cfg.y === 'number') {
            args.push('--pos', `${cfg.x},${cfg.y}`);
        }
        if (cfg.mode) {
            args.push('--mode', cfg.mode);
        }
        if (cfg.scale) {
            args.push('--scale', String(cfg.scale));
        }
    });
    return args;
}

async function applyConfigs(configs) {
    if (!configs.length) {
        throw new Error('No hay salidas disponibles para configurar.');
    }
    const args = buildOutputArgs(configs);
    await execFileAsync('wlr-randr', args);
}

async function setModeInternal(outputs, primary) {
    const configs = outputs.map((output) => {
        if (output.name === primary.name) {
            return { name: output.name, on: true, x: 0, y: 0, mode: output.currentMode };
        }
        return { name: output.name, on: false };
    });
    await applyConfigs(configs);
}

async function setModeExternal(outputs, primary, secondary) {
    if (!secondary) {
        throw new Error('No se detectó un monitor externo para activar.');
    }
    const configs = outputs.map((output) => {
        if (output.name === secondary.name) {
            return { name: output.name, on: true, x: 0, y: 0, mode: output.currentMode };
        }
        return { name: output.name, on: false };
    });
    await applyConfigs(configs);
}

async function setModeClone(outputs, primary, secondary) {
    if (!secondary) {
        throw new Error('Se requiere un segundo monitor para duplicar.');
    }
    const configs = outputs.map((output) => {
        const on = output.name === primary.name || output.name === secondary.name;
        return {
            name: output.name,
            on,
            x: 0,
            y: 0,
            mode: output.currentMode
        };
    });
    await applyConfigs(configs);
}

async function setModeExtend(outputs, primary, secondary) {
    if (!secondary) {
        throw new Error('Se requiere un segundo monitor para extender.');
    }
    const offset = primary.width || 0;
    const configs = outputs.map((output) => {
        if (output.name === primary.name) {
            return { name: output.name, on: true, x: 0, y: 0, mode: output.currentMode };
        }
        if (output.name === secondary.name) {
            return { name: output.name, on: true, x: offset, y: 0, mode: output.currentMode };
        }
        return { name: output.name, on: false };
    });
    await applyConfigs(configs);
}

async function setMode(mode) {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    const outputs = await listOutputs();
    if (!outputs.length) {
        throw new Error('No se detectaron monitores con wlr-randr.');
    }
    const primary = guessInternal(outputs);
    const secondary = guessSecondary(outputs, primary);
    switch (mode) {
        case 'internal':
            await setModeInternal(outputs, primary);
            break;
        case 'external':
            await setModeExternal(outputs, primary, secondary);
            break;
        case 'clone':
            await setModeClone(outputs, primary, secondary);
            break;
        case 'extend':
            await setModeExtend(outputs, primary, secondary);
            break;
        default:
            throw new Error(`Modo desconocido: ${mode}`);
    }
}

function inferMode(outputs) {
    const enabled = outputs.filter((output) => output.enabled);
    if (!enabled.length) {
        return 'unknown';
    }
    if (enabled.length === 1) {
        return /eDP|LVDS|DSI/i.test(enabled[0].name) ? 'internal' : 'external';
    }
    const positions = new Set(enabled.map((output) => `${output.position?.x || 0},${output.position?.y || 0}`));
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
        console.warn('No se pudo obtener estado de pantallas con wlr-randr:', error.message);
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
