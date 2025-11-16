const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const isLinux = process.platform === 'linux';
let hasCommand = false;
if (isLinux) {
    try {
        execFileSync('which', ['pactl'], { stdio: 'ignore' });
        hasCommand = true;
    } catch (error) {
        hasCommand = false;
    }
}

const isSupported = () => isLinux && hasCommand;
const TARGET = '@DEFAULT_SINK@';
const unavailableReason = 'Instala PulseAudio/PipeWire (pactl) para controlar el volumen.';

async function runPactl(args) {
    try {
        return await execFileAsync('pactl', args, { timeout: 5000 });
    } catch (error) {
        const err = new Error(error.stderr?.trim() || error.message);
        err.code = 'PACTL_ERROR';
        throw err;
    }
}

function parsePercentFromVolume(output) {
    const match = output.match(/(\d+)%/);
    if (!match) {
        return null;
    }
    return Math.max(0, Math.min(100, parseInt(match[1], 10)));
}

async function readVolumeState() {
    const { stdout } = await runPactl(['get-sink-volume', TARGET]);
    const percent = parsePercentFromVolume(stdout);
    return typeof percent === 'number' ? percent : 0;
}

async function readMuteState() {
    const { stdout } = await runPactl(['get-sink-mute', TARGET]);
    return /yes/i.test(stdout);
}

module.exports = {
    name: 'pactl',
    isSupported,
    getUnavailableReason: () => unavailableReason,
    async getVolume() {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        return readVolumeState();
    },
    async setVolume(value) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        const clamped = Math.max(0, Math.min(100, Number(value) || 0));
        await runPactl(['set-sink-volume', TARGET, `${clamped}%`]);
    },
    async getMuted() {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        return readMuteState();
    },
    async setMuted(muted) {
        if (!isSupported()) {
            throw new Error(unavailableReason);
        }
        await runPactl(['set-sink-mute', TARGET, muted ? '1' : '0']);
    }
};
