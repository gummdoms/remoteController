const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const {
    getCloudConfig,
    saveCloudCredentials,
    saveConnectionStatus,
    clearDeviceCredentials
} = require('./device-store');

const INTERNAL_API_HOST = process.env.INTERNAL_API_HOST || '127.0.0.1';
const INTERNAL_API_PORT = Number(process.env.INTERNAL_API_PORT || 4800);
const RECONNECT_DELAY_MS = Number(process.env.CLOUD_RECONNECT_MS || 5000);

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let shouldRun = false;
let statusListeners = [];

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
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed = raw;
                const contentType = String(res.headers['content-type'] || '');
                if (contentType.includes('application/json')) {
                    try {
                        parsed = JSON.parse(raw);
                    } catch (error) {
                        parsed = raw;
                    }
                }
                resolve({
                    status: res.statusCode || 500,
                    body: parsed,
                    headers: {
                        'content-type': contentType
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
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectCloudAgent().catch((error) => {
            console.error('Reintento de conexión cloud falló:', error.message);
            scheduleReconnect();
        });
    }, RECONNECT_DELAY_MS);
}

async function handleWsMessage(message) {
    if (message.type === 'connected') {
        saveConnectionStatus('connected');
        notifyStatus(buildStatus({ event: 'connected' }));
        return;
    }

    if (message.type === 'error') {
        notifyStatus(buildStatus({ event: 'error', error: message.message }));
        return;
    }

    if (message.type === 'api') {
        try {
            const result = await dispatchLocalApi({
                method: message.method,
                path: message.path,
                body: message.body,
                query: message.query
            });
            sendWs({
                type: 'api_response',
                requestId: message.requestId,
                status: result.status,
                body: result.body,
                headers: result.headers
            });
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
        const config = getCloudConfig();

        if (!config.deviceToken) {
            saveConnectionStatus('disconnected');
            notifyStatus(buildStatus({ event: 'no_token' }));
            socket.close(4401, 'device token required');
            return;
        }

        sendWs({ type: 'device_auth', token: config.deviceToken });

        heartbeatTimer = setInterval(() => {
            sendWs({ type: 'heartbeat' });
        }, 25_000);

        saveConnectionStatus('connecting');
        notifyStatus(buildStatus({ event: 'socket_open' }));
    });

    socket.on('message', (raw) => {
        try {
            const message = JSON.parse(String(raw));
            handleWsMessage(message).catch((error) => {
                console.error('Error procesando mensaje cloud:', error);
            });
        } catch (error) {
            console.error('Mensaje cloud inválido:', error.message);
        }
    });

    socket.on('close', () => {
        ws = null;
        clearTimers();
        saveConnectionStatus('disconnected');
        notifyStatus(buildStatus({ event: 'socket_close' }));
        scheduleReconnect();
    });

    socket.on('error', (error) => {
        console.error('WebSocket cloud error:', error.message);
    });
}

async function connectCloudAgent() {
    if (!shouldRun) {
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

function startCloudAgent() {
    const config = getCloudConfig();
    if (!config.deviceToken) {
        return Promise.resolve(buildStatus({ error: 'Sin token de dispositivo.' }));
    }
    shouldRun = true;
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

function getCloudStatus() {
    return buildStatus();
}

module.exports = {
    startCloudAgent,
    stopCloudAgent,
    connectCloudAgent,
    onCloudStatus,
    getCloudStatus
};
