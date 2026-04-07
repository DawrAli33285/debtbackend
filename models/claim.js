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
      enum: ['submitted', 'assigned', 'in_progress', 'closed'],
      default: 'submitted'
    },
  }, { timestamps: true });

module.exports = mongoose.model('Claim', claimSchema);