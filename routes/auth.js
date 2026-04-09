const express = require('express');
const router = express.Router();
const { register, login, getUser } = require('../controller/authController');
const auth = require('../middleware/auth');
const User=require('../models/user')

router.post('/register', register);
router.post('/login', login);
router.patch('/accept-terms', auth, async (req, res) => {
    const { terms_accept, signature_name, accepted_at } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { terms_accept, signature_name, accepted_at },
      { new: true }
    );
    res.json({ success: true, user });
  });

  router.get('/me', auth, async (req, res) => {
    const user = await User.findById(req.user.id).select('-password_hash');
    res.json({ user });
  });

  router.get('/getUser',auth,getUser)
module.exports = router;