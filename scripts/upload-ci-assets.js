#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dataLake = require('./data-lake');

function listFiles(dir) {
    if (!dir || !fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .map((name) => path.join(dir, name))
        .filter((filePath) => fs.statSync(filePath).isFile());
}

/**
 * Los nombres de carpeta dependen de cómo se descarguen los artefactos en CI
 * (`release-assets/windows` o `release-assets/windows-installer`, etc.).
 */
function resolveDir(root, candidates) {
    for (const candidate of candidates) {
        const full = path.join(root, candidate);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
            return full;
        }
    }
    return null;
}

async function uploadFiles(files, relativePath, releasesBase) {
    for (const filePath of files) {
        const result = await dataLake.uploadFileFromDisk(filePath, relativePath);
        const name = path.basename(filePath);
        console.log(`[datalake] ${name}`);
        console.log(`           ${result.url}`);
        if (releasesBase) {
            console.log(`           ${releasesBase}/${relativePath.replace(/^releases\//, '')}/${name}`);
        }
    }
}

async function main() {
    if (!dataLake.isConfigured()) {
        console.log('[datalake] omitido: faltan secrets DATA_LAKE_*');
        return;
    }

    const assetsRoot = process.argv[2] || path.join(__dirname, '..', 'release-assets');
    const version = require(path.join(__dirname, '..', 'package.json')).version;
    const releasesBase = String(process.env.RELEASES_BASE || 'https://datalake.dambra-os.com/public/remote-controller/releases').replace(/\/+$/, '');

    const windowsDir = resolveDir(assetsRoot, ['windows', 'windows-installer']);
    const linuxDir = resolveDir(assetsRoot, ['linux', 'linux-appimage']);
    const archDir = resolveDir(assetsRoot, ['arch', 'archlinux-package']);
    const archRepoDir = archDir ? resolveDir(archDir, ['repo', 'datalake-upload']) : null;

    console.log(`[datalake] subiendo release v${version} desde ${assetsRoot}`);
    console.log(`[datalake] releases base: ${releasesBase}`);

    await uploadFiles(listFiles(windowsDir), 'releases/windows', releasesBase);
    await uploadFiles(listFiles(linuxDir), 'releases/linux', releasesBase);
    await uploadFiles(listFiles(archDir), 'releases/arch/x86_64', releasesBase);
    await uploadFiles(listFiles(archRepoDir), 'releases/arch/x86_64', releasesBase);

    console.log('[datalake] listo');
}

main().catch((error) => {
    console.error('[datalake] error:', error.message);
    process.exit(1);
});
