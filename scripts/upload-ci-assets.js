#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dataLake = require('./data-lake');

function listFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .map((name) => path.join(dir, name))
        .filter((filePath) => fs.statSync(filePath).isFile());
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

    console.log(`[datalake] subiendo release v${version} desde ${assetsRoot}`);
    console.log(`[datalake] releases base: ${releasesBase}`);

    await uploadFiles(listFiles(path.join(assetsRoot, 'windows')), 'releases/windows', releasesBase);
    await uploadFiles(listFiles(path.join(assetsRoot, 'linux')), 'releases/linux', releasesBase);
    await uploadFiles(listFiles(path.join(assetsRoot, 'arch')), 'releases/arch/x86_64', releasesBase);
    await uploadFiles(listFiles(path.join(assetsRoot, 'arch', 'repo')), 'releases/arch/x86_64', releasesBase);

    console.log('[datalake] listo');
}

main().catch((error) => {
    console.error('[datalake] error:', error.message);
    process.exit(1);
});
