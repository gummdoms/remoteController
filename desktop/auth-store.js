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

    // Escritura atómica + permisos 600: el archivo contiene credenciales y no
    // debe corromperse si el proceso muere a mitad de escritura.
    const tempPath = `${storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, storePath);

    try {
        fs.chmodSync(storePath, 0o600);
    } catch (error) {
        // Algunos sistemas de archivos (FAT/red) no permiten aplicar permisos.
    }
}

/**
 * Extrae `exp` de un JWT sin verificarlo (solo para saber cuándo caduca).
 */
function decodeJwtExpiry(token) {
    try {
        const payload = String(token || '').split('.')[1];
        if (!payload) {
            return null;
        }
        const json = JSON.parse(
            Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        );
        return Number(json.exp) ? Number(json.exp) * 1000 : null;
    } catch (error) {
        return null;
    }
}

function getSession() {
    const store = readStore();
    if (!store.token) {
        return null;
    }
    return {
        token: store.token,
        refreshToken: store.refreshToken || null,
        user: store.user || null,
        expiresAt: Number(store.expiresAt) || decodeJwtExpiry(store.token),
        savedAt: store.savedAt || null
    };
}

function saveSession({ token, user, refreshToken, expiresAt }) {
    const previous = readStore();
    const resolvedRefreshToken = refreshToken !== undefined ? refreshToken : previous.refreshToken || null;
    const resolvedUser = user !== undefined ? user : previous.user || null;

    writeStore({
        token,
        refreshToken: resolvedRefreshToken,
        user: resolvedUser ? {
            id: resolvedUser.id,
            email: resolvedUser.email,
            name: resolvedUser.name
        } : null,
        expiresAt: Number(expiresAt) || decodeJwtExpiry(token),
        savedAt: new Date().toISOString()
    });
}

/**
 * Actualiza token/refreshToken conservando el usuario almacenado.
 */
function updateTokens({ token, refreshToken, expiresAt }) {
    const store = readStore();
    if (!store.token) {
        return null;
    }
    const nextToken = token || store.token;
    writeStore({
        ...store,
        token: nextToken,
        refreshToken: refreshToken !== undefined ? refreshToken : store.refreshToken || null,
        expiresAt: Number(expiresAt) || decodeJwtExpiry(nextToken),
        savedAt: new Date().toISOString()
    });
    return getSession();
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
    updateTokens,
    clearSession,
    isLoggedIn,
    decodeJwtExpiry
};
