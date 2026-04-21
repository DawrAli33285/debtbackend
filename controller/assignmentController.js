const Assignment = require('../models/assignment');
const Agency     = require('../models/agency');
const Claim      = require('../models/claim');
const Referral   = require('../models/referal');
const { ChatRoom } = require('../models/chat');

exports.createAssignment = async (req, res) => {
  try {
    const { claim_id, agency_id, method = 'manual' } = req.body;

    const claim = await Claim.findOne({ _id: claim_id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Allow assignment from submitted OR after connection_denied (reassignment)
    if (!['submitted', 'connection_denied', 'denied'].includes(claim.status)) {
      return res.status(400).json({
        message: `Claim cannot be assigned. Current status: "${claim.status}". Only submitted or previously denied claims can be assigned.`,
      });
    }

    const agency = await Agency.findById(agency_id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    if (agency.claims_used >= agency.claim_limit) {
      return res.status(403).json({
        message: 'Agency has reached its claim limit. Please select another agency.',
        claims_used: agency.claims_used,
        claim_limit: agency.claim_limit,
        plan: agency.plan_type,
      });
    }

    // ✅ If reassigning after denial, deactivate old assignment
    await Assignment.updateMany(
      { claim_id, status: { $ne: 'completed' } },
      { status: 'replaced' }
    );

    const assignment = await Assignment.create({
      claim_id,
      agency_id,
      assigned_by: req.user.id,
      method,
      status: 'active',
    });

    // ✅ Removed the pointless ChatRoom.findOne that was here
    // ChatRoom is only created later when admin approves the connection

    claim.status = 'assigned';
    await claim.save();

    // ✅ Only increment if this is a fresh assignment, not a reassignment
    // (agency already had this claim counted if it was connection_denied)
    agency.claims_used += 1;
    await agency.save();

    res.status(201).json({ message: 'Claim assigned successfully', assignment });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.closeClaim = async (req, res) => {
  try {
    const { claim_id, recovered_amount } = req.body;

    const claim = await Claim.findById(claim_id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Only connection_approved claims can be closed — they are the ones actively in work
    if (claim.status !== 'connection_approved') {
      return res.status(400).json({
        message: `Only active claims (connection_approved) can be closed. Current status: "${claim.status}"`,
      });
    }

    if (!recovered_amount || recovered_amount < 0) {
      return res.status(400).json({ message: 'A valid recovered amount is required to close the claim.' });
    }

    const assignment = await Assignment.findOne({ claim_id, status: 'active' });
    if (!assignment) return res.status(404).json({ message: 'Active assignment not found' });

    const referral_fee = recovered_amount * 0.07;

    await Referral.create({
      claim_id,
      agency_id: assignment.agency_id,
      recovered_amount,
      referral_fee,
      status: 'pending',
    });

    claim.status = 'closed';
    await claim.save();

    assignment.status = 'completed';
    await assignment.save();

    res.status(200).json({
      message: 'Claim closed and referral fee recorded',
      recovered_amount,
      referral_fee,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};