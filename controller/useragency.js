const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const Agency     = require('../models/agency');
const AgencyUser = require('../models/agencyuser');
const Assignment=require('../models/assignment')

// ─────────────────────────────────────────
// POST /api/agency-auth/register
// Creates an Agency profile + owner AgencyUser in one step
// ─────────────────────────────────────────
const register = async (req, res) => {
  try {
    const {
      // agency profile
      agency_name,
      states_covered,
      specialties,
      fee_percentage,
      // owner login
      name,
      email,
      password,
    } = req.body;

    if (!agency_name || !name || !email || !password) {
      return res.status(400).json({ message: 'agency_name, name, email and password are required' });
    }

    const existing = await AgencyUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // 1. Create the Agency profile
    const agency = await Agency.create({
      name:           agency_name,
      states_covered: states_covered || [],
      specialties:    specialties    || [],
      fee_percentage: fee_percentage || 0,
    });

    // 2. Create the owner AgencyUser linked to that agency
    const password_hash = await bcrypt.hash(password, 12);

    const agencyUser = await AgencyUser.create({
      agency_id:     agency._id,
      name,
      email,
      password_hash,
      role: 'owner',
    });

    const token = jwt.sign(
      { id: agencyUser._id, agency_id: agency._id, role: 'agency' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

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
        _id:            agency._id,
        name:           agency.name,
        states_covered: agency.states_covered,
        specialties:    agency.specialties,
        fee_percentage: agency.fee_percentage,
        is_verified:    agency.is_verified,
        plan_type:      agency.plan_type,
      },
    });
  } catch (err) {
    console.error('agency register error:', err);
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

    const filtered = assignments.filter(a => a.claim_id?.status !== 'denied');

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



module.exports = { register, getAgencyMe,login,getAgencyAssignments,updateAssignmentStatus };