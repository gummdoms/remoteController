const sqlite3 = require('sqlite3').verbose();

class Conn {
    constructor() {
        this.db = new sqlite3.Database('./db.sqlite3', (err) => {
            if (err) {
                console.error(err.message);
            }
            //console.log('Connected to the database.');
        });
    }

    createTables() {
        this.db.run('CREATE TABLE IF NOT EXISTS indicators (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value TEXT)');
        this.db.run('CREATE TABLE IF NOT EXISTS path_folder (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT)');
    }
    insertPathDefault() {
        this.db.run('INSERT INTO path_folder (path) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM path_folder WHERE id = 1)', ['']);
    }
    updatePathFolder(path) {
        this.db.run('UPDATE path_folder SET path = ? WHERE id = 1', [path]);
    }
    getPathFolder() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM path_folder', (err, row) => {
                if (err) {
                    reject(err.message);
                }
                resolve(row);
            });
        });
    }
    insertIndicator(name, value) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT id FROM indicators WHERE name = ? OR value = ?', [name, value], (err, row) => {
                if (err) {
                    reject(err.message); // Rechazar la promesa en caso de error
                }
                if (row) {
                    reject({ error: 'El nombre o valor ya existe' }); // Rechazar la promesa si ya existe un registro con el mismo nombre o valor
                } else {
                    this.db.run('INSERT INTO indicators (name, value) VALUES (?, ?)', [name, value], (err) => {
                        if (err) {
                            reject(err.message); // Rechazar la promesa en caso de error al insertar
                        }
                        resolve({ success: 'Indicador agregado' }); // Resolver la promesa si la inserción fue exitosa
                    });
                }
            });
        });
    }

    updateIndicator(name, value, id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT id FROM indicators WHERE name = ? OR value = ?', [name, value], (err, row) => {
                if (err) {
                    reject(err.message);
                }
                if (row) {
                    reject({ error: 'El nombre o valor ya existe' });
                } else {
                    this.db.run('UPDATE indicators SET name = ?, value = ? WHERE id = ?', [name, value, id]);
                    resolve({ success: 'Indicador actualizado' });
                }
            });
        });
    }
    getIndicator(name) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM indicators WHERE name = ?', [name], (err, row) => {
                if (err) {
                    reject(err.message);
                }
                resolve(row);
            });
        });
    }
    deleteIndicator(id) {
        this.db.run('DELETE FROM indicators WHERE id = ?', [id]);
    }
    getAllIndicators() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM indicators', (err, rows) => {
                if (err) {
                    reject(err.message);
                }
                resolve(rows);
            });
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Close the database connection.');
        });
    }
}

module.exports = Conn;