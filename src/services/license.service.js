const jwt = require('jsonwebtoken')
const { PRIVATE_KEY } = require('../config/keys')
const model = require('../models/license.model')

function generateToken(machine) {
  const expiresDate = new Date(machine.expires_at)

  const payload = {
    machine_id: machine.machine_id,
    machine_name: machine.machine_name || undefined,
    machine_ip: machine.machine_ip || undefined,
    company: "Empresa Interna",
    plan: "internal",
    exp: Math.floor(expiresDate.getTime() / 1000)
  }

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256'
  })
}

function handleValidationRequest(machine_id, machine_name=null, machine_ip=null) {
  let machine = model.getMachine(machine_id)

  if (!machine) {
    model.createRequest(machine_id, machine_name, machine_ip)
    return { status: 'pending' }
  }
  // if name provided and differs, update record
  if (machine_name && machine.machine_name !== machine_name) {
    model.updateMachineById(machine.id, 'machine_name', machine_name)
    machine.machine_name = machine_name
  }
  // if IP provided and differs, update record
  if (machine_ip && machine.machine_ip !== machine_ip) {
    model.updateMachineById(machine.id, 'machine_ip', machine_ip)
    machine.machine_ip = machine_ip
  }

  if (machine.status !== 'approved') {
    return { status: 'pending' }
  }

  const now = new Date()
  const expiresDate = new Date(machine.expires_at)

  if (expiresDate < now) {
    return { status: 'expired' }
  }

  const token = generateToken(machine)

  return {
    status: 'approved',
    token,
    expires_at: machine.expires_at
  }
}

function approveMachine(machine_id, days) {
  const machine = model.getMachine(machine_id)

  if (!machine) {
    throw new Error("Machine não encontrada no banco.")
  }

  const expiresDate = new Date()
  expiresDate.setDate(expiresDate.getDate() + Number(days))

  model.approveMachine(machine_id, expiresDate.toISOString())

  const updatedMachine = model.getMachine(machine_id)

  if (!updatedMachine.expires_at) {
    throw new Error("Falha ao atualizar expiração.")
  }

  return generateToken(updatedMachine)
}

module.exports = {
  handleValidationRequest,
  approveMachine
}