const ddcciBackend = require('./ddcci-backend');
const linuxBackend = require('./linux-ddcutil-backend');
const noBackend = require('./no-backend');

function selectBackend() {
    if (ddcciBackend.isSupported()) {
        return ddcciBackend;
    }
    if (linuxBackend.isSupported()) {
        return linuxBackend;
    }
    return noBackend;
}

const backend = selectBackend();

module.exports = {
    name: backend.name,
    isSupported: backend.isSupported,
    getUnavailableReason: backend.getUnavailableReason,
    getMonitorList: backend.getMonitorList,
    setBrightness: backend.setBrightness,
    getBrightnessList: backend.getBrightnessList,
    setContrast: backend.setContrast,
    getContrastList: backend.getContrastList
};
