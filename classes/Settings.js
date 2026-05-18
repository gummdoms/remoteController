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
}

module.exports = SettingsStore;
