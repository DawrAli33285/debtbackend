const express = require('express')
const router = express.Router()
const {getPlanId,confirmSubscription} = require('../controller/businesssubscription')
const auth = require('../middleware/auth');


router.post('/get-plan-id',  getPlanId);
router.post('/confirm',     auth, confirmSubscription);

module.exports = router