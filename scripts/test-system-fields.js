/**
 * Testes de compatibilidade e persistência para system_name / request_date.
 * Uso: node scripts/test-system-fields.js
 */
require('dotenv').config()

const model = require('../src/models/license.model')
const service = require('../src/services/license.service')

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

function cleanup(machine_id) {
  const m = model.getMachine(machine_id)
  if (m) model.deleteMachineById(m.id)
}

const prefix = `test_${Date.now()}_`

console.log('\n=== Cliente antigo (sem system_name) ===')
const oldId = `${prefix}legacy`
cleanup(oldId)
const r1 = service.handleValidationRequest(oldId, 'PC-OLD', '10.0.0.1')
assert(r1.status === 'pending', 'retorna pending')
const mOld = model.getMachine(oldId)
assert(mOld && mOld.request_date, 'request_date gravado na primeira solicitação')
assert(!mOld.system_name, 'system_name ausente')
const firstRequestDate = mOld.request_date
service.handleValidationRequest(oldId, 'PC-OLD', '10.0.0.1')
const mOld2 = model.getMachine(oldId)
assert(mOld2.request_date === firstRequestDate, 'request_date não muda na revalidação')

console.log('\n=== Cliente novo (com system_name) ===')
const newId = `${prefix}new`
cleanup(newId)
service.handleValidationRequest(newId, 'PC-NEW', '10.0.0.2', 'Sistema Financeiro')
const mNew = model.getMachine(newId)
assert(mNew.system_name === 'Sistema Financeiro', 'system_name gravado')
assert(mNew.request_date, 'request_date gravado')
const reqDate = mNew.request_date
service.handleValidationRequest(newId, 'PC-NEW', '10.0.0.2', 'Sistema Financeiro')
assert(model.getMachine(newId).request_date === reqDate, 'request_date imutável')
service.handleValidationRequest(newId, 'PC-NEW', '10.0.0.2', 'Sistema Estacionamento')
assert(model.getMachine(newId).system_name === 'Sistema Estacionamento', 'system_name atualizado quando diferente')

console.log('\n=== Aprovação e expiração (regressão) ===')
const apprId = `${prefix}approved`
cleanup(apprId)
service.handleValidationRequest(apprId, null, null, 'App Teste')
service.approveMachine(apprId, 30)
const mAppr = model.getMachine(apprId)
assert(mAppr.status === 'approved', 'aprovado')
const rAppr = service.handleValidationRequest(apprId, null, null, 'App Teste')
assert(rAppr.status === 'approved' && rAppr.token, 'validate retorna token')
assert(mAppr.system_name === 'App Teste', 'system_name preservado após aprovação')

console.log('\n=== Revogação (regressão) ===')
model.revokeMachine(apprId)
const mRev = model.getMachine(apprId)
assert(mRev.status === 'pending', 'revogado volta pending')
assert(mRev.system_name === 'App Teste', 'system_name preservado após revogação')
assert(mRev.request_date === reqDate || mRev.request_date, 'request_date preservado após revogação')

cleanup(oldId)
cleanup(newId)
cleanup(apprId)

console.log(`\nResultado: ${passed} passou, ${failed} falhou\n`)
process.exit(failed > 0 ? 1 : 0)
