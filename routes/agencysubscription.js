const express = require('express')
const router = express.Router()
const { getPlanId, confirmSubscription, handlePayPalWebhook } = require('../controller/agencySubscription')
const auth = require('../middleware/auth');
const agencyAuth=require('../middleware/agencyauth')
router.post('/get-plan-id', agencyAuth, getPlanId);
router.post('/confirm',     agencyAuth, confirmSubscription);
router.post('/webhook',     handlePayPalWebhook);

module.exports = router