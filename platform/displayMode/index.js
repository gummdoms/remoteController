const windowsBackend = require('./windows-backend');
const linuxKscreenBackend = require('./linux-kscreen-backend');
const linuxWlrBackend = require('./linux-wlr-backend');
const linuxXrandrBackend = require('./linux-xrandr-backend');
const noBackend = require('./no-backend');

function selectBackend() {
    if (windowsBackend.isSupported()) {
        return windowsBackend;
    }
    if (linuxKscreenBackend.isSupported()) {
        return linuxKscreenBackend;
    }
    if (linuxWlrBackend.isSupported()) {
        return linuxWlrBackend;
    }
    if (linuxXrandrBackend.isSupported()) {
        return linuxXrandrBackend;
    }
    return noBackend;
}

const backend = selectBackend();

module.exports = {
    name: backend.name,
    isSupported: backend.isSupported,
    getUnavailableReason: backend.getUnavailableReason,
    setMode: backend.setMode,
    getState: backend.getState
};
