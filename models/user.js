const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    business_name: { type: String, required: true },
    contact_name:  { type: String, required: true },
    email:         { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    subscription_plan: { type: String, enum: ['starter', 'growth', 'unlimited', 'enterprise'], default: 'starter' },
monthly_claim_limit:      { type: Number, default: 1 },
claims_used_this_month:   { type: Number, default: 0 },
billing_cycle_start:      { type: Date },
billing_cycle_end:        { type: Date },
terms_accept:{type:Boolean,default:false},
signature_name:   { type: String },
paypalSubscriptionId: { type: String },
accepted_at:      { type: Date },
ein:{type:String}
  }, { timestamps: true });
module.exports = mongoose.model('User', userSchema);