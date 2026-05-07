const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const Agency     = require('../models/agency');
const AgencyUser = require('../models/agencyuser');
const Assignment=require('../models/assignment')
const AgencyAgreement = require('../models/agency_agreement_acceptance')
const Mailgun = require("mailgun.js");
const FormData = require("form-data");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@collectionsconnector.com";
const DOMAIN = "collectionsconnector.com";



const register = async (req, res) => {
  try {
    const {
      agency_name,
      states_covered,
      specialties,
      fee_percentage,
      name,
      email,
      password,
      ein,
      agreement_version,
      upfront_fee,
      upfront_fee_amount,
    } = req.body;


    if (!agency_name || !name || !email || !password) {
      return res.status(400).json({ message: 'agency_name, name, email and password are required' });
    }

    const existing = await AgencyUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const agency = await Agency.create({
      name:               agency_name,
      states_covered:     states_covered     || [],
      specialties:        specialties        || [],
      fee_percentage:     fee_percentage     || 0,
      upfront_fee:        upfront_fee        ?? false,
      upfront_fee_amount: upfront_fee_amount || 0,
    });

    // 2. Create the owner AgencyUser
    const password_hash = await bcrypt.hash(password, 12);
    const agencyUser = await AgencyUser.create({
      agency_id:     agency._id,
      name,
      email,
      password_hash,
      role: 'owner',
      ein,
    });

    // 3. Save agreement acceptance record
    const ip_address =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const user_agent = req.headers['user-agent'] || 'unknown';

    await AgencyAgreement.create({
      agency_id:         agency._id,
      agreement_version: agreement_version || 'v1.0',
      accepted_at:       new Date(),
      ip_address,
      user_agent,
    });

    const token = jwt.sign(
      { id: agencyUser._id, agency_id: agency._id, role: 'agency' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );


    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
    });
    
    mg.messages.create(DOMAIN, {
      from: `noreply@${DOMAIN}`,
      to: [ADMIN_EMAIL],
      subject: '🆕 New Agency Registered - Collections Connector',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #1669A9; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px;">New Agency Registration</h1>
          </div>
          <div style="padding: 30px;">
            <p style="color: #2c3e50; font-size: 15px;">A new agency has registered on Collections Connector.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Agency Name</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${agency_name || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Owner Name</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${name || '—'}</td>
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
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">States Covered</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${states_covered?.join(', ') || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Specialties</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${specialties?.join(', ') || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Fee Percentage</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${fee_percentage ? `${fee_percentage}%` : '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Upfront Fee</td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${upfront_fee ? `Yes — $${upfront_fee_amount}` : 'No'}</td>
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
    }).catch(err => console.error('Admin agency notification email failed:', err));
    

    res.status(201).json({
      token,
      agencyUser: {
        _id:       agencyUser._id,
        name:      agencyUser.name,
        email:     agencyUser.email,
        role:      agencyUser.role,
        agency_id: agency._id,
      },
      agency: {
        _id:                agency._id,
        name:               agency.name,
        states_covered:     agency.states_covered,
        specialties:        agency.specialties,
        fee_percentage:     agency.fee_percentage,
        upfront_fee:        agency.upfront_fee,
        upfront_fee_amount: agency.upfront_fee_amount,
        is_verified:        agency.is_verified,
        plan_type:          agency.plan_type,
      },
    });
  } catch (err) {
    console.error('agency register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
 
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }
 
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
 
    const agencyUser = await AgencyUser.findOne({ email });
    if (!agencyUser) {
      // Return 200 deliberately to avoid email enumeration
      return res.status(200).json({ message: 'If that email exists, the password has been reset.' });
    }
 
    if (!agencyUser.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }
 
    const password_hash = await bcrypt.hash(newPassword, 12);
    agencyUser.password_hash = password_hash;
    await agencyUser.save();
 
    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('agency reset-password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
// ─────────────────────────────────────────
// POST /api/agency-auth/login
// ─────────────────────────────────────────
const login = async (req, res) => {

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const agencyUser = await AgencyUser.findOne({ email }).populate('agency_id');
    if (!agencyUser) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!agencyUser.is_active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    const match = await bcrypt.compare(password, agencyUser.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const agency = agencyUser.agency_id; // populated

    if (!agency.is_active) {
      return res.status(403).json({ message: 'Agency account is deactivated' });
    }

    const token = jwt.sign(
      { id: agencyUser._id, agency_id: agency._id, role: 'agency' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      agencyUser: {
        _id:       agencyUser._id,
        name:      agencyUser.name,
        email:     agencyUser.email,
        role:      agencyUser.role,
        agency_id: agency._id,
      },
      agency: {
        _id:            agency._id,
        name:           agency.name,
        states_covered: agency.states_covered,
        specialties:    agency.specialties,
        fee_percentage: agency.fee_percentage,
        is_verified:    agency.is_verified,
        plan_type:      agency.plan_type,
        claim_limit:    agency.claim_limit,
        claims_used:    agency.claims_used,
      },
    });
  } catch (err) {
    console.error('agency login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────
// GET /api/agency/me       [agencyAuth]
// ─────────────────────────────────────────








const getAgencyMe = async (req, res) => {
  try {
    const user = await AgencyUser.findById(req.agencyUser.id).select('-password_hash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const agency = await Agency.findById(user.agency_id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    res.json({ user, agency });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const getAgencyAssignments = async (req, res) => {
  try {
    const agencyUser = await AgencyUser.findById(req.agencyUser.id);
    if (!agencyUser) return res.status(401).json({ message: 'Unauthorized' });

    const assignments = await Assignment.find({ agency_id: agencyUser.agency_id })
      .populate('claim_id', 'debtor_name debtor_email debtor_phone amount due_date description status debtor_type')
      .sort({ assigned_at: -1 });

    const filtered = assignments

    res.json({ assignments: filtered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignment_id, status } = req.body;
    const allowed = ['assigned', 'in_progress', 'closed'];
    if (!allowed.includes(status))
      return res.status(400).json({ message: 'Invalid status value' });

    // ✅ was req.agencyUserId — fixed to req.agencyUser.id
    const agencyUser = await AgencyUser.findById(req.agencyUser.id);
    if (!agencyUser) return res.status(401).json({ message: 'Unauthorized' });

    const assignment = await Assignment.findOne({ _id: assignment_id, agency_id: agencyUser.agency_id });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    assignment.status = status;
    await assignment.save();

    if (['in_progress', 'closed'].includes(status)) {
      const Claim = require('../models/claim');
      await Claim.findByIdAndUpdate(assignment.claim_id, { status });
    }

    res.json({ assignment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};



module.exports = { register, resetPassword,getAgencyMe,login,getAgencyAssignments,updateAssignmentStatus };