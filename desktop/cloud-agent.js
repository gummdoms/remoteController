const http = require('http');
const WebSocket = require('ws');
const {
    getCloudConfig,
    saveConnectionStatus,
} = require('./device-store');

const INTERNAL_API_HOST = process.env.INTERNAL_API_HOST || '127.0.0.1';
const INTERNAL_API_PORT = Number(process.env.INTERNAL_API_PORT || 4800);
const RECONNECT_DELAY_MS = Number(process.env.CLOUD_RECONNECT_MS || 5000);
const MAX_RECONNECT_DELAY_MS = Number(process.env.CLOUD_RECONNECT_MAX_MS || 60000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.CLOUD_HEARTBEAT_MS || 25000);
const STALE_CONNECTION_MS = HEARTBEAT_INTERVAL_MS * 3;

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let shouldRun = false;
let statusListeners = [];
let reconnectAttempts = 0;
let lastMessageAt = 0;
let authRetryInFlight = false;
let lastAuthAttemptAt = 0;
let handlers = {};

function getWsUrl(serverUrl) {
    const base = String(serverUrl || '').replace(/\/$/, '');
    if (base.startsWith('https://')) {
        return `${base.replace('https://', 'wss://')}/ws`;
    }
    return `${base.replace('http://', 'ws://')}/ws`;
}

function notifyStatus(payload) {
    statusListeners.forEach((listener) => {
        try {
            listener(payload);
        } catch (error) {
            console.error('Error en listener de cloud-agent:', error);
        }
    });
}

function buildStatus(extra = {}) {
    const config = getCloudConfig();
    return {
        serverUrl: config.serverUrl,
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        connectionStatus: config.connectionStatus,
        connected: Boolean(ws && ws.readyState === WebSocket.OPEN),
        ...extra
    };
}

function isTextContentType(contentType) {
    const value = String(contentType || '').toLowerCase();
    return value.includes('application/json')
        || value.startsWith('text/')
        || value.includes('application/javascript')
        || value.includes('application/xml');
}

