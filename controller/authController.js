const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Agency = require('../models/agency');
const Mailgun = require("mailgun.js");
const FormData = require("form-data");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@collectionsconnector.com";
const DOMAIN = "collectionsconnector.com";



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

  
    const { business_name, contact_name, email, password, ein } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      business_name,
      contact_name,
      email,
      password_hash,
      ein
    });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });


    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
    });
    
    mg.messages.create(DOMAIN, {
      from: `noreply@${DOMAIN}`,
      to: [ADMIN_EMAIL],
      subject: '🆕 New Business Registered - Collections Connector',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #1669A9; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px;">New Business Registration</h1>
          </div>
          <div style="padding: 30px;">
            <p style="color: #2c3e50; font-size: 15px;">A new business has registered on Collections Connector.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Business Name</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${business_name || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Contact Name</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${contact_name || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Email</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">EIN</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${ein || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Registered On</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
            <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
          </div>
        </div>
      `,
    })
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

