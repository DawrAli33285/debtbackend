const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
    name:           { type: String, required: true },
    states_covered: [{ type: String }],
    specialties:    [{ type: String }],
    fee_percentage: { type: Number },
    is_verified:    { type: Boolean, default: false },
    plan_type:               { type: String, enum: ['starter', 'growth', 'professional', 'enterprise'], default: 'starter' },
    claim_limit:             { type: Number, default: 25 },
    claims_used:             { type: Number, default: 0 },
    subscription_start_date: { type: Date },
    subscription_end_date:   { type: Date },
    tax_id:{type:String},
    contact_email: { type: String },
    subscription_status:     { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    paypalSubscriptionId:    { type: String },
contact_phone: { type: String },
    is_active:               { type: Boolean, default: true },
    
  }, { timestamps: true });
  

module.exports = mongoose.model('Agency', agencySchema);