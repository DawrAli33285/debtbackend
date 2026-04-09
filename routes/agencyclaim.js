const express = require('express');
const router = express.Router();
const { acceptClaim, denyClaim } = require('../controller/agencyClaimController');
const agencyAuth = require('../middleware/agencyauth'); 

router.patch('/:id/accept', agencyAuth, acceptClaim);
router.patch('/:id/deny',   agencyAuth, denyClaim);

module.exports = router;