const adminModel = require("../models/admin");
const jwt=require('jsonwebtoken');
const User=require('../models/user')

const Claim=require('../models/claim')
const Assignment=require('../models/assignment')
const bcrypt = require('bcrypt');
const Agency = require('../models/agency');
const AgencyUser = require('../models/agencyuser');
const Subscription = require('../models/subscription'); // ✅ add this — adjust path if needed

module.exports.getDashboardStats = async (req, res) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
      // ── USERS ──
      const totalUsers = await User.countDocuments();
      const usersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });
      const usersLastMonth = await User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });
      const userGrowth = usersLastMonth === 0 ? 100 : Math.round(((usersThisMonth - usersLastMonth) / usersLastMonth) * 100);
  
      // ── AGENCIES ──
      const totalAgencies = await Agency.countDocuments();
      const verifiedAgencies = await Agency.countDocuments({ is_verified: true });
      const activeAgencies = await Agency.countDocuments({ is_active: true });
      const agenciesThisMonth = await Agency.countDocuments({ createdAt: { $gte: startOfMonth } });
      const agenciesLastMonth = await Agency.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });
      const agencyGrowth = agenciesLastMonth === 0 ? 100 : Math.round(((agenciesThisMonth - agenciesLastMonth) / agenciesLastMonth) * 100);
  
      // ── CLAIMS ──
      const totalClaims = await Claim.countDocuments();
      const claimsThisMonth = await Claim.countDocuments({ createdAt: { $gte: startOfMonth } });
      const claimsLastMonth = await Claim.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });
      const claimGrowth = claimsLastMonth === 0 ? 100 : Math.round(((claimsThisMonth - claimsLastMonth) / claimsLastMonth) * 100);
  
      const claimsByStatus = await Claim.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const statusMap = { submitted: 0, assigned: 0, in_progress: 0, closed: 0, denied: 0 };
      claimsByStatus.forEach(s => { if (statusMap[s._id] !== undefined) statusMap[s._id] = s.count; });
  
      const totalAmountResult = await Claim.aggregate([
        { $match: { status: { $in: ['assigned', 'in_progress'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const activeClaimsValue = totalAmountResult[0]?.total || 0;
  
      // ── ASSIGNMENTS ──
      const totalAssignments = await Assignment.countDocuments();
      const assignmentsThisMonth = await Assignment.countDocuments({ createdAt: { $gte: startOfMonth } });
  
      // ── MONTHLY TREND (last 6 months) ──
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const label = d.toLocaleString('default', { month: 'short' });
        const [users, claims, agencies] = await Promise.all([
          User.countDocuments({ createdAt: { $gte: d, $lte: end } }),
          Claim.countDocuments({ createdAt: { $gte: d, $lte: end } }),
          Agency.countDocuments({ createdAt: { $gte: d, $lte: end } }),
        ]);
        months.push({ month: label, users, claims, agencies });
      }
  
      // ── RECENT CLAIMS ──
      const recentClaims = await Claim.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user_id', 'business_name email');
  
      // ── TOP AGENCIES BY CLAIMS HANDLED ──
      const topAgencies = await Assignment.aggregate([
        { $group: { _id: '$agency_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'agencies', localField: '_id', foreignField: '_id', as: 'agency' } },
        { $unwind: '$agency' },
        { $project: { name: '$agency.name', plan: '$agency.plan_type', is_verified: '$agency.is_verified', count: 1 } }
      ]);
  
      // ── USER PLAN BREAKDOWN ──
      const planBreakdown = await User.aggregate([
        { $group: { _id: '$subscription_plan', count: { $sum: 1 } } }
      ]);
  
      // ── AGENCY PLAN BREAKDOWN ──
      const agencyPlanBreakdown = await Agency.aggregate([
        { $group: { _id: '$plan_type', count: { $sum: 1 } } }
      ]);
  
      res.json({
        success: true,
        stats: {
          users: { total: totalUsers, thisMonth: usersThisMonth, growth: userGrowth },
          agencies: { total: totalAgencies, verified: verifiedAgencies, active: activeAgencies, growth: agencyGrowth },
          claims: { total: totalClaims, thisMonth: claimsThisMonth, growth: claimGrowth, byStatus: statusMap, activeValue: activeClaimsValue },
          assignments: { total: totalAssignments, thisMonth: assignmentsThisMonth },
        },
        monthlyTrend: months,
        recentClaims,
        topAgencies,
        planBreakdown,
        agencyPlanBreakdown,
      });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  };


module.exports.adminLogin = async (req, res) => {
    let { ...data } = req.body;
    
    try {
        
        if (!data.email || !data.password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }
  
       
        let adminFound = await adminModel.findOne({ email: data.email });
        if (!adminFound) {
            return res.status(400).json({
                error: "Admin not found"
            });
        }
  
     
        if (adminFound.password !== data.password) {
            return res.status(400).json({
                error: "Invalid password"
            });
        }
  
     
        adminFound = adminFound.toObject();
        const { password, ...adminWithoutPassword } = adminFound;
  
     
        let token = await jwt.sign(adminWithoutPassword, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });
  
       
        console.log(`Admin login successful for: ${data.email} at ${new Date().toISOString()}`);
  
        return res.status(200).json({
            admin: adminWithoutPassword,
            token
        });
  
    } catch (e) {
        console.log(e.message);
        return res.status(400).json({
            error: "Error occurred while trying to login"
        });
    }
  };
  
  
  module.exports.adminRegister = async (req, res) => {
    let { ...data } = req.body;
    
    try {
       
        if (!data.email || !data.password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }
  
      
        let alreadyExists = await adminModel.findOne({ email: data.email });
        if (alreadyExists) {
            return res.status(400).json({
                error: "Admin already exists"
            });
        }
  
        let admin = await adminModel.create(data);
        admin = admin.toObject();
  
        
        const { password, ...adminWithoutPassword } = admin;
        let token = await jwt.sign(adminWithoutPassword, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });
  
       
        return res.status(200).json({
            admin: adminWithoutPassword,
            token
        });
  
    } catch (e) {
        console.log(e.message);
        return res.status(400).json({
            error: "Error occurred while trying to register"
        });
    }
  };
  
  module.exports.resetPassword = async (req, res) => {
    let { email, password } = req.body;
    
    try {
      
        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }
       
        if (password.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }
  
      
        let adminFound = await adminModel.findOne({ email });
        if (!adminFound) {
            return res.status(400).json({
                error: "Admin not found"
            });
        }
  
      
        await adminModel.updateOne(
            { email }, 
            {
                $set: {
                    password: password 
                }
            }
        );
  
        return res.status(200).json({
            message: "Password reset successfully"
        });
  
    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Error occurred while trying to reset password",
            details: e.message
        });
    }
  };














  module.exports.getUsers = async (req, res) => {
    try {
      const users = await User.find({}, '-password_hash').sort({ createdAt: -1 });
      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
  
  // POST add user
  module.exports.addUser = async (req, res) => {
    try {
      const { email, password, business_name = 'N/A', contact_name = 'N/A' } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }
  
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ success: false, message: 'User with this email already exists' });
      }
  
      const password_hash = await bcrypt.hash(password, 10);
      const user = await User.create({ email, password_hash, business_name, contact_name });
  
      const userObj = user.toObject();
      delete userObj.password_hash;
  
      res.status(201).json({ success: true, user: userObj });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
  
  // PATCH update user
  module.exports.updateUser = async (req, res) => {
    try {
      const { id } = req.params;
      const { email, password, credits, business_name, contact_name, subscription_plan, claimsLimit } = req.body;
  
      console.log('📥 updateUser called:', { id, subscription_plan, claimsLimit }); // ✅ add this
  
      const updateFields = {};
      if (email)    updateFields.email    = email;
      if (business_name !== undefined) updateFields.business_name = business_name;
      if (contact_name  !== undefined) updateFields.contact_name  = contact_name;
      if (credits !== undefined) updateFields.credits = parseFloat(credits) || 0;
      if (password) {
        updateFields.password_hash = await bcrypt.hash(password, 10);
      }
  
      // ✅ Fix: use !== undefined instead of truthy check so "starter" isn't skipped
      if (subscription_plan !== undefined && subscription_plan !== null) {
        const planLimits = { starter: 3, growth: 10, unlimited: 999999 };
        const limit = claimsLimit ?? planLimits[subscription_plan] ?? 0;
  
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
  
        updateFields.subscription_plan      = subscription_plan;
        updateFields.monthly_claim_limit    = limit;
        updateFields.claims_used_this_month = 0;
        updateFields.billing_cycle_start    = now;
        updateFields.billing_cycle_end      = periodEnd;
  
        console.log('📝 Updating subscription to:', subscription_plan, '| limit:', limit); // ✅
  
        const subResult = await Subscription.findOneAndUpdate(
          { user: id },
          {
            user:                id,
            plan:                subscription_plan,
            status:              'active',
            billing_cycle_start: now,
            billing_cycle_end:   periodEnd,
          },
          { upsert: true, new: true }
        );
        console.log('📋 Subscription upsert result:', subResult); // ✅
      }
  
      const user = await User.findByIdAndUpdate(id, updateFields, { new: true, select: '-password_hash' });
      console.log('👤 Updated user subscription_plan:', user?.subscription_plan); // ✅
  
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  
      res.json({ success: true, user });
    } catch (err) {
      console.error('❌ updateUser error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  
  // DELETE user
  module.exports.deleteUser = async (req, res) => {
    try {
      const { id } = req.params;
  
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
  
  // POST send invoice (stores or emails — basic implementation)
  module.exports.sendInvoice = async (req, res) => {
    try {
      const { userId, price, description } = req.body;
  
      if (!userId || !price || !description) {
        return res.status(400).json({ success: false, message: 'userId, price, and description are required' });
      }
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // TODO: plug in your email/invoice service here (e.g. nodemailer, Stripe, etc.)
      // For now, we just acknowledge receipt
      console.log(`Invoice sent to ${user.email}: $${price} — ${description}`);
  
      res.json({
        success: true,
        message: `Invoice of $${price} sent to ${user.email}`,
        invoice: { userId, email: user.email, price, description, sentAt: new Date() }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };




  module.exports.getAgencies = async (req, res) => {
    try {
      const agencies = await Agency.find().sort({ createdAt: -1 }).lean();
  
      // For each agency, find the owner user and attach their email
      const agenciesWithEmail = await Promise.all(
        agencies.map(async (agency) => {
          const owner = await AgencyUser.findOne(
            { agency_id: agency._id, role: 'owner' },
            'email name'
          ).lean();
  
          return {
            ...agency,
            // Use contact_email from agency if set, otherwise fall back to owner's email
            contact_email: agency.contact_email || owner?.email || null,
            owner_name:    owner?.name || null,
          };
        })
      );
  
      res.json({ success: true, agencies: agenciesWithEmail });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
  
  module.exports.updateAgency = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, contact_email, contact_phone, password, plan_type } = req.body;
  
      const agencyFields = {};
      if (name !== undefined)          agencyFields.name          = name;
      if (contact_email !== undefined) agencyFields.contact_email = contact_email;
      if (contact_phone !== undefined) agencyFields.contact_phone = contact_phone;
  
      // ✅ Admin assigns plan directly — no Stripe
      if (plan_type) {
        const PLAN_CLAIM_LIMITS = { starter: 25, growth: 100, professional: 500, enterprise: 99999 };
  
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
  
        agencyFields.plan_type               = plan_type;
        agencyFields.claim_limit             = PLAN_CLAIM_LIMITS[plan_type] ?? 0;
        agencyFields.claims_used             = 0;
        agencyFields.subscription_start_date = now;
        agencyFields.subscription_end_date   = periodEnd;
      }
  
      const agency = await Agency.findByIdAndUpdate(id, agencyFields, { new: true });
      if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
  
      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        await AgencyUser.findOneAndUpdate(
          { agency_id: id, role: 'owner' },
          { password_hash }
        );
      }
  
      res.json({ success: true, agency });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
  // DELETE agency (also deletes its users)
  module.exports.deleteAgency = async (req, res) => {
    try {
      const { id } = req.params;
  
      const agency = await Agency.findByIdAndDelete(id);
      if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
  
      // Clean up agency users too
      await AgencyUser.deleteMany({ agency_id: id });
  
      res.json({ success: true, message: 'Agency and its users deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };