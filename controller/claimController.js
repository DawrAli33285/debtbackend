const Claim = require('../models/claim');
const User=require('../models/user')
const path=require('path')
const fs=require('fs')
exports.createClaim = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const now = new Date();
    if (user.billing_cycle_end && now > user.billing_cycle_end) {
      user.claims_used_this_month = 0;
      user.billing_cycle_start = now;
      user.billing_cycle_end = new Date(now.setMonth(now.getMonth() + 1));
      await user.save();
    }

    if (
      user.subscription_plan !== 'unlimited' &&
      user.claims_used_this_month >= user.monthly_claim_limit
    ) {
      return res.status(403).json({
        message: 'Monthly claim limit reached. Please upgrade your plan.',
        claims_used: user.claims_used_this_month,
        claim_limit: user.monthly_claim_limit,
        plan: user.subscription_plan,
      });
    }

    const {
      debtor_type, debtor_name, debtor_email,
      debtor_phone, debtor_address, amount,
      due_date, past_due_period, description,
    } = req.body;

 
    const documents = (req.files || []).map(file => ({
      filename: file.originalname,
      path: file.filename,       // just the filename — served via /uploads/:filename
      mimetype: file.mimetype,
    }));

    const claim = await Claim.create({
      user_id: req.user.id,
      debtor_type, debtor_name, debtor_email,
      debtor_phone, debtor_address, amount,
      due_date, past_due_period, description,
      documents,
    });

    user.claims_used_this_month += 1;
    await user.save();

    res.status(201).json({
      message: 'Claim submitted',
      claim,
      claims_remaining: user.monthly_claim_limit - user.claims_used_this_month,
    });

  } catch (err) {
    console.log(err.message)
    res.status(500).json({ message: err.message });
  }
};

exports.getClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ user_id: req.user.id });
    res.status(200).json({ claims });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getClaimById = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    res.status(200).json({ claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




exports.updateClaim = async (req, res) => {
  try {
    const {
      debtor_name, debtor_email, debtor_phone,
      debtor_address, debtor_type, amount, due_date, description
    } = req.body;

    const claim = await Claim.findOne({ _id: req.params.id });


    if (!claim) {
      return res.status(404).json({ message: 'Claim not found or unauthorized' });
    }

    // Update only the editable fields
    claim.debtor_name    = debtor_name    ?? claim.debtor_name;
    claim.debtor_email   = debtor_email   ?? claim.debtor_email;
    claim.debtor_phone   = debtor_phone   ?? claim.debtor_phone;
    claim.debtor_address = debtor_address ?? claim.debtor_address;
    claim.debtor_type    = debtor_type    ?? claim.debtor_type;
    claim.amount         = amount         ?? claim.amount;
    claim.due_date       = due_date       ?? claim.due_date;
    claim.description    = description    ?? claim.description;

    await claim.save();

    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.deleteDocument = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
 
    const doc = claim.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
 
    // Delete file from disk
    const filePath = path.join('/tmp/public/files/files', doc.path);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Could not delete file from disk:', err.message);
    });
 
    doc.deleteOne();
    await claim.save();
 
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
 
// POST /api/claims/:id/documents
exports.addDocuments = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
 
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
 
    const newDocs = req.files.map(file => ({
      filename: file.originalname,
      path: file.filename,
      mimetype: file.mimetype,
    }));
 
    claim.documents.push(...newDocs);
    await claim.save();
 
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

