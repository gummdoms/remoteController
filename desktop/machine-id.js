const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const MACHINE_ID_FILE = 'machine-id.txt';

function getMachineIdPath() {
    const userData = app?.getPath?.('userData') || path.join(os.homedir(), '.remotecontrollers');
    return path.join(userData, MACHINE_ID_FILE);
}

function getMachineId() {
    const idPath = getMachineIdPath();

    try {
        if (fs.existsSync(idPath)) {
            const existing = fs.readFileSync(idPath, 'utf8').trim();
            if (existing) {
                return existing;
            }
        }
    } catch (error) {
        // Continuar y regenerar.
    }

    const generated = crypto.randomUUID();
    const dir = path.dirname(idPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(idPath, generated, 'utf8');
    return generated;
}

module.exports = {
    getMachineId
};
