const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const backendName = 'linux-hyprland';
const isLinux = process.platform === 'linux';
const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
const desktop = (process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || '').toLowerCase();
const isHyprland = Boolean(process.env.HYPRLAND_INSTANCE_SIGNATURE) || desktop.includes('hyprland');
let hasCommand = false;

if (isLinux && isHyprland) {
    try {
        execFileSync('hyprctl', ['version'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const unavailableReason = 'Hyprland no está disponible (se requiere hyprctl en una sesión Hyprland).';

function isSupported() {
    return isLinux && Boolean(sessionType === 'wayland' || process.env.WAYLAND_DISPLAY) && isHyprland && hasCommand;
}

function formatRate(rate) {
    const value = Number(rate) || 0;
    return `${value.toFixed(2)}Hz`;
}

function currentModeOf(monitor) {
    if (monitor.width && monitor.height && monitor.refreshRate) {
        return `${monitor.width}x${monitor.height}@${formatRate(monitor.refreshRate)}`;
    }
    return 'preferred';
}

function preferredModeOf(monitor) {
    const modes = Array.isArray(monitor.availableModes) ? monitor.availableModes : [];
    return modes[0] || currentModeOf(monitor);
}

function resolveMode(monitor, mode) {
    if (!monitor) {
        return 'preferred';
    }
    const modes = Array.isArray(monitor.availableModes) ? monitor.availableModes : [];
    if (mode && modes.includes(mode)) {
        return mode;
    }
    return mode || preferredModeOf(monitor);
}

async function listMonitors() {
    const { stdout } = await execFileAsync('hyprctl', ['monitors', '-j']);
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
        throw new Error('hyprctl devolvió un formato inesperado.');
    }
    return parsed.map((monitor) => ({
        name: monitor.name,
        description: monitor.description || monitor.model || monitor.name,
        enabled: !monitor.disabled && Number(monitor.width) > 0,
        width: Number(monitor.width) || null,
        height: Number(monitor.height) || null,
        refresh: Number(monitor.refreshRate) || null,
        position: { x: Number(monitor.x) || 0, y: Number(monitor.y) || 0 },
        scale: Number(monitor.scale) || 1,
        focused: Boolean(monitor.focused),
        mirrorOf: monitor.mirrorOf && monitor.mirrorOf !== 'none' ? monitor.mirrorOf : null,
        currentMode: currentModeOf(monitor),
        availableModes: Array.isArray(monitor.availableModes) ? monitor.availableModes : []
    }));
}

function guessInternal(monitors) {
    return monitors.find((item) => /eDP|LVDS|DSI/i.test(item.name))
        || monitors.find((item) => item.focused)
        || monitors[0];
}

function guessSecondary(monitors, primary) {
    // Preferimos un monitor encendido o con modos disponibles (conectado).
    return monitors.find((item) => item.name !== primary.name && (item.enabled || item.availableModes.length > 0))
        || monitors.find((item) => item.name !== primary.name);
}

function monitorSpec(monitor, { mode, x, y, mirror } = {}) {
    if (!monitor) {
        return null;
    }
    const scale = monitor.scale || 1;
    if (x === undefined) {
        return `${monitor.name},disable`;
    }
    const parts = [
        monitor.name,
        resolveMode(monitor, mode),
        `${x}x${y}`,
        String(scale)
    ];
    if (mirror) {
        parts.push('mirror', mirror);
    }
    return parts.join(',');
}

async function applySpecs(specs) {
    const command = specs
        .filter(Boolean)
        .map((spec) => `keyword monitor "${spec}"`)
        .join(';');

    if (!command) {
        throw new Error('No hay monitores para configurar.');
    }

    try {
        await execFileAsync('hyprctl', ['--batch', command]);
        return;
    } catch (error) {
        // Algunos builds de Hyprland no aceptan --batch; se aplican una a una.
        const failures = [];
        for (const spec of specs.filter(Boolean)) {
            try {
                await execFileAsync('hyprctl', ['keyword', 'monitor', spec]);
            } catch (innerError) {
                failures.push(`${spec}: ${innerError.message}`);
            }
        }
        if (failures.length) {
            throw new Error(`No se pudo aplicar la configuración de pantallas: ${failures.join(' | ')}`);
        }
    }
}

async function setMode(mode) {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }

    // hyprctl lista también las salidas desconectadas/deshabilitadas; hay que
    // mantenerlas para poder volver a activar un monitor externo.
    const monitors = (await listMonitors()).filter((item) => Boolean(item.name));
    if (!monitors.length) {
        throw new Error('No se detectaron monitores con hyprctl.');
    }

    const primary = guessInternal(monitors);
    const secondary = guessSecondary(monitors, primary);

    if (mode !== 'internal' && !secondary) {
        throw new Error('No se detectó un segundo monitor para este modo.');
    }

    const primarySpec = monitorSpec(primary, {
        mode: primary.currentMode,
        x: 0,
        y: 0
    });

    switch (mode) {
        case 'internal': {
            await applySpecs([
                primarySpec,
                ...monitors
                    .filter((item) => item.name !== primary.name)
                    .map((item) => monitorSpec(item, { x: undefined }))
            ]);
            return;
        }
        case 'external': {
            await applySpecs([
                monitorSpec(secondary, { mode: preferredModeOf(secondary), x: 0, y: 0 }),
                ...monitors
                    .filter((item) => item.name !== secondary.name)
                    .map((item) => monitorSpec(item, { x: undefined }))
            ]);
            return;
        }
        case 'clone': {
            await applySpecs([
                primarySpec,
                monitorSpec(secondary, {
                    mode: primary.currentMode,
                    x: 0,
                    y: 0,
                    mirror: primary.name
                }),
                ...monitors
                    .filter((item) => item.name !== primary.name && item.name !== secondary.name)
                    .map((item) => monitorSpec(item, { x: undefined }))
            ]);
            return;
        }
        case 'extend': {
            const offset = primary.width || 0;
            await applySpecs([
                primarySpec,
                monitorSpec(secondary, { mode: preferredModeOf(secondary), x: offset, y: 0 }),
                ...monitors
                    .filter((item) => item.name !== primary.name && item.name !== secondary.name)
                    .map((item) => monitorSpec(item, { x: undefined }))
            ]);
            return;
        }
        default:
            throw new Error(`Modo desconocido: ${mode}`);
    }
}

function inferMode(monitors) {
    const enabled = monitors.filter((item) => item.enabled);
    if (!enabled.length) {
        return 'unknown';
    }
    if (enabled.length === 1) {
        return /eDP|LVDS|DSI/i.test(enabled[0].name) ? 'internal' : 'external';
    }
    if (enabled.some((item) => item.mirrorOf)) {
        return 'clone';
    }
    const positions = new Set(enabled.map((item) => `${item.position.x},${item.position.y}`));
    return positions.size === 1 ? 'clone' : 'extend';
}

async function getState() {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    try {
        const monitors = await listMonitors();
        return { mode: inferMode(monitors), legacyCode: null };
    } catch (error) {
        console.warn('No se pudo obtener el estado de pantallas con hyprctl:', error.message);
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
