const express = require('express');
const router = express.Router();
const { acceptClaim, denyClaim, reopenClaim, closeClaim} = require('../controller/agencyClaimController');
const agencyAuth = require('../middleware/agencyauth'); 

router.patch('/:id/accept', agencyAuth, acceptClaim);
router.patch('/:id/deny',   agencyAuth, denyClaim);
router.patch('/:id/reopen', agencyAuth, reopenClaim);
router.patch('/:id/close',  agencyAuth, closeClaim);
module.exports = router;