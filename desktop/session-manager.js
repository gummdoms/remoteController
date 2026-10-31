const os = require('os');
const cloudApi = require('./cloud-api');
const authStore = require('./auth-store');
const deviceStore = require('./device-store');
const machineId = require('./machine-id');
const cloudAgent = require('./cloud-agent');

// Cada cuánto se comprueba que la sesión siga viva.
const KEEPALIVE_INTERVAL_MS = Number(process.env.SESSION_KEEPALIVE_MS || 10 * 60 * 1000);
// Se renueva el token cuando le queda menos de esto.
const REFRESH_THRESHOLD_MS = Number(process.env.SESSION_REFRESH_THRESHOLD_MS || 15 * 60 * 1000);

let keepAliveTimer = null;
let authListeners = [];
const state = {
    expired: false,
    offline: false,
    lastError: null
};

function notify() {
    const snapshot = getAuthState();
    authListeners.forEach((listener) => {
        try {
            listener(snapshot);
        } catch (error) {
            console.error('Error en listener de sesión:', error);
        }
    });
}

async function connectDeviceWithToken(authToken) {
    const config = deviceStore.getCloudConfig();
    const device = await cloudApi.registerDevice(config.serverUrl, authToken, {
        name: config.deviceName || os.hostname(),
        machineId: machineId.getMachineId(),
        platform: process.platform,
        hostname: os.hostname()
    });

    deviceStore.saveCloudCredentials({
        deviceToken: device.token,
        deviceId: device.id,
        deviceName: device.name
    });

    // El token cambió: hay que reconectar aunque ya hubiera un socket abierto.
    await cloudAgent.startCloudAgent({ force: true });
    return device;
}

function resolveExpiresAt(payload, token) {
    if (payload && Number(payload.expiresAt)) {
        return Number(payload.expiresAt);
    }
    if (payload && Number(payload.expiresIn)) {
        return Date.now() + Number(payload.expiresIn) * 1000;
    }
    return authStore.decodeJwtExpiry(token);
}

/**
 * Guarda la sesión de forma duradera (token + refresh token + caducidad).
 * La sesión NO se borra nunca automáticamente: solo con un logout explícito.
 */
function persistAuth(payload) {
    const expiresAt = resolveExpiresAt(payload, payload.token);
    authStore.saveSession({
        token: payload.token,
        refreshToken: payload.refreshToken || null,
        user: payload.user,
        expiresAt
    });
    state.expired = false;
    state.offline = false;
    state.lastError = null;
}

async function login({ email, password, deviceName, name }) {
    const config = deviceStore.getCloudConfig();

    if (deviceName) {
        deviceStore.setDeviceName(deviceName);
    }

    const result = await cloudApi.login(config.serverUrl, { email, password });
    persistAuth(result);

    const device = await connectDeviceWithToken(result.token);
    notify();

    return {
        user: result.user,
        device,
        cloud: cloudAgent.getCloudStatus()
    };
}

async function register({ email, password, name, deviceName }) {
    const config = deviceStore.getCloudConfig();

    if (deviceName) {
        deviceStore.setDeviceName(deviceName);
    }

    const result = await cloudApi.register(config.serverUrl, { email, password, name });
    persistAuth(result);

    const device = await connectDeviceWithToken(result.token);
    notify();

    return {
        user: result.user,
        device,
        cloud: cloudAgent.getCloudStatus()
    };
}

/**
 * Intenta renovar el token con el refresh token. Devuelve la sesión nueva o
 * null si el servidor no soporta refresh o lo rechaza.
 */
async function tryRefreshSession() {
    const session = authStore.getSession();
    if (!session?.refreshToken) {
        return null;
    }

    const config = deviceStore.getCloudConfig();
    try {
        const result = await cloudApi.refresh(config.serverUrl, session.refreshToken);
        if (!result?.token) {
            return null;
        }
        authStore.updateTokens({
            token: result.token,
            refreshToken: result.refreshToken || session.refreshToken,
            expiresAt: resolveExpiresAt(result, result.token)
        });
        state.expired = false;
        state.offline = false;
        state.lastError = null;
        notify();
        return authStore.getSession();
    } catch (error) {
        state.lastError = error.message;
        if (!error.network) {
            // 400/401/404: el refresh ya no sirve (el servidor puede no tener
            // el endpoint). La sesión se conserva igualmente.
            state.expired = error.status === 401 || error.status === 403;
        }
        return null;
    }
}

/**
 * Devuelve una sesión utilizable, renovándola si está a punto de caducar.
 */
async function ensureSession({ force = false } = {}) {
    const session = authStore.getSession();
    if (!session?.token) {
        return null;
    }

    const expiresAt = session.expiresAt;
    const nearExpiry = !expiresAt || (expiresAt - Date.now()) <= REFRESH_THRESHOLD_MS;
    if (!force && !nearExpiry) {
        return session;
    }

    const refreshed = await tryRefreshSession();
    return refreshed || session;
}

