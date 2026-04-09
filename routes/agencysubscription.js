const express = require('express')
const router = express.Router()
const { createSubscription } = require('../controller/agencySubscription')
const auth = require('../middleware/auth');
const agencyAuth=require('../middleware/agencyauth')
router.post('/create', agencyAuth, createSubscription)

module.exports = router