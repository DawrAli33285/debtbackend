const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    claim_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
    file_url:  { type: String },
    file_type: { type: String },
  }, { timestamps: true });
  
module.exports = mongoose.model('Document', documentSchema);