async function restoreSession() {
    const session = authStore.getSession();
    if (!session?.token) {
        return null;
    }

    const config = deviceStore.getCloudConfig();

    try {
        try {
            const user = await cloudApi.me(config.serverUrl, session.token);
            authStore.saveSession({ token: session.token, user });
            state.expired = false;
            state.offline = false;
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                const refreshed = await tryRefreshSession();
                if (refreshed) {
                    const user = await cloudApi.me(config.serverUrl, refreshed.token);
                    authStore.saveSession({ token: refreshed.token, user });
                } else {
                    // No se cierra la sesión: se marca como expirada para que
                    // la interfaz pida volver a iniciar sesión.
                    state.expired = true;
                }
            } else {
                // Fallo de red o del servidor: se conserva la sesión y se
                // reintenta en el siguiente ciclo de keepalive.
                state.offline = true;
                state.lastError = error.message;
            }
        }

        // Reconectar el agente cloud con el token de dispositivo guardado.
        if (deviceStore.getCloudConfig().deviceToken) {
            cloudAgent.startCloudAgent().catch((error) => {
                console.warn('No se pudo reconectar el agente cloud:', error.message);
            });
        }

        notify();
        return getAuthState();
    } catch (error) {
        state.offline = true;
        state.lastError = error.message;
        notify();
        return getAuthState();
    }
}

/**
 * Se ejecuta cuando el servidor rechaza el token del dispositivo (cierre 4401).
 * Renueva la sesión y vuelve a registrar el equipo, sin pedir la contraseña.
 */
async function handleUnauthorized() {
    const session = authStore.getSession();
    if (!session?.token) {
        return { ok: false };
    }

    const active = await ensureSession({ force: true });
    if (!active) {
        return { ok: false };
    }

    try {
        await connectDeviceWithToken(active.token);
        state.expired = false;
        state.offline = false;
        notify();
        return { ok: true };
    } catch (error) {
        state.lastError = error.message;
        if (error.status === 401 || error.status === 403) {
            state.expired = true;
        } else {
            state.offline = true;
        }
        notify();
        return { ok: false };
    }
}

async function keepAliveTick() {
    const session = authStore.getSession();
    if (!session?.token) {
        return;
    }

    const config = deviceStore.getCloudConfig();
    const expiresAt = session.expiresAt;
    const nearExpiry = !expiresAt || (expiresAt - Date.now()) <= REFRESH_THRESHOLD_MS;

    if (nearExpiry) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
            try {
                await cloudApi.me(config.serverUrl, session.token);
                state.offline = false;
                state.expired = false;
            } catch (error) {
                if (error.status === 401 || error.status === 403) {
                    state.expired = true;
                } else {
                    state.offline = true;
                }
                state.lastError = error.message;
            }
        }
    } else {
        try {
            await cloudApi.me(config.serverUrl, session.token);
            state.offline = false;
            state.expired = false;
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                await ensureSession({ force: true });
            } else {
                state.offline = true;
                state.lastError = error.message;
            }
        }
    }

    const cloud = cloudAgent.getCloudStatus();
    if (!cloud.connected) {
        cloudAgent.connectCloudAgent().catch(() => {});
    }

    notify();
}

function startKeepAlive() {
    if (keepAliveTimer) {
        return;
    }
    keepAliveTimer = setInterval(() => {
        keepAliveTick().catch((error) => {
            console.warn('Latido de sesión falló:', error.message);
        });
    }, KEEPALIVE_INTERVAL_MS);
    if (typeof keepAliveTimer.unref === 'function') {
        keepAliveTimer.unref();
    }
}

function stopKeepAlive() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
}

function onAuthStateChange(listener) {
    authListeners.push(listener);
    return () => {
        authListeners = authListeners.filter((item) => item !== listener);
    };
}

async function logout() {
    cloudAgent.stopCloudAgent();
    stopKeepAlive();
    state.expired = false;
    state.offline = false;
    authStore.clearSession();
    deviceStore.clearDeviceCredentials();
    notify();
}

async function renameDevice(name) {
    const session = authStore.getSession();
    const config = deviceStore.getCloudConfig();

    if (!session?.token || !config.deviceId) {
        throw new Error('No hay sesión activa.');
    }

    const device = await cloudApi.updateDeviceName(
        config.serverUrl,
        session.token,
        config.deviceId,
        name
    );

    deviceStore.setDeviceName(device.name);
    return device;
}

function getAuthState() {
    const session = authStore.getSession();
    const cloud = cloudAgent.getCloudStatus();

    return {
        loggedIn: Boolean(session?.token),
        user: session?.user || null,
        expiresAt: session?.expiresAt || null,
        expired: state.expired,
        offline: state.offline,
        lastError: state.lastError,
        cloud
    };
}

module.exports = {
    login,
    register,
    restoreSession,
    ensureSession,
    handleUnauthorized,
    startKeepAlive,
    stopKeepAlive,
    onAuthStateChange,
    logout,
    renameDevice,
    getAuthState
};
