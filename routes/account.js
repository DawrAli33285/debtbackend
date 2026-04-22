const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    getAccountOverview,
    updateProfile,
    updatePassword,
} = require('../controller/account');

router.get('/overview', auth, getAccountOverview);
router.patch('/profile', auth, updateProfile);
router.patch('/password', auth, updatePassword);

module.exports = router;