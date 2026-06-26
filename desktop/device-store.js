const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { PRODUCTION_CLOUD_URL, DEV_CLOUD_URL } = require('./constants');

const STORE_FILENAME = 'cloud-device.json';

function getStorePath() {
    const userData = app?.getPath?.('userData') || path.join(os.homedir(), '.remotecontrollers');
    return path.join(userData, STORE_FILENAME);
}

function readStore() {
    const storePath = getStorePath();
    try {
        if (!fs.existsSync(storePath)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (error) {
        return {};
    }
}

function writeStore(data) {
    const storePath = getStorePath();
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
}

function resolveServerUrl(store) {
    if (process.env.CLOUD_SERVER_URL) {
        return process.env.CLOUD_SERVER_URL.replace(/\/$/, '');
    }
    if (store.serverUrl) {
        return store.serverUrl.replace(/\/$/, '');
    }
    if (app?.isPackaged) {
        return PRODUCTION_CLOUD_URL;
    }
    return DEV_CLOUD_URL;
}

function getCloudConfig() {
    const store = readStore();
    return {
        serverUrl: resolveServerUrl(store),
        deviceToken: store.deviceToken || null,
        deviceId: store.deviceId || null,
        deviceName: store.deviceName || os.hostname(),
        connectionStatus: store.connectionStatus || 'disconnected'
    };
}

function saveCloudCredentials({ deviceToken, deviceId, deviceName }) {
    const store = readStore();
    writeStore({
        ...store,
        serverUrl: resolveServerUrl(store),
        deviceToken,
        deviceId,
        deviceName: deviceName || store.deviceName,
        connectionStatus: 'connected'
    });
}

function saveConnectionStatus(status) {
    const store = readStore();
    writeStore({
        ...store,
        connectionStatus: status
    });
}

function setDeviceName(deviceName) {
    const store = readStore();
    writeStore({
        ...store,
        deviceName: String(deviceName || '').trim() || os.hostname()
    });
}

function setServerUrl(serverUrl) {
    const store = readStore();
    writeStore({
        ...store,
        serverUrl: String(serverUrl || '').replace(/\/$/, '')
    });
}

function clearDeviceCredentials() {
    const store = readStore();
    writeStore({
        serverUrl: resolveServerUrl(store),
        deviceName: store.deviceName || os.hostname(),
        connectionStatus: 'disconnected'
    });
}

module.exports = {
    getCloudConfig,
    saveCloudCredentials,
    saveConnectionStatus,
    setDeviceName,
    setServerUrl,
    clearDeviceCredentials
};
