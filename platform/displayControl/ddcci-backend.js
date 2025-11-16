const backendName = 'ddcci';
let ddcci = null;
try {
    ddcci = require('@hensm/ddcci');
} catch (error) {
    ddcci = null;
}

const isSupported = () => Boolean(ddcci);
const unavailableReason = 'El control DDC/CI no está disponible. Instala la dependencia opcional @hensm/ddcci o habilita ddcutil en Linux.';

function ensureLoaded() {
    if (!ddcci) {
        const error = new Error(unavailableReason);
        error.code = 'DISPLAY_UNAVAILABLE';
        throw error;
    }
}

function getMonitorHandles() {
    ensureLoaded();
    try {
        const list = ddcci.getMonitorList();
        return Array.isArray(list) ? list : [];
    } catch (error) {
        console.warn('No se pudo obtener la lista de monitores DDC/CI:', error.message);
        return [];
    }
}

function getMonitorInfos() {
    const handles = getMonitorHandles();
    return handles.map((handle, index) => {
        const candidateLabel = handle?.description || handle?.name || handle?.manufacturer || handle?.path;
        const label = candidateLabel ? String(candidateLabel).trim() : `Monitor ${index + 1}`;
        return {
            id: `ddcci-${index + 1}`,
            label,
            handle,
            index
        };
    });
}

function pickInfosById(infos, displayId) {
    if (!displayId) {
        return infos;
    }
    const normalized = String(displayId).toLowerCase();
    const filtered = infos.filter((info) => {
        const aliases = [
            info.id,
            info.label,
            `monitor-${info.index + 1}`,
            String(info.index + 1)
        ].filter(Boolean).map((value) => String(value).toLowerCase());
        return aliases.includes(normalized);
    });
    return filtered.length ? filtered : infos;
}

async function setBrightness(value, displayId) {
    ensureLoaded();
    const infos = pickInfosById(getMonitorInfos(), displayId);
    await Promise.all(infos.map(async (info) => {
        try {
            if (typeof ddcci.setBrightness === 'function') {
                await ddcci.setBrightness(info.handle, value);
                return;
            }
            if (typeof ddcci.setVcpValue === 'function') {
                await ddcci.setVcpValue(info.handle, 0x10, value);
                return;
            }
            throw new Error('La API de DDC/CI no expone setBrightness ni setVcpValue');
        } catch (error) {
            console.warn(`No se pudo ajustar el brillo del monitor ${info.label}:`, error.message);
        }
    }));
}

async function readBrightness(info) {
    if (typeof ddcci.getBrightness === 'function') {
        return ddcci.getBrightness(info.handle);
    }
    if (typeof ddcci.getVcpValue === 'function') {
        const vcp = await ddcci.getVcpValue(info.handle, 0x10);
        if (vcp && typeof vcp.current === 'number' && typeof vcp.max === 'number' && vcp.max > 0) {
            return Math.round((vcp.current / vcp.max) * 100);
        }
    }
    return null;
}

async function getBrightnessList(displayId) {
    ensureLoaded();
    const infos = pickInfosById(getMonitorInfos(), displayId);
    const values = [];
    for (const info of infos) {
        try {
            const value = await readBrightness(info);
            if (value !== null) {
                values.push({ id: info.id, label: info.label, value });
            }
        } catch (error) {
            console.warn(`No se pudo leer el brillo del monitor ${info.label}:`, error.message);
        }
    }
    return values;
}

async function setContrast(value, displayId) {
    ensureLoaded();
    const infos = pickInfosById(getMonitorInfos(), displayId);
    await Promise.all(infos.map(async (info) => {
        try {
            if (typeof ddcci.setContrast === 'function') {
                await ddcci.setContrast(info.handle, value);
                return;
            }
            if (typeof ddcci.setVcpValue === 'function') {
                await ddcci.setVcpValue(info.handle, 0x12, value);
                return;
            }
            throw new Error('La API de DDC/CI no expone setContrast ni setVcpValue');
        } catch (error) {
            console.warn(`No se pudo ajustar el contraste del monitor ${info.label}:`, error.message);
        }
    }));
}

async function readContrast(info) {
    if (typeof ddcci.getContrast === 'function') {
        return ddcci.getContrast(info.handle);
    }
    if (typeof ddcci.getVcpValue === 'function') {
        const vcp = await ddcci.getVcpValue(info.handle, 0x12);
        if (vcp && typeof vcp.current === 'number' && typeof vcp.max === 'number' && vcp.max > 0) {
            return Math.round((vcp.current / vcp.max) * 100);
        }
    }
    return null;
}

async function getContrastList(displayId) {
    ensureLoaded();
    const infos = pickInfosById(getMonitorInfos(), displayId);
    const values = [];
    for (const info of infos) {
        try {
            const value = await readContrast(info);
            if (value !== null) {
                values.push({ id: info.id, label: info.label, value });
            }
        } catch (error) {
            console.warn(`No se pudo leer el contraste del monitor ${info.label}:`, error.message);
        }
    }
    return values;
}

module.exports = {
    name: backendName,
    isSupported,
    getUnavailableReason: () => unavailableReason,
    async getMonitorList() {
        if (!isSupported()) {
            return [];
        }
        return getMonitorInfos().map((info) => ({
            id: info.id,
            label: info.label,
            backend: backendName,
            info: {}
        }));
    },
    setBrightness,
    getBrightnessList,
    setContrast,
    getContrastList
};
