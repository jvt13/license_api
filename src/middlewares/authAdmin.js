const jwt = require('jsonwebtoken')
const adminModel = require('../models/admin.model')

function wantsHtml(req) {
  const accept = req.headers.accept || ''
  return req.method === 'GET' && accept.includes('text/html')
}

function authAdmin(req, res, next) {
  if (!adminModel.isPasswordInitialized()) {
    if (wantsHtml(req)) {
      return res.redirect('/admin/setup')
    }
    return res.status(403).json({ error: 'Senha administrativa não configurada' })
  }

  let token = null

  const authHeader = req.headers.authorization
  if (authHeader) {
    token = authHeader.split(' ')[1]
  }

  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => c.trim().split('='))
    )
    token = cookies.admin_token
  }

  if (!token) {
    if (wantsHtml(req)) {
      return res.redirect('/admin/login')
    }
    return res.status(401).json({ error: 'Token ausente' })
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET)

    if (decoded.role !== 'admin') {
      if (wantsHtml(req)) {
        return res.redirect('/admin/login')
      }
      return res.status(403).json({ error: 'Acesso negado' })
    }

    next()
  } catch (err) {
    if (wantsHtml(req)) {
      return res.redirect('/admin/login')
    }
    return res.status(403).json({ error: 'Token inválido ou expirado' })
  }
}

module.exports = authAdmin