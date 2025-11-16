const unavailableReason = 'El cambio de modo de pantalla no está disponible en este sistema.';

module.exports = {
    name: 'display-mode-unsupported',
    isSupported: () => false,
    getUnavailableReason: () => unavailableReason,
    async setMode() {
        throw new Error(unavailableReason);
    },
    async getState() {
        return { mode: 'unknown', legacyCode: null };
    }
};
