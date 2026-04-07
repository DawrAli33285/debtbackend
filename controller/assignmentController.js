const Assignment = require('../models/assignment');
const Agency     = require('../models/agency');
const Claim      = require('../models/claim');
const Referral   = require('../models/referal');
const { ChatRoom } = require('../models/chat');


exports.createAssignment = async (req, res) => {
  try {
    const { claim_id, agency_id, method = 'manual' } = req.body;

    
    const claim = await Claim.findOne({ _id: claim_id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    
    if (claim.status !== 'submitted') {
      return res.status(400).json({ message: 'Claim is already assigned or closed' });
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

    const assignment = await Assignment.create({
      claim_id,
      agency_id,
      assigned_by: req.user.id,
      method,
    });

    const existingRoom = await ChatRoom.findOne({ claim_id, agency_id });
    if (!existingRoom) {
      await ChatRoom.create({
        claim_id:  assignment.claim_id,
        agency_id: assignment.agency_id,
        user_id:   req.user.id,  // ← was req.userId
      });
    }

    
    claim.status = 'assigned';
    await claim.save();

    
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

   
    const assignment = await Assignment.findOne({ claim_id });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

   
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