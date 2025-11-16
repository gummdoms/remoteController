const loudnessBackend = require('./loudness-backend');
const wpctlBackend = require('./linux-wpctl-backend');
const pactlBackend = require('./linux-pactl-backend');
const noBackend = require('./no-backend');

function selectBackend() {
    if (process.platform === 'linux') {
        if (wpctlBackend.isSupported()) {
            return wpctlBackend;
        }
        if (pactlBackend.isSupported()) {
            return pactlBackend;
        }
    }
    if (loudnessBackend.isSupported()) {
        return loudnessBackend;
    }
    if (pactlBackend.isSupported()) {
        return pactlBackend;
    }
    if (wpctlBackend.isSupported()) {
        return wpctlBackend;
    }
    return noBackend;
}

const backend = selectBackend();

module.exports = {
    name: backend.name,
    isSupported: backend.isSupported,
    getUnavailableReason: backend.getUnavailableReason,
    getVolume: backend.getVolume,
    setVolume: backend.setVolume,
    getMuted: backend.getMuted,
    setMuted: backend.setMuted
};
