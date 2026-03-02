const jwt = require('jsonwebtoken')

function authAdmin(req, res, next) {
  let token = null

  // 1️⃣ Primeiro tenta Authorization header
  const authHeader = req.headers.authorization
  if (authHeader) {
    token = authHeader.split(' ')[1]
  }

  // 2️⃣ Se não tiver header, tenta cookie
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => c.trim().split('='))
    )
    token = cookies.admin_token
  }

  if (!token) {
    return res.status(401).json({ error: 'Token ausente' })
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET)

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    next()
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado' })
  }
}

module.exports = authAdmin