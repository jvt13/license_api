const express = require('express')
const jwt = require('jsonwebtoken')

const router = express.Router()

/*router.post('/login', (req, res) => {
   const { user, pass } = req.body

   if (
      user === process.env.ADMIN_USER &&
      pass === process.env.ADMIN_PASS
   ) {
      const token = jwt.sign(
         { role: 'admin' },
         process.env.ADMIN_SECRET,
         { expiresIn: '1h' }
      )

      return res.json({ token })
   }

   return res.status(401).json({ error: 'Credenciais inválidas' })
})*/

module.exports = router