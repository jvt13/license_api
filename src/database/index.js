const Database = require('better-sqlite3')
const db = new Database('license.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT UNIQUE,
    machine_name TEXT,
    machine_ip TEXT,
    status TEXT DEFAULT 'pending',
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

// attempt to add columns if they don't exist (silent failure if already present)
try {
  db.exec(`ALTER TABLE machines ADD COLUMN machine_name TEXT`)
} catch (e) {
  // ignore, column may already exist
}
try {
  db.exec(`ALTER TABLE machines ADD COLUMN machine_ip TEXT`)
} catch (e) {
  // ignore, column may already exist
}
try {
  db.exec(`ALTER TABLE machines ADD COLUMN system_name TEXT`)
} catch (e) {
  // ignore, column may already exist
}
try {
  db.exec(`ALTER TABLE machines ADD COLUMN request_date TEXT`)
} catch (e) {
  // ignore, column may already exist
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE DEFAULT 'admin',
    password_hash TEXT,
    password_initialized INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  )
`)

module.exports = db