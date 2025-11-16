const unavailableReason = 'No hay backends de audio disponibles. Instala loudness, wpctl o pactl.';

module.exports = {
    name: 'none',
    isSupported: () => false,
    getUnavailableReason: () => unavailableReason,
    async getVolume() {
        throw new Error(unavailableReason);
    },
    async setVolume() {
        throw new Error(unavailableReason);
    },
    async getMuted() {
        throw new Error(unavailableReason);
    },
    async setMuted() {
        throw new Error(unavailableReason);
    }
};
