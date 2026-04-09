const express = require('express')
const router = express.Router()
const { createSubscription } = require('../controller/businesssubscription')
const auth = require('../middleware/auth');

router.post('/create', auth, createSubscription)

module.exports = router