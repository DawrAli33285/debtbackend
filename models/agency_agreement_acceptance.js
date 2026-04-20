const mongoose = require('mongoose');

const agencyAgreementSchema = new mongoose.Schema(
  {
    agency_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
    },
    agreement_version: {
      type: String,
      required: true,
      default: 'v1.0',
    },
    accepted_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ip_address: {
      type: String,
      required: true,
    },
    user_agent: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AgencyAgreement', agencyAgreementSchema);