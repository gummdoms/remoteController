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

function parseArgs(argv) {
    const options = {
        relativePath: '',
        files: []
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--path' && argv[i + 1]) {
            options.relativePath = argv[i + 1];
            i += 1;
            continue;
        }
        if (arg === '--dir' && argv[i + 1]) {
            const dir = argv[i + 1];
            const names = fs.readdirSync(dir).map((name) => path.join(dir, name));
            options.files.push(...names.filter((file) => fs.statSync(file).isFile()));
            i += 1;
            continue;
        }
        options.files.push(arg);
    }

    return options;
}

async function main() {
    const envFile = loadEnvFile();
    const { relativePath, files } = parseArgs(process.argv.slice(2));

    if (!files.length) {
        console.error('Uso: node scripts/upload-to-datalake.js --path releases/arch/x86_64 [--dir dist/datalake-upload] archivo1 ...');
        process.exit(1);
    }

    if (!dataLake.isConfigured()) {
        console.error('Configura DATA_LAKE_URL, DATA_LAKE_USER y DATA_LAKE_PASSWORD en .env');
        process.exit(1);
    }

    if (envFile) {
        console.log(`[datalake] credenciales desde ${envFile}`);
    }

    console.log(`[datalake] destino: ${dataLake.normalizeStoragePath(relativePath)}/`);

    for (const filePath of files) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`No existe el archivo: ${filePath}`);
        }

        const size = fs.statSync(filePath).size;
        const name = path.basename(filePath);
        console.log(`[datalake] subiendo ${name} (${size} bytes)...`);
        const result = await dataLake.uploadFileFromDisk(filePath, relativePath);
        console.log(`[datalake] OK ${result.filename}`);
        console.log(`         ${result.url}`);
    }

    console.log('[datalake] subida completada');
}

main().catch((error) => {
    console.error('[datalake] error:', error.message);
    process.exit(1);
});
