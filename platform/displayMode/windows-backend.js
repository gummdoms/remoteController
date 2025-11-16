const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);
const backendName = 'windows-display-switch';
const MODE_ARGUMENTS = {
    internal: '/internal',
    clone: '/clone',
    extend: '/extend',
    external: '/external'
};
const LEGACY_CODES = {
    internal: '4500',
    external: '4501',
    clone: '4502',
    extend: '4503'
};
const LEGACY_TO_MODE = Object.entries(LEGACY_CODES).reduce((acc, [mode, code]) => {
    acc[code] = mode;
    return acc;
}, {});
const scriptPath = path.join(__dirname, '..', '..', 'GetDisplayState.ps1');
const isWindows = process.platform === 'win32';
const unavailableReason = 'DisplaySwitch.exe solo está disponible en Windows.';

const scriptContents = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DisplaySwitchHelper {
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
"@
$primaryMonitor = [DisplaySwitchHelper]::GetSystemMetrics(80)
$otherMonitors = [DisplaySwitchHelper]::GetSystemMetrics(79)
if ($primaryMonitor -eq 0) {
    Write-Output "4500"
} elseif ($otherMonitors -eq 1) {
    Write-Output "4501"
} elseif ($otherMonitors -eq 2) {
    Write-Output "4502"
} elseif ($otherMonitors -ge 3) {
    Write-Output "4503"
} else {
    Write-Output "4600"
}
`;

function ensureScriptFile() {
    if (!fs.existsSync(scriptPath)) {
        fs.writeFileSync(scriptPath, scriptContents, 'utf8');
    }
    return scriptPath;
}

function isSupported() {
    return isWindows;
}

async function setMode(mode) {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    const arg = MODE_ARGUMENTS[mode];
    if (!arg) {
        throw new Error(`Modo de pantalla no soportado: ${mode}`);
    }
    await execFileAsync('DisplaySwitch.exe', [arg]);
}

async function readLegacyCode() {
    const file = ensureScriptFile();
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-File', file]);
    return stdout.toString().trim();
}

async function getState() {
    if (!isSupported()) {
        throw new Error(unavailableReason);
    }
    try {
        const legacyCode = await readLegacyCode();
        const mode = LEGACY_TO_MODE[legacyCode] || 'unknown';
        return { mode, legacyCode };
    } catch (error) {
        console.warn('No se pudo obtener el estado de pantallas en Windows:', error.message);
        return { mode: 'unknown', legacyCode: null };
    }
}

module.exports = {
    name: backendName,
    isSupported,
    getUnavailableReason: () => unavailableReason,
    setMode,
    getState
};
