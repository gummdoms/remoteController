async function cloudFetch(serverUrl, path, options = {}) {
    const base = String(serverUrl || '').replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || `Error HTTP ${response.status}`);
        error.status = response.status;
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
    me,
    registerDevice,
    updateDeviceName
};
