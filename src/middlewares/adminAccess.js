const adminModel = require('../models/admin.model')

function isAdminPath(req) {
  return req.path.startsWith('/admin')
}

function isSetupRoute(req) {
  return req.path === '/admin/setup'
}

function isLoginRoute(req) {
  return req.path === '/admin/login'
}

function wantsHtml(req) {
  const accept = req.headers.accept || ''
  return req.method === 'GET' && accept.includes('text/html')
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
}

/**
 * Controla setup inicial vs login vs painel.
 * Deve ser registrado antes das rotas /admin.
 */
function adminAccessGate(req, res, next) {
  if (!isAdminPath(req)) {
    return next()
  }

  const initialized = adminModel.isPasswordInitialized()

  if (!initialized) {
    if (isSetupRoute(req)) {
      return next()
    }
    return res.redirect('/admin/setup')
  }

  if (isSetupRoute(req)) {
    return res.redirect('/admin/login')
  }

  if (isLoginRoute(req)) {
    return next()
  }

  return next()
}

module.exports = {
  adminAccessGate,
  wantsHtml,
  clearAdminCookie
}
