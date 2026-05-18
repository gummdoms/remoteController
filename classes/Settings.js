const sqlite3 = require('sqlite3').verbose();

class SettingsStore {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('No se pudo abrir la base de datos de configuración:', err.message);
            }
        });
        this.initialize();
    }

    initialize() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS mouse_config (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    pointer_speed REAL NOT NULL DEFAULT 2.5,
                    scroll_speed REAL NOT NULL DEFAULT 1.0,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.run(`
                CREATE TABLE IF NOT EXISTS app_preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
        });
    }

    getDefaultMouseConfig() {
        return {
            pointerSpeed: 2.5,
            scrollSpeed: 1.0
        };
    }

    getMouseConfig() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT pointer_speed, scroll_speed, updated_at FROM mouse_config WHERE id = 1', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    const defaults = this.getDefaultMouseConfig();
                    this.saveMouseConfig(defaults.pointerSpeed, defaults.scrollSpeed)
                        .then((created) => resolve(created))
                        .catch(reject);
                    return;
                }

                resolve(this.normalizeRow(row));
            });
        });
    }

    saveMouseConfig(pointerSpeed, scrollSpeed) {
        const safePointer = Number(pointerSpeed);
        const safeScroll = Number(scrollSpeed);
        const updatedAt = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO mouse_config (id, pointer_speed, scroll_speed, updated_at)
                 VALUES (1, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    pointer_speed = excluded.pointer_speed,
                    scroll_speed = excluded.scroll_speed,
                    updated_at = excluded.updated_at`,
                [safePointer, safeScroll, updatedAt],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.normalizeRow({
                        pointer_speed: safePointer,
                        scroll_speed: safeScroll,
                        updated_at: updatedAt
                    }));
                }
            );
        });
    }

    normalizeRow(row) {
        return {
            pointerSpeed: Number(row.pointer_speed),
            scrollSpeed: Number(row.scroll_speed),
            updatedAt: row.updated_at || null
        };
    }

    getPreference(key, fallbackValue = null) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM app_preferences WHERE key = ?', [key], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(fallbackValue);
                    return;
                }
                resolve(row.value);
            });
        });
    }

    setPreference(key, value) {
        const serializedValue = String(value);
        const updatedAt = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO app_preferences (key, value, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at`,
                [key, serializedValue, updatedAt],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ key, value: serializedValue, updatedAt });
                }
            );
        });
    }

    async getWaylandInputExperimental(defaultValue = true) {
        const raw = await this.getPreference('wayland_input_experimental', defaultValue ? '1' : '0');
        const value = String(raw ?? '').toLowerCase();
        return ['1', 'true', 'yes', 'on'].includes(value);
    }

    async setWaylandInputExperimental(enabled) {
        await this.setPreference('wayland_input_experimental', enabled ? '1' : '0');
        return { enabled: Boolean(enabled) };
    }
}

module.exports = SettingsStore;
