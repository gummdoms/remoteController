const REQUEST_TIMEOUT_MS = Number(process.env.CLOUD_REQUEST_TIMEOUT_MS || 20000);

async function cloudFetch(serverUrl, path, options = {}) {
    const base = String(serverUrl || '').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(`${base}${path}`, { ...options, signal: controller.signal });
    } catch (error) {
        const wrapped = new Error(
            error.name === 'AbortError'
                ? 'El servidor cloud no respondió a tiempo.'
                : `No se pudo contactar el servidor cloud: ${error.message}`
        );
        wrapped.status = 0;
        wrapped.network = true;
        throw wrapped;
    } finally {
        clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || `Error HTTP ${response.status}`);
        error.status = response.status;
        error.network = response.status >= 500;
        throw error;
    }

    return data;
}

function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    };
}

async function login(serverUrl, { email, password }) {
    return cloudFetch(serverUrl, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
}

async function register(serverUrl, { email, password, name }) {
    return cloudFetch(serverUrl, '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
    });
}

/**
 * Renueva la sesión. El servidor puede responder con un token nuevo
 * (`token` y opcionalmente `refreshToken`).
 */
async function refresh(serverUrl, refreshToken) {
    return cloudFetch(serverUrl, '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
    });
}

async function me(serverUrl, token) {
    const data = await cloudFetch(serverUrl, '/api/auth/me', {
        headers: authHeaders(token)
    });
    return data.user;
}

async function registerDevice(serverUrl, token, payload) {
    const data = await cloudFetch(serverUrl, '/api/devices/register', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(payload)
    });
    return data.device;
}

async function updateDeviceName(serverUrl, token, deviceId, name) {
    const data = await cloudFetch(serverUrl, `/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ name })
    });
    return data.device;
}

module.exports = {
    login,
    register,
    refresh,
    me,
    registerDevice,
    updateDeviceName
};
