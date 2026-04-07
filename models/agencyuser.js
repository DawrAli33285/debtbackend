const mongoose = require('mongoose');

const agencyUserSchema = new mongoose.Schema({
  agency_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role:          { type: String, enum: ['owner', 'member'], default: 'owner' },
  is_active:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('AgencyUser', agencyUserSchema);