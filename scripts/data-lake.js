const path = require('path');

const STORAGE_ROOT = String(process.env.DATA_LAKE_STORAGE_PATH || 'public/remote-controller').replace(/\/+$/, '');

// Cloudflare corta a 100 MB por petición; por un host directo (Tailscale) no.
const REQUEST_TIMEOUT_MS = Number(process.env.DATA_LAKE_TIMEOUT_MS || 15 * 60 * 1000);

/**
 * fetch con timeout: sin esto, un host inalcanzable (p. ej. Tailscale caído)
 * deja el job colgado hasta el timeout del runner.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Tiempo de espera agotado (${Math.round(timeoutMs / 1000)} s) al contactar ${url}`);
        }
        throw new Error(`No se pudo contactar ${url}: ${error.message}`);
    } finally {
        clearTimeout(timer);
    }
}

let cachedToken = null;
let tokenExpiresAt = 0;

function getBaseUrl() {
    return String(process.env.DATA_LAKE_URL || '').replace(/\/+$/, '');
}

/**
 * Host que se usa para SUBIR archivos. Puede ser distinto del público para
 * esquivar el límite de 100 MB por petición de Cloudflare (plan Free/Pro):
 * por ejemplo un subdominio sin proxy, la IP de Tailscale o un túnel SSH.
 */
function getUploadBaseUrl() {
    return String(process.env.DATA_LAKE_UPLOAD_URL || process.env.DATA_LAKE_URL || '').replace(/\/+$/, '');
}

function isConfigured() {
    return Boolean(getUploadBaseUrl() && process.env.DATA_LAKE_USER && process.env.DATA_LAKE_PASSWORD);
}

function assertConfigured() {
    if (!isConfigured()) {
        throw new Error('Faltan variables DATA_LAKE_URL, DATA_LAKE_USER o DATA_LAKE_PASSWORD.');
    }
}

async function login() {
    assertConfigured();
    const response = await fetchWithTimeout(`${getUploadBaseUrl()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: process.env.DATA_LAKE_USER,
            password: process.env.DATA_LAKE_PASSWORD
        })
    }, 60_000);

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Data lake login falló (${response.status}): ${text || 'sin detalle'}`);
    }

    const payload = await response.json();
    if (!payload?.token) {
        throw new Error('Data lake no devolvió token.');
    }

    cachedToken = payload.token;
    tokenExpiresAt = Date.now() + (50 * 60 * 1000);
    return cachedToken;
}

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }
    return login();
}

function normalizeStoragePath(relativePath = '') {
    const clean = String(relativePath || '').replace(/^\/+/, '').replace(/\/+$/, '');
    return clean ? `${STORAGE_ROOT}/${clean}` : STORAGE_ROOT;
}

function buildPublicFileUrl(filename, relativePath = '') {
    const baseUrl = getBaseUrl();
    const storagePath = normalizeStoragePath(relativePath);
    const params = new URLSearchParams({
        path: storagePath,
        filename
    });
    return `${baseUrl}/public/file?${params.toString()}`;
}

function buildPublicPathUrl(filename, relativePath = '') {
    const baseUrl = getBaseUrl();
    const storagePath = normalizeStoragePath(relativePath);
    return `${baseUrl}/${storagePath}/${filename}`;
}

async function uploadFile(filename, buffer, relativePath = '', mimeType = 'application/octet-stream') {
    assertConfigured();
    const token = await getToken();
    const storagePath = `${normalizeStoragePath(relativePath)}/`;
    const form = new FormData();
    form.append('path', storagePath);
    form.append('filename', filename);
    form.append('file', new Blob([buffer], { type: mimeType }), filename);

    const response = await fetchWithTimeout(`${getUploadBaseUrl()}/data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
    });

    if (response.status === 413) {
        throw new Error(
            `413 Payload Too Large al subir ${filename}. Cloudflare limita el cuerpo de la petición a 100 MB ` +
            '(planes Free/Pro). Define DATA_LAKE_UPLOAD_URL con un hostname SIN proxy de Cloudflare ' +
            '(subdominio con DNS-only, IP de Tailscale o túnel SSH) o sube los binarios a Cloudflare R2.'
        );
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`No se pudo subir ${filename} (${response.status}): ${text || 'sin detalle'}`);
    }

    const payload = await response.json().catch(() => ({}));
    const savedName = payload?.filename || filename;

    return {
        filename: savedName,
        url: buildPublicFileUrl(savedName, relativePath),
        pathUrl: buildPublicPathUrl(savedName, relativePath)
    };
}

async function uploadFileFromDisk(filePath, relativePath = '') {
    const fs = require('fs');
    const filename = path.basename(filePath);
    const buffer = fs.readFileSync(filePath);
    return uploadFile(filename, buffer, relativePath);
}

async function deleteFile(filename, relativePath = '') {
    assertConfigured();
    const safeName = String(filename || '').trim();
    if (!safeName) {
        return { skipped: true };
    }

    const token = await getToken();
    const params = new URLSearchParams({
        path: normalizeStoragePath(relativePath),
        filename: safeName
    });

    const response = await fetchWithTimeout(`${getUploadBaseUrl()}/data/?${params.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    }, 60_000);

    if (response.status === 404) {
        return { ok: true, missing: true };
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`No se pudo eliminar ${safeName} (${response.status}): ${text || 'sin detalle'}`);
    }

    return { ok: true };
}

module.exports = {
    STORAGE_ROOT,
    isConfigured,
    buildPublicFileUrl,
    buildPublicPathUrl,
    uploadFile,
    uploadFileFromDisk,
    deleteFile,
    normalizeStoragePath,
    getBaseUrl,
    getUploadBaseUrl
};
