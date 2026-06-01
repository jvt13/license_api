const db = require('../database')

function createRequest(machine_id, machine_name=null, machine_ip=null, system_name=null) {
  const request_date = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO machines (machine_id, machine_name, machine_ip, system_name, request_date, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `)
  stmt.run(machine_id, machine_name, machine_ip, system_name, request_date)

  if (machine_name || machine_ip || system_name) {
    const updates = []
    const values = []
    if (machine_name) {
      updates.push('machine_name = ?')
      values.push(machine_name)
    }
    if (machine_ip) {
      updates.push('machine_ip = ?')
      values.push(machine_ip)
    }
    if (system_name) {
      updates.push('system_name = ?')
      values.push(system_name)
    }
    values.push(machine_id)
    db.prepare(`UPDATE machines SET ${updates.join(', ')} WHERE machine_id = ?`).run(...values)
  }
}

function approveMachine(machine_id, expires_at) {
  const stmt = db.prepare(`
    UPDATE machines
    SET status = 'approved',
        expires_at = ?
    WHERE machine_id = ?
  `)
  stmt.run(expires_at, machine_id)
}

function getMachine(machine_id) {
  return db.prepare(`
    SELECT * FROM machines WHERE machine_id = ?
  `).get(machine_id)
}

function getPendingMachines() {
  return db.prepare(`
    SELECT * FROM machines WHERE status = 'pending'
  `).all()
}

function getAllMachines() {
  return db.prepare("SELECT * FROM machines ORDER BY created_at DESC").all()
}

function revokeMachine(machine_id) {
  const stmt = db.prepare(`
    UPDATE machines
    SET status = 'pending',
        expires_at = NULL
    WHERE machine_id = ?
  `)

  return stmt.run(machine_id)
}

function updateMachineById(id, field, value) {
  // Validação de campos permitidos
  const allowedFields = ['machine_id', 'machine_name', 'machine_ip', 'system_name', 'request_date', 'status', 'expires_at']
  if (!allowedFields.includes(field)) {
    throw new Error(`Campo inválido: ${field}`)
  }

  // Validação de formato para expires_at; aceitar espaços/T e quaisquer fusos
  if (field === 'expires_at' && value && value.trim() !== '') {
    const dateObj = new Date(value.replace(' ', 'T'))
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Data inválida: ${value}`)
    }
  }

  let valueToStore = value
  if (field === 'expires_at' && value && value.trim() !== '') {
    const dateObj = new Date(value)
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Data inválida: ${value}`)
    }
    valueToStore = dateObj.toISOString()
  }

  if (field === 'request_date' && value && value.trim() !== '') {
    const dateObj = new Date(value.replace(' ', 'T'))
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Data inválida: ${value}`)
    }
    valueToStore = dateObj.toISOString()
  }

  const query = `UPDATE machines SET ${field} = ? WHERE id = ?`
  const stmt = db.prepare(query)
  return stmt.run(valueToStore || null, id)
}

function deleteMachineById(id) {
  const stmt = db.prepare(`DELETE FROM machines WHERE id = ?`)
  return stmt.run(id)
}

function deleteMachine(machine_id) {
  const machine = getMachine(machine_id)
  if (!machine) {
    throw new Error('Machine não encontrada no banco.')
  }
  return deleteMachineById(machine.id)
}

function createMachine(machine_id, status = 'pending', expires_at = null, machine_name = null, machine_ip = null, system_name = null, request_date = null) {
  // Validação de machine_id
  if (!machine_id || machine_id.trim() === '') {
    throw new Error('Machine ID é obrigatório')
  }

  // Validação de status
  const validStatuses = ['pending', 'approved']
  if (status && !validStatuses.includes(status)) {
    throw new Error(`Status inválido. Use: ${validStatuses.join(', ')}`)
  }

  // Validação de machine_name (espaço mínimo)
  if (machine_name && machine_name.trim() === '') {
    machine_name = null
  }

  if (system_name && system_name.trim() === '') {
    system_name = null
  }

  let requestToStore = request_date
  if (request_date && request_date.trim() !== '') {
    const dateObj = new Date(request_date.replace(' ', 'T'))
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Data inválida: ${request_date}`)
    }
    requestToStore = dateObj.toISOString()
  } else if (!request_date) {
    requestToStore = new Date().toISOString()
  }

  // Validação de formato ISO 8601 para expires_at e normalização para UTC
  let expiresToStore = expires_at
  if (expires_at && expires_at.trim() !== '') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
    if (!dateRegex.test(expires_at)) {
      // ainda assim tentamos criar Date a partir da string
      const maybeDate = new Date(expires_at)
      if (isNaN(maybeDate.getTime())) {
        throw new Error(`Formato de data inválido. Use: YYYY-MM-DDTHH:MM:SS.SSSZ`)
      }
      expiresToStore = maybeDate.toISOString()
    } else {
      // já está em formato compatível; normalizar com Date para garantir Z
      const dateObj = new Date(expires_at)
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Data inválida: ${expires_at}`)
      }
      expiresToStore = dateObj.toISOString()
    }
  }

  const stmt = db.prepare(`
    INSERT INTO machines (machine_id, machine_name, machine_ip, system_name, request_date, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  return stmt.run(machine_id, machine_name, machine_ip, system_name, requestToStore, status, expiresToStore || null)
}

function getMachineById(id) {
  return db.prepare(`SELECT * FROM machines WHERE id = ?`).get(id)
}

module.exports = {
  createRequest,
  approveMachine,
  getMachine,
  getPendingMachines,
  getAllMachines,
  revokeMachine,
  updateMachineById,
  deleteMachineById,
  deleteMachine,
  createMachine,
  getMachineById
}