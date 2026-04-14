const Claim = require('../models/claim');
const Agency = require('../models/agency');
const { ChatRoom } = require('../models/chat');
const Assignment = require('../models/assignment');

exports.acceptClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    const assignment= await Assignment.findOne({claim_id:claim._id})
    
    if (claim.status === 'closed' || claim.status === 'denied')
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    const agency = await Agency.findById(req.agencyUser.agency_id || req.agencyUser._id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    if (agency.claims_used >= agency.claim_limit)
      return res.status(403).json({ message: 'Monthly claim limit reached. Upgrade your plan.' });

    claim.status = 'in_progress';
    
    await claim.save();

    agency.claims_used += 1;
    await agency.save();


        await ChatRoom.create({
          claim_id:  assignment.claim_id,
          agency_id: assignment.agency_id,
          user_id:   claim.user_id,  
        });
    

    res.json({ message: 'Claim accepted successfully', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.denyClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (claim.status === 'closed' || claim.status === 'denied')
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    claim.status = 'denied';
    await claim.save();

    res.json({ message: 'Claim denied', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// ADD to existing controller file

exports.reopenClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
   
    claim.status = 'in_progress';
    await claim.save();
    res.json({ claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.closeClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (claim.status !== 'in_progress') return res.status(400).json({ message: 'Only in-progress claims can be closed' });

    claim.status = 'closed';
    await claim.save();
    res.json({ claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

