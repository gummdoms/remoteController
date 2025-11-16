let loudness = null;
try {
    loudness = require('loudness');
} catch (error) {
    loudness = null;
}

const unavailableReason = 'El control de volumen no está disponible. Instala los requisitos del backend seleccionado (loudness/wpctl/pactl).';

function ensureAvailable() {
    if (!loudness) {
        const error = new Error(unavailableReason);
        error.code = 'AUDIO_UNAVAILABLE';
        throw error;
    }
}

module.exports = {
    name: 'loudness',
    isSupported: () => Boolean(loudness),
    getUnavailableReason: () => unavailableReason,
    async getVolume() {
        ensureAvailable();
        return loudness.getVolume();
    },
    async setVolume(value) {
        ensureAvailable();
        const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        await loudness.setVolume(clamped);
    },
    async getMuted() {
        ensureAvailable();
        return loudness.getMuted();
    },
    async setMuted(muted) {
        ensureAvailable();
        await loudness.setMuted(Boolean(muted));
    }
};
