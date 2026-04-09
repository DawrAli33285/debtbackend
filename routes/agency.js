const express = require('express');
const router  = express.Router();
const { getAgencies, getAgencyById, createAgency, getClaimById } = require('../controller/agencyController');

const { getAgencyAssignments, updateAssignmentStatus, register, login, getAgencyMe } = require('../controller/useragency');
const auth = require('../middleware/auth');
const agencyAuth = require('../middleware/agencyauth');

// ✅ Specific static routes FIRST
router.post('/register', register);
router.post('/login',    login);
router.post('/create',   auth, createAgency);

router.get('/me',                    agencyAuth, getAgencyMe);
router.get('/assignments',           agencyAuth, getAgencyAssignments);
router.patch('/assignments/status',  agencyAuth, updateAssignmentStatus);

// ✅ Dynamic /:id route LAST
router.get('/',     auth, getAgencies);
router.get('/:id',  auth, getAgencyById);



router.get('/claim/:id',  getClaimById);
module.exports = router;