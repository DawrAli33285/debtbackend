const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Agency = require('../models/agency');


exports.register = async (req, res) => {
  try {
    const { role } = req.body;

    if (role === 'agency') {
      const { name, states_covered, specialties, fee_percentage } = req.body;

      const existing = await Agency.findOne({ name });
      if (existing) return res.status(400).json({ message: 'Agency already exists' });

      const agency = await Agency.create({
        name,
        states_covered,
        specialties,
        fee_percentage,
      });

      return res.status(201).json({ message: 'Agency registered', agency });
    }

  
    const { business_name, contact_name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      business_name,
      contact_name,
      email,
      password_hash,
    });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ message: 'User registered', token, user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (role === 'agency') {
    
      return res.status(400).json({ message: 'Agency login not implemented' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({ message: 'Login successful', token, user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
 
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }
 
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
 
    const user = await User.findOne({ email });
    if (!user) {
      // Generic message — don't reveal whether email exists
      return res.status(404).json({ message: 'No account found with that email address.' });
    }
 
    const password_hash = await bcrypt.hash(newPassword, 12);
    user.password_hash  = password_hash;
    await user.save();
 
    return res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};




exports.getUser = async (req, res) => {
  try {
  
    let user=await User.findById(req.user.id)


    res.status(200).json({user});

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

