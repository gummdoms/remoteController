// Detección e instalación de las herramientas opcionales que usa la app en
// Linux (audio, brillo, modos de pantalla, permisos).
//
// El paquete pacman ya declara sus dependencias en `depends` (pacman las
// instala solo). Este módulo cubre el resto de casos: AppImage en cualquier
// distribución, y herramientas que dependen del escritorio (kscreen, wlr-randr,
// pipewire…), instalándolas con el gestor de paquetes del sistema vía pkexec.

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALL_TIMEOUT_MS = Number(process.env.DEP_INSTALL_TIMEOUT_MS || 10 * 60 * 1000);

function commandExists(binary) {
    if (!binary) {
        return false;
    }
    const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const fallbackDirs = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
    return [...dirs, ...fallbackDirs].some((dir) => {
        try {
            const full = path.join(dir, binary);
            fs.accessSync(full, fs.constants.X_OK);
            return true;
        } catch (error) {
            return false;
        }
    });
}

function readOsRelease() {
    try {
        const raw = fs.readFileSync('/etc/os-release', 'utf8');
        const entries = {};
        raw.split(/\r?\n/).forEach((line) => {
            const match = line.match(/^([A-Z_]+)=(.*)$/);
            if (!match) {
                return;
            }
            entries[match[1]] = match[2].replace(/^["']|["']$/g, '');
        });
        const id = (entries.ID || '').toLowerCase();
        const like = (entries.ID_LIKE || '').toLowerCase();
        return {
            id: id || 'linux',
            name: entries.PRETTY_NAME || entries.NAME || id || 'Linux',
            like: like ? like.split(/\s+/) : []
        };
    } catch (error) {
        return { id: 'linux', name: 'Linux', like: [] };
    }
}

const MANAGERS = [
    { id: 'pacman', bin: 'pacman' },
    { id: 'apt', bin: 'apt-get' },
    { id: 'dnf', bin: 'dnf' },
    { id: 'zypper', bin: 'zypper' },
    { id: 'apk', bin: 'apk' }
];

function detectManager() {
    const found = MANAGERS.find((entry) => commandExists(entry.bin));
    return found ? found.id : null;
}

function sessionInfo() {
    const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
    const desktop = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''}`.toLowerCase();
    return {
        wayland: sessionType === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY),
        kde: /kde|plasma/.test(desktop),
        hyprland: Boolean(process.env.HYPRLAND_INSTANCE_SIGNATURE) || /hyprland/.test(desktop),
        sway: Boolean(process.env.SWAYSOCK) || /sway/.test(desktop)
    };
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

/**
 * Devuelve el binario preferido para los modos de pantalla según la sesión.
 */
function preferredDisplayTool() {
    const session = sessionInfo();

    if (session.hyprland) {
        return {
            bin: 'hyprctl',
            builtin: true,
            packages: {
                pacman: ['hyprland'],
                apt: [],
                dnf: [],
                zypper: [],
                apk: []
            },
            hint: 'hyprctl viene incluido con Hyprland.'
        };
    }

    if (session.kde && session.wayland) {
        return {
            bin: 'kscreen-doctor',
            packages: {
                pacman: ['kscreen'],
                apt: ['kscreen'],
                dnf: ['kscreen'],
                zypper: ['kscreen6'],
                apk: []
            },
            hint: 'Requerido para cambiar de modo de pantalla en KDE Wayland.'
        };
    }

    if (session.wayland) {
        return {
            bin: 'wlr-randr',
            packages: {
                pacman: ['wlr-randr'],
                apt: ['wlr-randr'],
                dnf: ['wlr-randr'],
                zypper: ['wlr-randr'],
                apk: ['wlr-randr']
            },
            hint: 'Requerido para cambiar de modo de pantalla en Sway/wlroots.'
        };
    }

    return {
        bin: 'xrandr',
        packages: {
            pacman: ['xorg-xrandr'],
            apt: ['x11-xserver-utils'],
            dnf: ['xrandr'],
            zypper: ['xrandr'],
            apk: ['xrandr']
        },
        hint: 'Requerido para cambiar de modo de pantalla en X11.'
    };
}

const FEATURES = [
    {
        id: 'audio',
        label: 'Control de volumen',
        anyOf: ['wpctl', 'pactl'],
        packages: {
            pacman: ['pipewire'],
            apt: ['pipewire-bin'],
            dnf: ['wireplumber'],
            zypper: ['pipewire-tools'],
            apk: ['pipewire']
        },
        hint: 'Necesario para subir, bajar o silenciar el volumen desde el móvil.'
    },
    {
        id: 'brightness',
        label: 'Brillo y contraste',
        anyOf: ['ddcutil'],
        packages: {
            pacman: ['ddcutil'],
            apt: ['ddcutil'],
            dnf: ['ddcutil'],
            zypper: ['ddcutil'],
            apk: ['ddcutil']
        },
        hint: 'Necesario para ajustar brillo y contraste (monitores por DDC/CI).'
    },
    {
        id: 'polkit',
        label: 'Permisos automáticos',
        anyOf: ['pkexec'],
        packages: {
            pacman: ['polkit'],
            apt: ['pkexec'],
            dnf: ['polkit'],
            zypper: ['polkit'],
            apk: ['polkit']
        },
        hint: 'Permite aplicar la configuración de /dev/uinput con un diálogo del sistema.'
    }
];

function evaluateFeature(feature, manager) {
    const found = feature.anyOf.find(commandExists) || null;
    const packages = found || !manager ? [] : (feature.packages[manager] || []);
    return {
        id: feature.id,
        label: feature.label,
        ok: Boolean(found),
        binary: found,
        candidates: feature.anyOf,
        packages,
        hint: feature.hint,
        installable: Boolean(manager && packages.length)
    };
}

function evaluateDisplay(manager) {
    const tool = preferredDisplayTool();
    const found = commandExists(tool.bin);
    const packages = found || !manager ? [] : (tool.packages[manager] || []);
    return {
        id: 'display',
        label: 'Modos de pantalla',
        ok: found || Boolean(tool.builtin),
        binary: tool.bin,
        candidates: [tool.bin],
        packages,
        hint: tool.hint,
        installable: Boolean(manager && packages.length),
        builtin: Boolean(tool.builtin)
    };
}

function getStatus() {
    if (process.platform !== 'linux') {
        return {
            supported: false,
            platform: process.platform,
            message: 'La instalación automática de dependencias solo aplica en Linux.',
            features: [],
            missingPackages: [],
            needsInstall: false
        };
    }

    const distro = readOsRelease();
    const manager = detectManager();
    const features = [
        ...FEATURES.map((feature) => evaluateFeature(feature, manager)),
        evaluateDisplay(manager)
    ];

    const missingPackages = [...new Set(
        features.flatMap((feature) => (feature.ok ? [] : feature.packages))
    )];

    const needsInstall = missingPackages.length > 0;

    return {
        supported: true,
        platform: process.platform,
        distro,
        manager,
        canInstall: Boolean(manager && commandExists('pkexec')),
        features,
        missingPackages,
        needsInstall,
        message: needsInstall
            ? `Faltan ${missingPackages.length} componente(s) para todas las funciones.`
            : 'Todas las herramientas necesarias están instaladas.'
    };
}

function buildInstallScript(manager, packages) {
    const quoted = packages.map(shellQuote).join(' ');
    const header = '#!/bin/bash\nset -e\n';

    switch (manager) {
        case 'pacman':
            return `${header}pacman -Sy --needed --noconfirm ${quoted}\n`;
        case 'apt':
            return `${header}export DEBIAN_FRONTEND=noninteractive\napt-get update\napt-get install -y ${quoted}\n`;
        case 'dnf':
            return `${header}dnf install -y ${quoted}\n`;
        case 'zypper':
            return `${header}zypper --non-interactive install ${quoted}\n`;
        case 'apk':
            return `${header}apk add --no-cache ${quoted}\n`;
        default:
            throw new Error('No se detectó un gestor de paquetes compatible.');
    }
}

function getManualCommand() {
    const status = getStatus();
    if (!status.supported || !status.needsInstall) {
        return null;
    }
    if (!status.manager) {
        return null;
    }
    return buildInstallScript(status.manager, status.missingPackages)
        .split('\n')
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('set -e'))
        .join(' && ');
}

function runPrivileged(scriptPath) {
    return new Promise((resolve, reject) => {
        execFile(
            'pkexec',
            ['/bin/bash', scriptPath],
            { timeout: INSTALL_TIMEOUT_MS },
            (error, stdout, stderr) => {
                if (error) {
                    error.stdout = stdout;
                    error.stderr = stderr;
                    return reject(error);
                }
                resolve({ stdout, stderr });
            }
        );
    });
}

/**
 * Instala los paquetes que falten usando el gestor del sistema (pkexec).
 */
async function installMissing() {
    const before = getStatus();

    if (!before.supported) {
        throw new Error('La instalación automática de dependencias solo aplica en Linux.');
    }
    if (!before.needsInstall) {
        return {
            ok: true,
            installed: [],
            message: 'Todas las herramientas necesarias ya están instaladas.',
            status: before
        };
    }
    if (!before.manager) {
        throw new Error('No se detectó un gestor de paquetes compatible (pacman, apt, dnf, zypper o apk).');
    }
    if (!commandExists('pkexec')) {
        throw new Error('Falta polkit (pkexec). Instálalo manualmente y vuelve a intentarlo.');
    }

    const script = buildInstallScript(before.manager, before.missingPackages);
    const scriptPath = path.join(os.tmpdir(), `remotecontrollers-deps-${Date.now()}.sh`);
    fs.writeFileSync(scriptPath, script, { mode: 0o700 });

    try {
        await runPrivileged(scriptPath);
    } catch (error) {
        if (error.code === 126 || /dismissed|not authorized|No autorizado/i.test(String(error.message) + String(error.stderr))) {
            throw new Error('Instalación cancelada: no se autorizaron los permisos de administrador.');
        }
        const detail = String(error.stderr || error.message || '').trim().split('\n').slice(-3).join(' ');
        throw new Error(`No se pudieron instalar las dependencias: ${detail}`);
    } finally {
        try {
            fs.unlinkSync(scriptPath);
        } catch (error) {
            // Ignorar limpieza.
        }
    }

    const after = getStatus();
    return {
        ok: !after.needsInstall,
        installed: before.missingPackages,
        remaining: after.missingPackages,
        message: after.needsInstall
            ? `Se instalaron ${before.missingPackages.length} paquete(s), pero aún faltan: ${after.missingPackages.join(', ')}`
            : 'Dependencias instaladas correctamente.',
        status: after
    };
}

module.exports = {
    getStatus,
    installMissing,
    getManualCommand,
    commandExists
};
