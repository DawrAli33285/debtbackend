const express = require('express');
const router = express.Router();
const { acceptClaim, denyClaim, getClaimsDeniedByAdmin,updateClaimPopup,reopenClaim, closeClaim} = require('../controller/agencyClaimController');
const agencyAuth = require('../middleware/agencyauth'); 

router.patch('/:id/accept', agencyAuth, acceptClaim);
router.patch('/:id/deny',   agencyAuth, denyClaim);
router.put('/:id/updateClaimPopup',agencyAuth,updateClaimPopup)
router.patch('/:id/reopen', agencyAuth, reopenClaim);
router.patch('/:id/close',  agencyAuth, closeClaim);
router.get('/getClaimsDeniedByAdmin',agencyAuth,getClaimsDeniedByAdmin)
module.exports = router;