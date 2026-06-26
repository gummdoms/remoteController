const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const STORE_FILENAME = 'auth-session.json';

function getStorePath() {
    const userData = app?.getPath?.('userData') || path.join(os.homedir(), '.remotecontrollers');
    return path.join(userData, STORE_FILENAME);
}

function readStore() {
    try {
        const storePath = getStorePath();
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

function getSession() {
    const store = readStore();
    if (!store.token) {
        return null;
    }
    return {
        token: store.token,
        user: store.user || null
    };
}

function saveSession({ token, user }) {
    writeStore({
        token,
        user: user ? {
            id: user.id,
            email: user.email,
            name: user.name
        } : null
    });
}

function clearSession() {
    const storePath = getStorePath();
    if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
    }
}

function isLoggedIn() {
    return Boolean(getSession()?.token);
}

module.exports = {
    getSession,
    saveSession,
    clearSession,
    isLoggedIn
};
