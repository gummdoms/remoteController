const { execFileSync, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const backendName = 'linux-kscreen';
const isLinux = process.platform === 'linux';
const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
const isKDE = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase().includes('kde') || (process.env.DESKTOP_SESSION || '').toLowerCase().includes('plasma');
let hasCommand = false;
let rememberedPrimaryId = null;
const rememberedGeometry = new Map();

if (isLinux && sessionType === 'wayland' && isKDE) {
    try {
        execFileSync('which', ['kscreen-doctor'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const unavailableReason = 'Instala kscreen (kscreen-doctor) y usa KDE Plasma en Wayland para controlar las pantallas.';

function isSupported() {
    return isLinux && sessionType === 'wayland' && isKDE && hasCommand;
}

function sanitizeOutput(raw) {
    return raw
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/\r/g, '')
        .replace(/[ \t]+Geometry:/g, '\nGeometry:')
        .replace(/[ \t]+Modes:/g, '\nModes:')
        .replace(/[ \t]+Mode:/g, '\nMode:')
        .replace(/[ \t]+Pos:/g, '\nPos:');
}

function hasValidPosition(pos) {
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y);
}

function selectBestByPriority(outputs) {
    if (!outputs?.length) {
        return null;
    }
    return outputs
        .slice()
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))[0] || null;
}

function isCloneLayout(outputs) {
    const positioned = outputs.filter((output) => hasValidPosition(output.pos));
    if (positioned.length < 2) {
        return false;
    }
    const reference = `${positioned[0].pos.x},${positioned[0].pos.y}`;
    return positioned.every((output) => `${output.pos.x},${output.pos.y}` === reference);
}

function rememberGeometry(output, options = {}) {
    const { skipPosition = false } = options;
    if (!output || !output.id) {
        return;
    }
    const entry = rememberedGeometry.get(output.id) || {};
    if (!skipPosition && hasValidPosition(output.pos)) {
        entry.pos = { x: output.pos.x, y: output.pos.y };
    }
    if (output.size?.width && output.size?.height) {
        entry.size = { width: output.size.width, height: output.size.height };
    }
    if (Object.keys(entry).length) {
        rememberedGeometry.set(output.id, entry);
    }
}

function parseModes(line, current) {
    if (!current) {
        return;
    }
    const chunk = line.replace(/^Modes:\s*/i, '');
    const regex = /(\d+):\s*(\d+)x(\d+)@([\d.]+)([*!]+)?/gi;
    let match;
    while ((match = regex.exec(chunk)) !== null) {
        const [, modeId, width, height, refresh, flags = ''] = match;
        if (!flags.includes('*')) {
            continue;
        }
        current.modeId = modeId;
        current.size = { width: Number(width), height: Number(height) };
        current.mode = `${width}x${height}`;
        current.modeName = `${width}x${height}@${refresh}`;
    }
}

function parseOutputs(raw) {
    const outputs = [];
    const lines = sanitizeOutput(raw).split(/\n/);
    let current = null;
    let readingModes = false;

    const flush = () => {
        if (current) {
            outputs.push(current);
        }
        current = null;
        readingModes = false;
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (readingModes) {
                readingModes = false;
            }
            return;
        }

        const legacyMatch = trimmed.match(/^output\.([^.]+)\s*(.*)$/i);
        const modernMatch = trimmed.match(/^output:\s*\d+\s+([^\s]+)(.*)$/i);
        if (legacyMatch || modernMatch) {
            if (current) {
                outputs.push(current);
            }
            const id = legacyMatch ? legacyMatch[1] : modernMatch[1];
            current = {
                id,
                name: id,
                connected: true,
                enabled: true,
                primary: false,
                priority: null,
                pos: { x: 0, y: 0 },
                size: { width: null, height: null },
                mode: null,
                modeName: null,
                modeId: null
            };
            readingModes = false;
            const rest = (legacyMatch ? legacyMatch[2] : modernMatch[2]) || '';
            if (/connected/i.test(rest)) {
                current.connected = true;
            }
            if (/disconnected/i.test(rest)) {
                current.connected = false;
            }
            if (/enabled/i.test(rest)) {
                current.enabled = true;
            }
            if (/disabled/i.test(rest)) {
                current.enabled = false;
            }
            if (/primary/i.test(rest)) {
                current.primary = true;
            }
            return;
        }

        if (!current) {
            return;
        }

        if (/^connected$/i.test(trimmed)) {
            current.connected = true;
            return;
        }
        if (/^disconnected$/i.test(trimmed)) {
            current.connected = false;
            return;
        }
        if (/^enabled$/i.test(trimmed)) {
            current.enabled = true;
            return;
        }
        if (/^disabled$/i.test(trimmed)) {
            current.enabled = false;
            return;
        }
        if (/^primary$/i.test(trimmed)) {
            current.primary = true;
            return;
        }
        const priorityMatch = trimmed.match(/^priority\s+(\d+)/i);
        if (priorityMatch) {
            current.priority = Number(priorityMatch[1]);
            return;
        }

        if (/^Geometry:/i.test(trimmed)) {
            const geometryMatch = trimmed.match(/^Geometry:\s*(\d+),(\d+)\s+(\d+)x(\d+)/i);
            if (geometryMatch) {
                current.pos = { x: Number(geometryMatch[1]), y: Number(geometryMatch[2]) };
                current.size = { width: Number(geometryMatch[3]), height: Number(geometryMatch[4]) };
            }
            readingModes = false;
            return;
        }

        const posMatch = trimmed.match(/^Pos:\s*(\d+),(\d+)/i);
        if (posMatch) {
            current.pos = { x: Number(posMatch[1]), y: Number(posMatch[2]) };
            readingModes = false;
            return;
        }

        const modeMatch = trimmed.match(/^Mode:\s*(\d+)x(\d+)@([\d.]+)/i);
        if (modeMatch) {
            const [, width, height, refresh] = modeMatch;
            current.size = { width: Number(width), height: Number(height) };
            current.mode = `${width}x${height}`;
            current.modeName = `${width}x${height}@${refresh}`;
            readingModes = false;
            return;
        }

        if (/^Modes:/i.test(trimmed)) {
            parseModes(trimmed, current);
            readingModes = true;
            return;
        }

        if (readingModes && /^\d+:/i.test(trimmed)) {
            parseModes(trimmed, current);
            return;
        }

        readingModes = false;
    });

    if (current) {
        outputs.push(current);
    }

    return outputs.filter((output) => output.connected);
}

