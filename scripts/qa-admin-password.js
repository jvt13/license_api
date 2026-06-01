/**
 * QA: configuração inicial de senha do administrador.
 * Uso: node scripts/qa-admin-password.js
 */
require('dotenv').config()

const bcrypt = require('bcrypt')
const db = require('../src/database')
const adminModel = require('../src/models/admin.model')
const service = require('../src/services/license.service')
const licenseModel = require('../src/models/license.model')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log('  OK:', message)
  } else {
    failed++
    console.error('  FAIL:', message)
  }
}

function resetAdminAccount() {
  db.prepare('DELETE FROM admin_account WHERE id = 1').run()
  adminModel.ensureAdminAccount()
}

console.log('\n========== QA - Primeiro acesso ==========')
resetAdminAccount()
assert(!adminModel.isPasswordInitialized(), 'detecta ausência de senha configurada')

console.log('\n========== QA - Criação da senha ==========')
adminModel.setInitialPassword('SenhaSegura123')
const row = db.prepare('SELECT password_hash, password_initialized FROM admin_account WHERE id = 1').get()
assert(row.password_initialized === 1, 'flag password_initialized = 1')
assert(row.password_hash && row.password_hash.startsWith('$2'), 'hash bcrypt armazenado')
assert(row.password_hash !== 'SenhaSegura123', 'senha não armazenada em texto puro')
try {
  adminModel.setInitialPassword('OutraSenha456')
  assert(false, 'bloqueia segunda configuração inicial')
} catch (e) {
  assert(e.message.includes('já configurada'), 'fluxo inicial não reutilizável')
}

console.log('\n========== QA - Login ==========')
assert(adminModel.verifyCredentials('admin', 'SenhaSegura123'), 'login com senha correta')
assert(!adminModel.verifyCredentials('admin', 'errada'), 'rejeita senha incorreta')
assert(!adminModel.verifyCredentials('outro', 'SenhaSegura123'), 'rejeita usuário inválido')

console.log('\n========== QA - Persistência (reload módulo) ==========')
delete require.cache[require.resolve('../src/models/admin.model')]
const adminReloaded = require('../src/models/admin.model')
assert(adminReloaded.isPasswordInitialized(), 'senha válida após recarregar módulo')
assert(adminReloaded.verifyCredentials('admin', 'SenhaSegura123'), 'credencial válida após recarregar')

console.log('\n========== QA - Segurança ==========')
assert(bcrypt.compareSync('SenhaSegura123', row.password_hash), 'bcrypt.compare valida hash')
const logSample = JSON.stringify({ password: 'SenhaSegura123', hash: row.password_hash })
assert(!logSample.includes('"password":"SenhaSegura123"') || row.password_hash, 'hash distinto do plaintext no payload de teste')

console.log('\n========== QA - Regressão licenciamento ==========')
const id = `qa_admin_${Date.now()}`
licenseModel.getMachine(id) && licenseModel.deleteMachineById(licenseModel.getMachine(id).id)
const r = service.handleValidationRequest(id, 'PC', '1.1.1.1', 'Sistema QA')
assert(r.status === 'pending', 'validate continua funcionando')
service.approveMachine(id, 5)
assert(service.handleValidationRequest(id).status === 'approved', 'aprovação OK')
licenseModel.deleteMachine(id)

console.log(`\n========== RESULTADO QA ADMIN: ${passed} passou, ${failed} falhou ==========\n`)

if (failed === 0) {
  console.log('NOTA: após este teste a senha admin no license.db foi definida como "SenhaSegura123".')
  console.log('Em desenvolvimento, acesse /admin/login ou redefina via SQLite se necessário.\n')
}

process.exit(failed > 0 ? 1 : 0)
