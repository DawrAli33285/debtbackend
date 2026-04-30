// const Claim = require('../models/claim');
// const Agency = require('../models/agency');
// const { ChatRoom } = require('../models/chat');
// const Assignment = require('../models/assignment');

// exports.acceptClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
//     const assignment= await Assignment.findOne({claim_id:claim._id})
    
//     if (claim.status === 'closed' || claim.status === 'denied')
//       return res.status(400).json({ message: 'This claim is already closed or denied' });

//     const agency = await Agency.findById(req.agencyUser.agency_id || req.agencyUser._id);
//     if (!agency) return res.status(404).json({ message: 'Agency not found' });

//     if (agency.claims_used >= agency.claim_limit)
//       return res.status(403).json({ message: 'Monthly claim limit reached. Upgrade your plan.' });

//     claim.status = 'in_progress';
    
//     await claim.save();

//     agency.claims_used += 1;
//     await agency.save();


//         await ChatRoom.create({
//           claim_id:  assignment.claim_id,
//           agency_id: assignment.agency_id,
//           user_id:   claim.user_id,  
//         });
    

//     res.json({ message: 'Claim accepted successfully', claim });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };

// exports.denyClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });

//     if (claim.status === 'closed' || claim.status === 'denied')
//       return res.status(400).json({ message: 'This claim is already closed or denied' });

//     claim.status = 'denied';
//     await claim.save();

//     res.json({ message: 'Claim denied', claim });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };


// // ADD to existing controller file

// exports.reopenClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
   
//     claim.status = 'in_progress';
//     await claim.save();
//     res.json({ claim });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.closeClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
//     if (claim.status !== 'in_progress') return res.status(400).json({ message: 'Only in-progress claims can be closed' });

//     claim.status = 'closed';
//     await claim.save();
//     res.json({ claim });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };






const Claim = require('../models/claim');
const Agency = require('../models/agency');
const { ChatRoom } = require('../models/chat');
const Assignment = require('../models/assignment');
const nodemailer = require('nodemailer'); // add this if you have nodemailer setup

// ── helper: send email (adjust to your existing email setup) ──────────────────
const sendMail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransporter({
      // replace with your SMTP config / service
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

// ── Agency accepts a claim ────────────────────────────────────────────────────
// Status: assigned → approved_by_agency → pending_admin
exports.acceptClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id).populate('user_id', 'email business_name');
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (['closed', 'denied', 'connection_denied'].includes(claim.status))
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    const agency = await Agency.findById(req.agencyUser.agency_id || req.agencyUser._id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    if (agency.claims_used >= agency.claim_limit)
      return res.status(403).json({ message: 'Monthly claim limit reached. Upgrade your plan.' });

    const assignment = await Assignment.findOne({ claim_id: claim._id });

    // ✅ Move to pending_admin (NOT in_progress anymore)
    claim.status = 'pending';
    claim.agency_approved_at = new Date();
    await claim.save();

    // Update to pending_admin right after
    claim.status = 'pending';
    await claim.save();

    agency.claims_used += 1;
    await agency.save();

    // ✅ DO NOT create ChatRoom yet — only created after admin approves
    // ChatRoom is created in admin approveConnection controller

    // ✅ Notify business that agency approved and admin review is pending
    if (claim.user_id?.email) {
     
    }

    res.json({ message: 'Claim accepted — pending admin approval', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Agency denies a claim ─────────────────────────────────────────────────────
// Status: assigned → denied
exports.denyClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (['closed', 'denied', 'connection_denied'].includes(claim.status))
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    // ✅ Agency denial goes back to submitted so admin can reassign
    claim.status = 'denied';
    await claim.save();

    res.json({ message: 'Claim denied', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Close a claim ─────────────────────────────────────────────────────────────
// Only allowed when connection_approved (actively being worked)
exports.closeClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Only connection_approved claims can be closed (they are actively in work)
    if (claim.status!=='in_progress')
      return res.status(400).json({ message: 'Only active (connection approved) claims can be closed' });

    claim.status = 'closed';
    await claim.save();

    res.json({ message: 'Claim closed successfully', claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Reopen a claim ────────────────────────────────────────────────────────────
// Goes back to submitted so admin can reassign to a new agency
exports.reopenClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (claim.status !== 'closed')
      return res.status(400).json({ message: 'Only closed claims can be reopened' });

    // ✅ Goes to submitted — admin reassigns to agency, full flow restarts
    claim.status = 'assigned';
    await claim.save();

    res.json({ message: 'Claim reopened and back in queue', claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};