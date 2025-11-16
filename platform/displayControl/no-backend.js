const unavailableReason = 'El control de brillo/contraste no está disponible. Instala @hensm/ddcci o ddcutil en Linux.';

module.exports = {
    name: 'unsupported',
    isSupported: () => false,
    getUnavailableReason: () => unavailableReason,
    async getMonitorList() {
        return [];
    },
    async setBrightness() {
        throw new Error(unavailableReason);
    },
    async getBrightnessList() {
        return [];
    },
    async setContrast() {
        throw new Error(unavailableReason);
    },
    async getContrastList() {
        return [];
    }
};
