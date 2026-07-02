#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dataLake = require('./data-lake');

function loadEnvFile() {
    const candidates = [
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', '..', 'remoteControllerWeb', '.env')
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) {
            continue;
        }

        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
                continue;
            }
            const index = trimmed.indexOf('=');
            const key = trimmed.slice(0, index).trim();
            let value = trimmed.slice(index + 1).trim();
            value = value.replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
        return envPath;
    }

    return null;
}

function findArtifact(distDir, pattern) {
    const regex = new RegExp(pattern);
    return fs.readdirSync(distDir)
        .filter((name) => regex.test(name))
        .map((name) => path.join(distDir, name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
}

async function uploadIfExists(filePath, relativePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        console.log(`[release] omitido (no encontrado): ${relativePath}`);
        return null;
    }

    const result = await dataLake.uploadFileFromDisk(filePath, relativePath);
    console.log(`[release] ${path.basename(filePath)}`);
    console.log(`          ${result.url}`);
    return result;
}

async function main() {
    loadEnvFile();

    if (!dataLake.isConfigured()) {
        throw new Error('Configura DATA_LAKE_URL, DATA_LAKE_USER y DATA_LAKE_PASSWORD.');
    }

    const rootDir = path.join(__dirname, '..');
    const distDir = path.join(rootDir, 'dist');
    const version = require(path.join(rootDir, 'package.json')).version;

    console.log(`[release] subiendo artefactos v${version} al lago de datos`);

    await uploadIfExists(findArtifact(distDir, '\\.exe$'), 'releases/windows');
    await uploadIfExists(findArtifact(distDir, '\\.AppImage$'), 'releases/linux');
    await uploadIfExists(findArtifact(distDir, '\\.pkg\\.tar\\.zst$'), 'releases/arch/x86_64');

    const uploadDir = path.join(distDir, 'datalake-upload');
    if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir).map((name) => path.join(uploadDir, name));
        for (const filePath of files) {
            if (fs.statSync(filePath).isFile()) {
                await uploadIfExists(filePath, 'releases/arch/x86_64');
            }
        }
    }

    console.log('[release] listo');
}

main().catch((error) => {
    console.error('[release] error:', error.message);
    process.exit(1);
});
