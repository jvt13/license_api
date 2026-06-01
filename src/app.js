require('dotenv').config()

const express = require('express')
const path = require('path')
const routes = require('./routes/license.routes')
const adminRoutes = require("./routes/admin.routes")
const model = require('./models/license.model')
const adminModel = require('./models/admin.model')
const authAdmin = require('./middlewares/authAdmin')
const { adminAccessGate, clearAdminCookie } = require('./middlewares/adminAccess')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(adminAccessGate)

app.use('/admin', adminRoutes)
app.use('/api/license', routes)

app.get('/admin/setup', (req, res) => {
  res.render('admin/setup', {
    error: null,
    minLength: adminModel.getMinPasswordLength()
  })
})

app.post('/admin/setup', express.urlencoded({ extended: true }), (req, res) => {
  const { password, confirm_password } = req.body

  if (!password || !confirm_password) {
    return res.render('admin/setup', {
      error: 'Preencha todos os campos.',
      minLength: adminModel.getMinPasswordLength()
    })
  }

  if (password !== confirm_password) {
    return res.render('admin/setup', {
      error: 'As senhas não coincidem.',
      minLength: adminModel.getMinPasswordLength()
    })
  }

  try {
    adminModel.setInitialPassword(password)
    clearAdminCookie(res)
    return res.redirect('/admin/login?configured=1')
  } catch (err) {
    return res.render('admin/setup', {
      error: err.message,
      minLength: adminModel.getMinPasswordLength()
    })
  }
})

app.get('/admin/login', (req, res) => {
  res.render('admin/login', {
    error: null,
    success: req.query.configured === '1'
      ? 'Senha configurada com sucesso. Faça login com a nova senha.'
      : null
  })
})

app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
  const { user, pass } = req.body

  if (!adminModel.isPasswordInitialized()) {
    return res.redirect('/admin/setup')
  }

  if (adminModel.verifyCredentials(user, pass)) {
    const jwt = require('jsonwebtoken')
    const token = jwt.sign(
      { role: 'admin' },
      process.env.ADMIN_SECRET,
      { expiresIn: '1h' }
    )

    res.setHeader('Set-Cookie', `admin_token=${token}; HttpOnly; Path=/; SameSite=Lax`)
    return res.redirect('/admin/licenses')
  }

  res.render('admin/login', {
    error: 'Credenciais inválidas',
    success: null
  })
})

app.get('/admin/licenses', authAdmin, async (req, res) => {
    const machines = model.getAllMachines()

    const now = new Date()

    const stats = {
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

    res.render('admin/licenses', { machines, stats })
})

app.post('/admin/licenses/approve',authAdmin, express.urlencoded({ extended: true }), (req, res) => {
  const { machine_id, days } = req.body

  try {
    const service = require('./services/license.service')
    service.approveMachine(machine_id, days)
  } catch (err) {
    console.error(err.message)
  }

  res.redirect('/admin/licenses')
})

app.post('/admin/licenses/revoke',
  authAdmin,
  express.urlencoded({ extended: true }),
  (req, res) => {

    const { machine_id } = req.body
    const model = require('./models/license.model')

    model.revokeMachine(machine_id)

    res.redirect('/admin/licenses')
})

app.post('/admin/licenses/delete',
  authAdmin,
  express.urlencoded({ extended: true }),
  (req, res) => {
    const { machine_id } = req.body

    try {
      if (!machine_id) {
        return res.redirect('/admin/licenses')
      }
      model.deleteMachine(machine_id)
    } catch (err) {
      console.error('Erro ao excluir solicitação:', err.message)
    }

    res.redirect('/admin/licenses')
  })

// ===== PAINEL SQL =====

app.get('/admin/sql-panel', authAdmin, (req, res) => {
  try {
    const machines = model.getAllMachines()
    const message = req.query.message ? {
      type: req.query.type || 'info',
      text: req.query.message
    } : null
    
    res.render('admin/sql-panel', { machines, message })
  } catch (err) {
    console.error('Erro ao carregar painel SQL:', err.message)
    res.redirect('/admin/sql-panel?message=Erro ao carregar dados&type=danger')
  }
})

app.post('/admin/sql-panel/create', authAdmin, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { machine_id, status, expires_at, machine_name, machine_ip, system_name } = req.body

    model.createMachine(
      machine_id,
      status || 'pending',
      expires_at || null,
      machine_name || null,
      machine_ip || null,
      system_name || null
    )

    res.redirect('/admin/sql-panel?message=Licença criada com sucesso!&type=success')
  } catch (err) {
    console.error('Erro ao criar licença:', err.message)
    const errorMsg = encodeURIComponent(err.message || 'Erro ao criar licença')
    res.redirect(`/admin/sql-panel?message=${errorMsg}&type=danger`)
  }
})

app.post('/admin/sql-panel/update/:id', authAdmin, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { id } = req.params
    const { field, value, old_value } = req.body

    // Se o valor não mudou, apenas redireciona
    if (value === old_value) {
      return res.redirect('/admin/sql-panel')
    }

    model.updateMachineById(id, field, value)

    res.redirect('/admin/sql-panel?message=Registro atualizado com sucesso!&type=success')
  } catch (err) {
    console.error('Erro ao atualizar registro:', err.message)
    const errorMsg = encodeURIComponent(err.message || 'Erro ao atualizar')
    res.redirect(`/admin/sql-panel?message=${errorMsg}&type=danger`)
  }
})

app.post('/admin/sql-panel/delete/:id', authAdmin, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { id } = req.params

    model.deleteMachineById(id)

    res.redirect('/admin/sql-panel?message=Registro deletado com sucesso!&type=success')
  } catch (err) {
    console.error('Erro ao deletar registro:', err.message)
    const errorMsg = encodeURIComponent(err.message || 'Erro ao deletar')
    res.redirect(`/admin/sql-panel?message=${errorMsg}&type=danger`)
  }
})

// ===== FIM PAINEL SQL =====

const PORT = process.env.PORT || 3001
app.listen(PORT, () =>
  console.log(`License API rodando na porta ${PORT}`)
)