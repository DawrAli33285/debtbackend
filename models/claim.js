const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    user_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    debtor_type:    { type: String },
    debtor_name:    { type: String },
    debtor_email:   { type: String },
    debtor_phone:   { type: String },
    debtor_address: { type: String },
    amount:         { type: Number },
    due_date:       { type: Date },
    description:    { type: String },
    status: {
      type: String,
      enum: [
        'submitted', 'assigned', 'in_progress', 'closed', 'denied',
        'pending_admin', 'approved_by_agency', 'connection_approved', 'connection_denied'
      ],
      default: 'submitted'
    },
    documents:        [{ filename: String, path: String, mimetype: String, uploadedAt: { type: Date, default: Date.now } }],
    past_due_period:  { type: String, enum: ['3_months', '6_months', '8_months','9_months'], default: null },
  }, { timestamps: true });

module.exports = mongoose.model('Claim', claimSchema);