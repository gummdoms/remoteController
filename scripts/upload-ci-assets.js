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

function formatSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
}

/**
 * Sube una lista de archivos sin abortar el resto si uno falla: así un
 * binario demasiado grande (413 de Cloudflare) no impide publicar el resto.
 */
async function uploadFiles(files, relativePath, releasesBase, failures) {
    let uploaded = 0;

    for (const filePath of files) {
        const name = path.basename(filePath);
        const size = fs.statSync(filePath).size;
        try {
            const result = await dataLake.uploadFileFromDisk(filePath, relativePath);
            uploaded += 1;
            console.log(`[datalake] OK ${name} (${formatSize(size)})`);
            console.log(`           ${result.url}`);
            if (releasesBase) {
                console.log(`           ${releasesBase}/${relativePath.replace(/^releases\//, '')}/${name}`);
            }
        } catch (error) {
            failures.push({ name, relativePath, size, message: error.message });
            console.error(`[datalake] FALLO ${name} (${formatSize(size)}): ${error.message}`);
        }
    }

    return uploaded;
}

function writeSummary(failures, uploaded) {
    const lines = [];
    lines.push('### Data lake');
    lines.push('');
    lines.push(`- Archivos subidos: **${uploaded}**`);
    if (failures.length) {
        lines.push(`- Fallos: **${failures.length}**`);
        lines.push('');
        lines.push('| Archivo | Tamaño | Error |');
        lines.push('|---------|--------|-------|');
        failures.forEach((failure) => {
            const short = failure.message.replace(/[|\n]/g, ' ').slice(0, 160);
            lines.push(`| ${failure.name} | ${formatSize(failure.size)} | ${short} |`);
        });
    }
    const summary = `${lines.join('\n')}\n`;

    if (process.env.GITHUB_STEP_SUMMARY) {
        try {
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
        } catch (error) {
            // Sin resumen disponible.
        }
    }
    console.log(summary);
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

    const failures = [];
    let uploaded = 0;

    console.log(`[datalake] subiendo release v${version} desde ${assetsRoot}`);
    console.log(`[datalake] releases base: ${releasesBase}`);
    console.log(`[datalake] upload host: ${dataLake.getUploadBaseUrl()}`);

    uploaded += await uploadFiles(listFiles(windowsDir), 'releases/windows', releasesBase, failures);
    uploaded += await uploadFiles(listFiles(linuxDir), 'releases/linux', releasesBase, failures);

    // El índice pacman (bjrsoftware.db) solo tiene sentido si el paquete está
    // publicado: si el .pkg falla, se omite el índice para no dejar un
    // repositorio roto que devuelva 404 al descargar.
    const archItems = listFiles(archDir);
    const archPackages = archItems.filter((filePath) => filePath.endsWith('.pkg.tar.zst'));
    const archOthers = archItems.filter((filePath) => !filePath.endsWith('.pkg.tar.zst'));
    const repoItems = [...archOthers, ...listFiles(archRepoDir)];

    let packagesUploaded = 0;
    if (archPackages.length) {
        packagesUploaded = await uploadFiles(archPackages, 'releases/arch/x86_64', releasesBase, failures);
        uploaded += packagesUploaded;
    }

    if (repoItems.length) {
        if (archPackages.length && packagesUploaded === 0) {
            console.warn('[datalake] índice pacman omitido: el paquete no se pudo subir.');
            failures.push({
                name: path.basename(repoItems[0]),
                relativePath: 'releases/arch/x86_64',
                size: 0,
                message: 'Índice pacman omitido porque el .pkg.tar.zst falló'
            });
        } else {
            uploaded += await uploadFiles(repoItems, 'releases/arch/x86_64', releasesBase, failures);
        }
    }

    writeSummary(failures, uploaded);

    if (failures.length) {
        console.error(`[datalake] ${failures.length} archivo(s) no se pudieron subir.`);
        process.exitCode = 1;
        return;
    }

    console.log('[datalake] listo');
}

main().catch((error) => {
    console.error('[datalake] error:', error.message);
    process.exit(1);
});
