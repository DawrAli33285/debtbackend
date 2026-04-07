const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  claim_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  agency_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  recovered_amount: { type: Number, default: 0 },
  referral_fee:     { type: Number, default: 0 },
  status:           { type: String, enum: ['pending', 'paid'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);