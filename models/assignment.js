const mongoose = require('mongoose');
const assignmentSchema = new mongoose.Schema({
    claim_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
    agency_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
    assigned_at: { type: Date, default: Date.now },
    status:      { type: String },

    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    method:      { type: String, enum: ['auto', 'manual'], default: 'manual' },
  }, { timestamps: true });
module.exports = mongoose.model('Assignment', assignmentSchema);