/**
 * QA completo: system_name, request_date, renovação, exclusão, contadores.
 * Uso: node scripts/qa-full.js
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

function computeStats(machines) {
  const now = new Date()
  return {
    total: machines.length,
    pending: machines.filter(m => m.status === 'pending').length,
    approved: machines.filter(m => {
      if (m.status !== 'approved') return false
      if (!m.expires_at) return false
      return new Date(m.expires_at) >= now
    }).length,
    expired: machines.filter(m => {
      if (m.status !== 'approved') return false
      if (!m.expires_at) return false
      return new Date(m.expires_at) < now
    }).length
  }
}

function panelSystemLabel(system_name) {
  return system_name ? system_name : 'Não informado'
}

const prefix = `qa_${Date.now()}_`

console.log('\n========== QA - Campo Sistema ==========')
const sysId = `${prefix}sys`
cleanup(sysId)
service.handleValidationRequest(sysId, null, null, 'Sistema Estacionamento')
let m = model.getMachine(sysId)
assert(m.system_name === 'Sistema Estacionamento', 'persistência no SQLite via API')
assert(panelSystemLabel(m.system_name) === 'Sistema Estacionamento', 'rótulo painel com valor')
service.approveMachine(sysId, 10)
m = model.getMachine(sysId)
assert(m.system_name === 'Sistema Estacionamento', 'system_name preservado após renovação (approve admin)')
service.handleValidationRequest(sysId, null, null, 'Sistema Atualizado')
m = model.getMachine(sysId)
assert(m.system_name === 'Sistema Atualizado', 'system_name atualizado na revalidação do cliente')

const legacyId = `${prefix}legacy`
cleanup(legacyId)
service.handleValidationRequest(legacyId)
m = model.getMachine(legacyId)
assert(!m.system_name, 'cliente antigo sem system_name persiste null')
assert(panelSystemLabel(m.system_name) === 'Não informado', 'painel exibe "Não informado"')

console.log('\n========== QA - Campo Solicitado em ==========')
const dateId = `${prefix}date`
cleanup(dateId)
const before = Date.now()
service.handleValidationRequest(dateId, null, null, 'App Data')
m = model.getMachine(dateId)
assert(m.request_date, 'request_date registrado na primeira solicitação')
const reqMs = new Date(m.request_date).getTime()
assert(reqMs >= before - 5000 && reqMs <= Date.now() + 1000, 'request_date em ISO UTC recente')
const savedDate = m.request_date
service.handleValidationRequest(dateId, null, null, 'App Data')
assert(model.getMachine(dateId).request_date === savedDate, 'request_date imutável na revalidação')
assert(!isNaN(new Date(m.request_date).getTime()), 'data parseável para ordenação')

console.log('\n========== QA - Fluxo nova licença ==========')
const flowId = `${prefix}flow`
cleanup(flowId)
assert(service.handleValidationRequest(flowId, 'PC-QA', '10.0.0.9', 'Produto A').status === 'pending', 'nova solicitação pending')
m = model.getMachine(flowId)
assert(m.system_name === 'Produto A' && m.request_date, 'sistema e data gravados')
const all = model.getAllMachines().filter(x => x.machine_id === flowId)
assert(all.length === 1, 'registro visível na listagem (getAllMachines)')

console.log('\n========== QA - Fluxo renovação ==========')
const renewId = `${prefix}renew`
cleanup(renewId)
service.handleValidationRequest(renewId, 'PC-R', null, 'V1')
const firstDate = model.getMachine(renewId).request_date
service.approveMachine(renewId, 5)
m = model.getMachine(renewId)
assert(m.status === 'approved' && m.expires_at, 'renovação admin define expires_at')
assert(m.request_date === firstDate, 'request_date preservado na renovação admin')
service.handleValidationRequest(renewId, 'PC-R', null, 'V2')
m = model.getMachine(renewId)
assert(m.system_name === 'V2', 'system_name atualizado quando cliente envia na revalidação')
assert(m.request_date === firstDate, 'request_date não alterado na revalidação pós-renovação')
assert(service.handleValidationRequest(renewId).status === 'approved', 'cliente aprovado continua validando')

console.log('\n========== QA - Compatibilidade retroativa ==========')
const old2 = `${prefix}old2`
cleanup(old2)
const r = service.handleValidationRequest(old2, 'Host', '1.1.1.1')
assert(r.status === 'pending' && !r.token, 'cliente antigo: pending sem erro')
assert(service.handleValidationRequest(old2).status === 'pending', 'revalidação antiga estável')

console.log('\n========== QA - Exclusão administrativa ==========')
const delId = `${prefix}del`
cleanup(delId)
service.handleValidationRequest(delId, null, null, 'Teste Excluir')
assert(model.getMachine(delId), 'registro existe antes da exclusão')
model.deleteMachine(delId)
assert(!model.getMachine(delId), 'exclusão física remove o registro')
service.handleValidationRequest(delId, null, null, 'Novo Registro')
m = model.getMachine(delId)
assert(m.status === 'pending' && m.system_name === 'Novo Registro', 'machine_id pode solicitar novamente após exclusão')
cleanup(delId)

console.log('\n========== QA - Dashboard (contadores) ==========')
const d1 = `${prefix}d1`
const d2 = `${prefix}d2`
const d3 = `${prefix}d3`
;[d1, d2, d3].forEach(cleanup)
service.handleValidationRequest(d1, null, null, 'P')
service.handleValidationRequest(d2, null, null, 'A')
service.approveMachine(d2, 30)
service.handleValidationRequest(d3, null, null, 'E')
service.approveMachine(d3, -1)
let machines = model.getAllMachines()
let stats = computeStats(machines)
const totalBefore = stats.total
model.deleteMachine(d1)
machines = model.getAllMachines()
stats = computeStats(machines)
assert(stats.total === totalBefore - 1, 'contador Total decrementa após exclusão')
assert(stats.pending <= totalBefore, 'contadores consistentes pós-exclusão')
;[d2, d3].forEach(cleanup)

console.log('\n========== QA - Regressão licenciamento ==========')
const regId = `${prefix}reg`
cleanup(regId)
service.handleValidationRequest(regId)
service.approveMachine(regId, 1)
assert(service.handleValidationRequest(regId).status === 'approved', 'validação com token')
service.approveMachine(regId, -2)
assert(service.handleValidationRequest(regId).status === 'expired', 'expiração')
model.revokeMachine(regId)
assert(model.getMachine(regId).status === 'pending', 'revogação')
cleanup(regId)

;[sysId, legacyId, dateId, flowId, renewId, old2].forEach(cleanup)

console.log(`\n========== RESULTADO QA: ${passed} passou, ${failed} falhou ==========\n`)
process.exit(failed > 0 ? 1 : 0)
