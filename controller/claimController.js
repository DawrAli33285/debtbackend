const Claim = require('../models/claim');
const User=require('../models/user')

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
      debtor_phone, debtor_address, amount, due_date, description,
    } = req.body;

    const claim = await Claim.create({
      user_id: req.user.id,
      debtor_type, debtor_name, debtor_email,
      debtor_phone, debtor_address, amount, due_date, description,
    });

   
    user.claims_used_this_month += 1;
    await user.save();

    res.status(201).json({
      message: 'Claim submitted',
      claim,
      claims_remaining: user.monthly_claim_limit - user.claims_used_this_month,
    });

  } catch (err) {
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