async function listOutputs() {
    const { stdout } = await execFileAsync('kscreen-doctor', ['-o']);
    const outputs = parseOutputs(stdout);
    updateRememberedState(outputs);
    return outputs;
}

function updateRememberedState(outputs) {
    if (!outputs.length) {
        return;
    }
    const enabled = outputs.filter((output) => output.enabled);
    const multiDisplay = enabled.length >= 2;
    const currentPrimary = outputs.find((output) => output.primary);
    if (multiDisplay && currentPrimary) {
        rememberedPrimaryId = currentPrimary.id;
    } else if (!rememberedPrimaryId) {
        const fallbackPrimary = currentPrimary || selectBestByPriority(enabled) || enabled[0];
        if (fallbackPrimary) {
            rememberedPrimaryId = fallbackPrimary.id;
        }
    }
    const cloneLayout = multiDisplay && isCloneLayout(enabled);
    outputs.forEach((output) => rememberGeometry(output, { skipPosition: cloneLayout }));
}

function guessInternal(outputs) {
    return outputs.find((output) => /eDP|LVDS|DSI|internal/i.test(output.id)) || outputs.find((output) => output.primary) || outputs[0];
}

function guessSecondary(outputs, primary) {
    return outputs.find((output) => output.id !== primary.id);
}

function getDesiredPrimaryId(outputs) {
    if (rememberedPrimaryId && outputs.some((output) => output.id === rememberedPrimaryId)) {
        return rememberedPrimaryId;
    }
    const current = outputs.find((output) => output.primary);
    if (current) {
        rememberedPrimaryId = current.id;
        return current.id;
    }
    return outputs[0]?.id || null;
}

function getStoredPosition(output, options = {}) {
    const { preferRemembered = false } = options;
    const remembered = rememberedGeometry.get(output.id);
    if (preferRemembered) {
        if (remembered?.pos && hasValidPosition(remembered.pos)) {
            return remembered.pos;
        }
        return null;
    }
    if (hasValidPosition(output.pos)) {
        return output.pos;
    }
    if (remembered?.pos && hasValidPosition(remembered.pos)) {
        return remembered.pos;
    }
    return null;
}

function getStoredSize(output) {
    if (output.size?.width && output.size?.height) {
        return output.size;
    }
    const remembered = rememberedGeometry.get(output.id);
    return remembered?.size || null;
}

function buildExtendFallbackPositions(activeOutputs, options = {}) {
    const { preferRemembered = false } = options;
    if (!activeOutputs.length) {
        return {};
    }
    const fallback = {};
    const ordered = activeOutputs.slice().sort((a, b) => {
        const posA = getStoredPosition(a, { preferRemembered });
        const posB = getStoredPosition(b, { preferRemembered });
        if (posA && posB) {
            if (posA.x !== posB.x) {
                return posA.x - posB.x;
            }
            return posA.y - posB.y;
        }
        return (a.priority ?? 999) - (b.priority ?? 999);
    });
    let cursor = 0;
    ordered.forEach((output) => {
        fallback[output.id] = { x: cursor, y: 0 };
        const size = getStoredSize(output);
        cursor += size?.width || 1920;
    });
    return fallback;
}

