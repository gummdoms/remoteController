const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
    on: (channel, listener) => {
        ipcRenderer.on(channel, listener);
    },
    off: (channel, listener) => {
        ipcRenderer.off(channel, listener);
    },
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
