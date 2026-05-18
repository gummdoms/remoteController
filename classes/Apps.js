const sqlite3 = require('sqlite3').verbose();
class Apps {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Connected to the SQLite database.');
            }
        });
        this.createTables();
    }
    createTables() {
        this.db.run('CREATE TABLE IF NOT EXISTS apps (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, icon TEXT, type TEXT, UNIQUE(name, path))', (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Created apps table.');
            }
        });
    }
    insertApp(name, path, icon, type) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO apps (name, path, icon, type) VALUES (?, ?, ?, ?)', [name, path, icon, type], function (err) {
                if (err) {
                    reject(err.message);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }
    updateApp(id, name, path, icon, type) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE apps SET name = ?, path = ?, icon = ?, type = ? WHERE id = ?', [name, path, icon, type, id], function (err) {
                if (err) {
                    reject(err.message);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
    deleteApp(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM apps WHERE id = ?', [id], function (err) {
                if (err) {
                    reject(err.message);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
    getApps() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM apps', [], (err, rows) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(rows);
                }
            });
        });
    }
    getAppById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM apps WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(row);
                }
            });
        });
    }
    getAppByName(name) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM apps WHERE name = ?', [name], (err, row) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(row);
                }
            });
        });
    }
    close() {
        this.db.close((err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Closed the database connection.');
            }
        });
    }
}
module.exports = Apps;