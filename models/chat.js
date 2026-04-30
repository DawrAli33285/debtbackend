const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  sender_type: { type: String, enum: ['user', 'agency'], required: true },
  sender_id:   { type: mongoose.Schema.Types.ObjectId, required: true },
  text:        { type: String, default: '' },
  read:        { type: Boolean, default: false },
  attachment:  {
    url:          { type: String },
    original_name: { type: String },
   
    mime_type:    { type: String },
  },
}, { timestamps: true });


const chatRoomSchema = new mongoose.Schema({
  claim_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Claim',    required: true },
  agency_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agency',   required: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  last_message_at: { type: Date, default: Date.now },
  is_closed:      { type: Boolean, default: false },
  closed_at:      { type: Date },
  closed_reason:  { type: String },
}, { timestamps: true });


const Message  = mongoose.model('Message',  messageSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = { Message, ChatRoom };