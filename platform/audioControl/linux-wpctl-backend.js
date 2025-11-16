const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const isLinux = process.platform === 'linux';
let hasCommand = false;
if (isLinux) {
    try {
        execFileSync('which', ['wpctl'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const isSupported = () => isLinux && hasCommand;
const TARGET = '@DEFAULT_AUDIO_SINK@';
const unavailableReason = 'Instala wpctl (pipewire/wireplumber) para controlar el volumen.';

async function runWpctl(args) {
    try {
        return await execFileAsync('wpctl', args, { timeout: 5000 });
    } catch (error) {
        const err = new Error(error.stderr?.trim() || error.message);
        err.code = 'WPCTL_ERROR';
        throw err;
    }
}

async function readState() {
    const { stdout } = await runWpctl(['get-volume', TARGET]);
    const normalized = stdout.replace(/\r/g, '');
    const volumeMatch = normalized.match(/Volume:\s*([0-9.]+)/i);
    const volume = volumeMatch ? Math.round(parseFloat(volumeMatch[1]) * 100) : null;
    const muted = /MUTED/i.test(normalized);
    return { volume, muted };
}

module.exports = {
    name: 'wpctl',
    isSupported,
    getUnavailableReason: () => unavailableReason,
    async getVolume() {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        const { volume } = await readState();
        return typeof volume === 'number' ? volume : 0;
    },
    async setVolume(value) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        const clamped = Math.max(0, Math.min(100, Number(value) || 0));
        await runWpctl(['set-volume', TARGET, `${clamped}%`]);
    },
    async getMuted() {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        const { muted } = await readState();
        return Boolean(muted);
    },
    async setMuted(muted) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        await runWpctl(['set-mute', TARGET, muted ? '1' : '0']);
    }
};
