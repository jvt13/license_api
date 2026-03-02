const express = require('express')
const router = express.Router()
const controller = require('../controllers/license.controller')
const authAdmin = require('../middlewares/authAdmin')

router.post('/validate', controller.validate)
router.get('/pending', authAdmin, controller.listPending)
router.post('/approve', authAdmin, controller.approve)

router.get('/public-key', controller.getPublicKey)

module.exports = router