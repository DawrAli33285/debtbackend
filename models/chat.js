const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  sender_type: { type: String, enum: ['user', 'agency'], required: true },
  sender_id:   { type: mongoose.Schema.Types.ObjectId, required: true },
  text:        { type: String, required: true },
}, { timestamps: true });

const chatRoomSchema = new mongoose.Schema({
  claim_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Claim',    required: true },
  agency_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agency',   required: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  last_message_at: { type: Date, default: Date.now },
}, { timestamps: true });

const Message  = mongoose.model('Message',  messageSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = { Message, ChatRoom };