function dispatchLocalApi({ method, path: apiPath, body, query }) {
    return new Promise((resolve, reject) => {
        const queryString = new URLSearchParams(query || {}).toString();
        const targetPath = queryString ? `${apiPath}?${queryString}` : apiPath;
        const payload = body == null ? null : JSON.stringify(body);

        const req = http.request({
            hostname: INTERNAL_API_HOST,
            port: INTERNAL_API_PORT,
            path: targetPath,
            method: method.toUpperCase(),
            headers: {
                'content-type': 'application/json',
                'content-length': payload ? Buffer.byteLength(payload) : 0
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = String(res.headers['content-type'] || '');
                const headers = {
                    'content-type': contentType
                };

                if (res.headers['content-disposition']) {
                    headers['content-disposition'] = res.headers['content-disposition'];
                }

                if (isTextContentType(contentType)) {
                    let parsed = buffer.toString('utf8');
                    if (contentType.includes('application/json')) {
                        try {
                            parsed = JSON.parse(parsed);
                        } catch (error) {
                            // Mantener texto crudo.
                        }
                    }
                    resolve({
                        status: res.statusCode || 500,
                        body: parsed,
                        headers
                    });
                    return;
                }

                resolve({
                    status: res.statusCode || 500,
                    body: buffer.toString('base64'),
                    headers: {
                        ...headers,
                        'x-body-encoding': 'base64'
                    }
                });
            });
        });

        req.on('error', reject);

        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function sendWs(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function clearTimers() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

function scheduleReconnect() {
    if (!shouldRun || reconnectTimer) {
        return;
    }
    // Backoff exponencial con jitter: evita martillear el servidor cuando la
    // red cae o el equipo acaba de despertar de suspensión.
    const base = Math.min(MAX_RECONNECT_DELAY_MS, RECONNECT_DELAY_MS * Math.pow(2, Math.min(reconnectAttempts, 5)));
    const delay = Math.round(base + Math.random() * base * 0.25);
    reconnectAttempts += 1;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectCloudAgent().catch((error) => {
            console.error('Reintento de conexión cloud falló:', error.message);
            scheduleReconnect();
        });
    }, delay);
}

async function handleWsMessage(message) {
    lastMessageAt = Date.now();

    if (message.type === 'connected') {
        reconnectAttempts = 0;
        saveConnectionStatus('connected');
        notifyStatus(buildStatus({ event: 'connected' }));
        return;
    }

    if (message.type === 'error') {
        notifyStatus(buildStatus({ event: 'error', error: message.message }));
        if (message.code === 'UNAUTHORIZED' || message.status === 401) {
            handleAuthFailure();
        }
        return;
    }

    if (message.type === 'api') {
        const runRequest = async () => {
            const result = await dispatchLocalApi({
                method: message.method,
                path: message.path,
                body: message.body,
                query: message.query
            });

            if (!message.fireAndForget) {
                sendWs({
                    type: 'api_response',
                    requestId: message.requestId,
                    status: result.status,
                    body: result.body,
                    headers: result.headers
                });
            }
        };

        if (message.fireAndForget) {
            runRequest().catch((error) => {
                console.error('Error en petición fire-and-forget:', error.message);
            });
            return;
        }

        try {
            await runRequest();
        } catch (error) {
            sendWs({
                type: 'api_response',
                requestId: message.requestId,
                status: 500,
                error: error.message || 'Error al ejecutar comando local.'
            });
        }
    }
}

function bindSocketHandlers(socket) {
    socket.on('open', () => {
        clearTimers();
        reconnectAttempts = 0;
        lastMessageAt = Date.now();
        const config = getCloudConfig();

        if (!config.deviceToken) {
            saveConnectionStatus('disconnected');
            notifyStatus(buildStatus({ event: 'no_token' }));
            socket.close(4401, 'device token required');
            return;
        }

        sendWs({ type: 'device_auth', token: config.deviceToken });

        heartbeatTimer = setInterval(() => {
            if (Date.now() - lastMessageAt > STALE_CONNECTION_MS) {
                // Conexión zombi (red cambiada, suspensión, NAT): se recicla.
                console.warn('WebSocket cloud sin actividad; reconectando.');
                try {
                    socket.terminate();
                } catch (error) {
                    // Ignorar.
                }
                return;
            }
            sendWs({ type: 'heartbeat' });
            try {
                socket.ping();
            } catch (error) {
                // Ignorar.
            }
        }, HEARTBEAT_INTERVAL_MS);

        saveConnectionStatus('connecting');
        notifyStatus(buildStatus({ event: 'socket_open' }));
    });

    socket.on('pong', () => {
        lastMessageAt = Date.now();
    });

    socket.on('message', (raw) => {
        lastMessageAt = Date.now();
        try {
            const message = JSON.parse(String(raw));
            handleWsMessage(message).catch((error) => {
                console.error('Error procesando mensaje cloud:', error);
            });
        } catch (error) {
            console.error('Mensaje cloud inválido:', error.message);
        }
    });

    socket.on('close', (code) => {
        // Socket antiguo ya reemplazado por una conexión nueva: su cierre no
        // debe afectar a la conexión activa.
        if (socket !== ws) {
            return;
        }
        ws = null;
        clearTimers();
        saveConnectionStatus('disconnected');
        notifyStatus(buildStatus({ event: 'socket_close', code }));

        // 4401/4403: el token del dispositivo ya no es válido. Se intenta
        // renovar la sesión y volver a registrar el equipo sin molestar al
        // usuario.
        if (code === 4401 || code === 4403) {
            handleAuthFailure().then((reconnected) => {
                if (!reconnected) {
                    scheduleReconnect();
                }
            });
            return;
        }
        scheduleReconnect();
    });

    socket.on('error', (error) => {
        console.error('WebSocket cloud error:', error.message);
    });
}

async function handleAuthFailure() {
    if (authRetryInFlight || typeof handlers.onUnauthorized !== 'function') {
        return false;
    }
    // Evita bucles de re-registro si el servidor sigue rechazando el token.
    if (Date.now() - lastAuthAttemptAt < 60_000) {
        console.warn('Renovación de autenticación omitida (intento reciente).');
        return false;
    }
    lastAuthAttemptAt = Date.now();
    authRetryInFlight = true;
    try {
        const result = await handlers.onUnauthorized();
        if (result && result.ok) {
            reconnectAttempts = 0;
            await connectCloudAgent();
            return true;
        }
        return false;
    } catch (error) {
        console.error('No se pudo renovar la autenticación cloud:', error.message);
        return false;
    } finally {
        authRetryInFlight = false;
    }
}

async function connectCloudAgent() {
    if (!shouldRun) {
        return buildStatus();
    }

    // Ya hay un intento en curso: no se duplica la conexión.
    if (ws && ws.readyState === WebSocket.CONNECTING) {
        return buildStatus();
    }

    const config = getCloudConfig();
    const wsUrl = getWsUrl(config.serverUrl);

    if (ws) {
        try {
            ws.terminate();
        } catch (error) {
            // Ignorar.
        }
        ws = null;
    }

    return new Promise((resolve) => {
        const socket = new WebSocket(wsUrl);
        ws = socket;
        bindSocketHandlers(socket);
        socket.once('open', () => resolve(buildStatus()));
        socket.once('error', () => resolve(buildStatus({ error: 'No se pudo conectar al servidor cloud.' })));
    });
}

function startCloudAgent({ force = false } = {}) {
    const config = getCloudConfig();
    if (!config.deviceToken) {
        return Promise.resolve(buildStatus({ error: 'Sin token de dispositivo.' }));
    }
    shouldRun = true;

    if (!force && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return Promise.resolve(buildStatus());
    }

    reconnectAttempts = 0;
    return connectCloudAgent();
}

function stopCloudAgent() {
    shouldRun = false;
    clearTimers();
    if (ws) {
        try {
            ws.close();
        } catch (error) {
            // Ignorar.
        }
        ws = null;
    }
    saveConnectionStatus('disconnected');
    return buildStatus();
}

function onCloudStatus(listener) {
    statusListeners.push(listener);
    return () => {
        statusListeners = statusListeners.filter((item) => item !== listener);
    };
}

/**
 * Registra los callbacks que permiten recuperar la sesión cuando el servidor
 * rechaza el token del dispositivo.
 */
function setAuthHandlers(nextHandlers = {}) {
    handlers = { ...handlers, ...nextHandlers };
}

function getCloudStatus() {
    return buildStatus();
}

module.exports = {
    startCloudAgent,
    stopCloudAgent,
    connectCloudAgent,
    onCloudStatus,
    setAuthHandlers,
    getCloudStatus
};
