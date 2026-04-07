const express = require('express');
const router  = express.Router();
const { createAssignment, closeClaim } = require('../controller/assignmentController');
const auth = require('../middleware/auth');

router.post('/create', auth, createAssignment);
router.post('/close',  auth, closeClaim);

module.exports = router;