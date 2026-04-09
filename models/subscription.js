const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan:                 { type: String, enum: ['starter', 'growth', 'unlimited'], required: true },
    status:               { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    stripeCustomerId:     { type: String },
    stripeSubscriptionId: { type: String },
    billing_cycle_start:  { type: Date },
    billing_cycle_end:    { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);