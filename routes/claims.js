const express = require('express');
const router = express.Router();
const { createClaim, getClaims, getClaimById } = require('../controller/claimController');
const auth = require('../middleware/auth');

router.post('/create', auth, createClaim);
router.get('/', auth, getClaims);
router.get('/:id', auth, getClaimById);

module.exports = router;