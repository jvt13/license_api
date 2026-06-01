const bcrypt = require('bcrypt')
const db = require('../database')

const ADMIN_ID = 1
const ADMIN_USERNAME = 'admin'
const BCRYPT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

function ensureAdminAccount() {
  const row = db.prepare('SELECT id FROM admin_account WHERE id = ?').get(ADMIN_ID)
  if (!row) {
    db.prepare(`
      INSERT INTO admin_account (id, username, password_hash, password_initialized)
      VALUES (?, ?, NULL, 0)
    `).run(ADMIN_ID, ADMIN_USERNAME)
  }
}

function isPasswordInitialized() {
  ensureAdminAccount()
  const row = db.prepare(`
    SELECT password_initialized FROM admin_account WHERE id = ?
  `).get(ADMIN_ID)
  return !!(row && row.password_initialized === 1)
}

function setInitialPassword(password) {
  if (isPasswordInitialized()) {
    throw new Error('Senha já configurada.')
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS)
  db.prepare(`
    UPDATE admin_account
    SET password_hash = ?,
        password_initialized = 1,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(hash, ADMIN_ID)
}

function verifyCredentials(username, password) {
  ensureAdminAccount()
  if (!isPasswordInitialized()) {
    return false
  }

  const row = db.prepare(`
    SELECT username, password_hash FROM admin_account WHERE id = ?
  `).get(ADMIN_ID)

  if (!row || !row.password_hash) {
    return false
  }

  if (String(username).trim() !== row.username) {
    return false
  }

  return bcrypt.compareSync(password, row.password_hash)
}

function getMinPasswordLength() {
  return MIN_PASSWORD_LENGTH
}

ensureAdminAccount()

module.exports = {
  ADMIN_USERNAME,
  ensureAdminAccount,
  isPasswordInitialized,
  setInitialPassword,
  verifyCredentials,
  getMinPasswordLength
}
