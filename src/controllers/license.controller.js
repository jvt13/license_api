const fs = require('fs')
const path = require('path')

const service = require('../services/license.service')
const model = require('../models/license.model')

exports.validate = (req, res) => {
  const { machine_id, machine_name, machine_ip } = req.body

  if (!machine_id) {
    return res.status(400).json({ error: 'machine_id obrigatório' })
  }

  const result = service.handleValidationRequest(machine_id, machine_name, machine_ip)

  return res.json(result)
}

exports.listPending = (req, res) => {
  const pending = model.getPendingMachines()
  return res.json(pending)
}

exports.approve = (req, res) => {
  try {
    const { machine_id, days } = req.body

    if (!machine_id || !days) {
      return res.status(400).json({ error: 'machine_id e days são obrigatórios' })
    }

    const token = service.approveMachine(machine_id, days)

    return res.json({
      status: 'approved',
      token
    })
  } catch (err) {
    console.error("Erro ao aprovar:", err.message)
    return res.status(500).json({ error: err.message })
  }
}

exports.getPublicKey = (req, res) => {
  try {
    const publicKeyPath = path.join(__dirname, '../../public.key')
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8')

    return res.json({ publicKey })
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar chave pública' })
  }
}