async function applyConfigs(configs) {
    if (!configs.length) {
        throw new Error('No se detectaron salidas en kscreen-doctor.');
    }
    const args = configs.flatMap((cfg) => {
        const prefix = `output.${cfg.id}`;
        if (!cfg.on) {
            return [`${prefix}.disable`];
        }
        const commands = [`${prefix}.enable`];
        if (cfg.modeId) {
            commands.push(`${prefix}.mode.${cfg.modeId}`);
        } else if (cfg.modeName) {
            commands.push(`${prefix}.mode.${cfg.modeName}`);
        } else if (cfg.mode) {
            commands.push(`${prefix}.mode.${cfg.mode}`);
        }
        if (cfg.position) {
            commands.push(`${prefix}.position.${cfg.position.x},${cfg.position.y}`);
        }
        if (cfg.primary) {
            commands.push(`${prefix}.primary`);
        }
        return commands;
    });
    await execFileAsync('kscreen-doctor', args);
}

async function setModeInternal(outputs, primary, desiredPrimaryId) {
    const configs = outputs.map((output) => {
        if (output.id === primary.id) {
            return { id: output.id, on: true, primary: desiredPrimaryId === output.id };
        }
        return { id: output.id, on: false };
    });
    await applyConfigs(configs);
}

async function setModeExternal(outputs, primary, secondary, desiredPrimaryId) {
    if (!secondary) {
        throw new Error('No se detectó un monitor externo para activar.');
    }
    const configs = outputs.map((output) => {
        if (output.id === secondary.id) {
            return { id: output.id, on: true, primary: desiredPrimaryId === output.id };
        }
        return { id: output.id, on: false };
    });
    await applyConfigs(configs);
}

async function setModeClone(outputs, primary, secondary, desiredPrimaryId) {
    if (!secondary) {
        throw new Error('Se requiere un segundo monitor para duplicar.');
    }
    const configs = outputs.map((output) => {
        const on = output.id === primary.id || output.id === secondary.id;
        return {
            id: output.id,
            on,
            mode: output.mode,
            modeName: output.modeName,
            modeId: output.modeId,
            position: on ? { x: 0, y: 0 } : undefined,
            primary: desiredPrimaryId === output.id && on
        };
    });
    await applyConfigs(configs);
}

async function setModeExtend(outputs, primary, secondary, desiredPrimaryId) {
    if (!secondary) {
        throw new Error('Se requiere un segundo monitor para extender.');
    }
    const activeOutputs = outputs.filter((output) => output.id === primary.id || output.id === secondary.id);
    const activeIds = new Set(activeOutputs.map((output) => output.id));
    const cloneLayout = isCloneLayout(activeOutputs);
    const fallbackPositions = buildExtendFallbackPositions(activeOutputs, { preferRemembered: cloneLayout });
    const configs = outputs.map((output) => {
        if (!activeIds.has(output.id)) {
            return { id: output.id, on: false };
        }
        const storedPosition = getStoredPosition(output, { preferRemembered: cloneLayout })
            || fallbackPositions[output.id]
            || { x: 0, y: 0 };
        return {
            id: output.id,
            on: true,
            position: storedPosition,
            primary: desiredPrimaryId === output.id
        };
    });
    await applyConfigs(configs);
}

async function setMode(mode) {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    const outputs = await listOutputs();
    if (!outputs.length) {
        throw new Error('No se detectaron salidas activas con kscreen-doctor.');
    }
    const primary = guessInternal(outputs);
    const secondary = guessSecondary(outputs, primary);
    let desiredPrimaryId = getDesiredPrimaryId(outputs);
    if (!outputs.some((output) => output.id === desiredPrimaryId)) {
        desiredPrimaryId = primary?.id || outputs[0]?.id || null;
    }
    switch (mode) {
        case 'internal':
            await setModeInternal(outputs, primary, desiredPrimaryId);
            break;
        case 'external':
            await setModeExternal(outputs, primary, secondary, desiredPrimaryId);
            break;
        case 'clone':
            await setModeClone(outputs, primary, secondary, desiredPrimaryId);
            break;
        case 'extend':
            await setModeExtend(outputs, primary, secondary, desiredPrimaryId);
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
        return /eDP|LVDS|internal/i.test(enabled[0].id) ? 'internal' : 'external';
    }
    const positions = new Set(enabled.map((output) => `${output.pos?.x || 0},${output.pos?.y || 0}`));
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
        console.warn('No se pudo obtener estado de pantallas con kscreen-doctor:', error.message);
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
