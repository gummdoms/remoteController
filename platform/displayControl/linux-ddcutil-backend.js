const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const backendName = 'ddcutil';
const BRIGHTNESS_CODE = '10';
const CONTRAST_CODE = '12';
const DETECT_CACHE_MS = 10000;
const FAILURE_THRESHOLD = 3;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const unavailableReason = 'Instala ddcutil (y otorga permisos al usuario en el grupo i2c/video) para controlar brillo y contraste en Linux.';

const isLinux = process.platform === 'linux';
let hasCommand = false;
if (isLinux) {
    try {
        execFileSync('which', ['ddcutil'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const isSupported = () => isLinux && hasCommand;

let cachedTargets = [];
let targetsCacheExpiresAt = 0;
const targetFailures = new Map();

function isTargetDisabled(targetId) {
    const entry = targetFailures.get(targetId);
    if (!entry) {
        return false;
    }
    if (entry.disabledUntil && entry.disabledUntil > Date.now()) {
        return true;
    }
    if (entry.disabledUntil && entry.disabledUntil <= Date.now()) {
        targetFailures.delete(targetId);
    }
    return false;
}

function markTargetFailure(targetId) {
    const entry = targetFailures.get(targetId) || { count: 0, disabledUntil: 0 };
    entry.count += 1;
    if (entry.count >= FAILURE_THRESHOLD) {
        entry.disabledUntil = Date.now() + FAILURE_COOLDOWN_MS;
        entry.count = 0;
        console.warn(`Monitor ${targetId} deshabilitado temporalmente tras múltiples fallos DDC/CI.`);
    }
    targetFailures.set(targetId, entry);
}

function markTargetSuccess(targetId) {
    if (targetFailures.has(targetId)) {
        targetFailures.delete(targetId);
    }
}

function parseDetectVerbose(output) {
    const targets = [];
    const lines = output.split(/\r?\n/);
    let pendingDisplay = null;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const displayMatch = line.match(/^Display\s+(\d+)/i);
        if (displayMatch) {
            pendingDisplay = displayMatch[1];
            continue;
        }
        const busMatch = line.match(/I2C\s+bus:\s*(\/dev\/i2c-(\d+))/i);
        if (busMatch) {
            const busPath = busMatch[1];
            const busNumber = busMatch[2];
            const displayId = pendingDisplay ? `display-${pendingDisplay}` : null;
            targets.push({
                id: `bus-${busNumber}${displayId ? `-${displayId}` : ''}`,
                label: pendingDisplay ? `Display ${pendingDisplay}` : `Bus ${busNumber}`,
                bus: busNumber,
                busPath,
                display: pendingDisplay || null
            });
            pendingDisplay = null;
        }
    }
    return targets;
}

async function detectTargets() {
    if (!isSupported()) {
        return [];
    }
    const now = Date.now();
    if (cachedTargets.length && now < targetsCacheExpiresAt) {
        return cachedTargets;
    }
    try {
        const { stdout } = await execFileAsync('ddcutil', ['detect', '--verbose']);
        const parsed = parseDetectVerbose(stdout);
        if (parsed.length) {
            cachedTargets = parsed;
            targetsCacheExpiresAt = now + DETECT_CACHE_MS;
            return cachedTargets;
        }
    } catch (error) {
        console.warn('No se pudo ejecutar ddcutil detect --verbose:', error.message);
    }
    if (!cachedTargets.length) {
        cachedTargets = [{ id: 'display-1', label: 'Display 1', display: '1', bus: null }];
    }
    targetsCacheExpiresAt = now + DETECT_CACHE_MS;
    return cachedTargets;
}

function findTargetsById(targets, displayId) {
    const availableTargets = targets.filter((target) => !isTargetDisabled(target.id));
    if (!displayId) {
        return availableTargets;
    }
    const normalized = String(displayId).toLowerCase();
    const match = availableTargets.filter((target) => {
        const candidates = [
            target.id,
            target.display ? `display-${target.display}` : null,
            target.display,
            target.bus ? `bus-${target.bus}` : null,
            target.bus
        ].filter(Boolean).map((value) => String(value).toLowerCase());
        return candidates.includes(normalized);
    });
    if (match.length) {
        return match;
    }
    return availableTargets;
}

async function runDdcutil(args) {
    try {
        return await execFileAsync('ddcutil', args, { timeout: 10000, maxBuffer: 1024 * 1024 });
    } catch (error) {
        const err = new Error(error.stderr?.trim() || error.message);
        err.code = 'DDCUTIL_ERROR';
        throw err;
    }
}

function parseGetVcpOutput(stdout) {
    const normalized = stdout.replace(/\r/g, '');
    const currentMatch = normalized.match(/current value\s*=\s*(\d+)/i);
    const maxMatch = normalized.match(/max value\s*=\s*(\d+)/i);
    const current = currentMatch ? Number(currentMatch[1]) : null;
    const max = maxMatch ? Number(maxMatch[1]) : 100;
    if (typeof current === 'number' && Number.isFinite(current) && Number.isFinite(max) && max > 0) {
        return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
    }
    return null;
}

async function getValuesForCode(code, displayId) {
    const targets = findTargetsById(await detectTargets(), displayId);
    const values = [];
    for (const target of targets) {
        const args = ['getvcp', code];
        if (target.bus) {
            args.push('--bus', String(target.bus));
        } else if (target.display) {
            args.push('--display', String(target.display));
        }
        try {
            const { stdout } = await runDdcutil(args);
            const value = parseGetVcpOutput(stdout);
            if (value !== null) {
                values.push({ id: target.id, label: target.label, value });
                markTargetSuccess(target.id);
            }
        } catch (error) {
            console.warn(`No se pudo leer VCP ${code} en el monitor ${target.id}:`, error.message);
            markTargetFailure(target.id);
        }
    }
    return values;
}

async function setValueForCode(code, percentage, displayId) {
    const value = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
    const targets = findTargetsById(await detectTargets(), displayId);
    for (const target of targets) {
        const args = ['setvcp', code, String(value)];
        if (target.bus) {
            args.push('--bus', String(target.bus));
        } else if (target.display) {
            args.push('--display', String(target.display));
        }
        try {
            await runDdcutil(args);
            markTargetSuccess(target.id);
        } catch (error) {
            console.warn(`No se pudo establecer VCP ${code} en el monitor ${target.id}:`, error.message);
            markTargetFailure(target.id);
        }
    }
}

module.exports = {
    name: backendName,
    isSupported,
    getUnavailableReason: () => unavailableReason,
    async getMonitorList() {
        if (!isSupported()) {
            return [];
        }
        const targets = await detectTargets();
        return targets
            .filter((target) => !isTargetDisabled(target.id))
            .map((target) => ({
                id: target.id,
                label: target.label,
                backend: backendName,
                info: {
                    bus: target.bus,
                    busPath: target.busPath,
                    display: target.display
                }
            }));
    },
    async setBrightness(value, displayId) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        await setValueForCode(BRIGHTNESS_CODE, value, displayId);
    },
    async getBrightnessList(displayId) {
        if (!isSupported()) {
            return [];
        }
        return getValuesForCode(BRIGHTNESS_CODE, displayId);
    },
    async setContrast(value, displayId) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        await setValueForCode(CONTRAST_CODE, value, displayId);
    },
    async getContrastList(displayId) {
        if (!isSupported()) {
            return [];
        }
        return getValuesForCode(CONTRAST_CODE, displayId);
    }
};
