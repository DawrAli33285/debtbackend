const { Message, ChatRoom } = require('../models/chat');
const Assignment            = require('../models/assignment');

let io;
const getIO = () => {
  if (!io) io = require('../index').io;
  return io;
};
// ── Determine who is calling (user or agency) ────────────────────────────────
// Attach req.authUser before calling these — see notes in route file below

/* GET /api/chat/rooms
   Returns all chat rooms for the logged-in user OR agency */
const getRooms = async (req, res) => {
  try {
    const filter = req.senderType === 'user'
      ? { user_id:   req.senderId }
      : { agency_id: req.senderId };

    const rooms = await ChatRoom.find(filter)
      .populate('claim_id',  'debtor_name debtor_email amount status description')
      .populate('agency_id', 'name')
      .populate('user_id',   'business_name contact_name')
      .sort({ last_message_at: -1 });

    // Attach last message + unread count to each room
    const enriched = await Promise.all(rooms.map(async (room) => {
      const last = await Message.findOne({ room_id: room._id }).sort({ createdAt: -1 });
      const unread = await Message.countDocuments({
        room_id:     room._id,
        sender_type: req.senderType === 'user' ? 'agency' : 'user',
        read: false,
      });
      return { ...room.toObject(), last_message: last || null, unread };
    }));

    res.json({ rooms: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* GET /api/chat/:roomId/messages */
const getMessages = async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const belongs = req.senderType === 'user'
      ? room.user_id.toString()   === req.senderId.toString()
      : room.agency_id.toString() === req.senderId.toString();
    if (!belongs) return res.status(403).json({ message: 'Access denied' });

    const messages = await Message.find({ room_id: room._id }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* POST /api/chat/:roomId/messages
   Body: { text } */
   const sendMessage = async (req, res) => {
    try {
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ message: 'Text is required' });
  
      const room = await ChatRoom.findById(req.params.roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
  
      const belongs = req.senderType === 'user'
        ? room.user_id.toString()   === req.senderId.toString()
        : room.agency_id.toString() === req.senderId.toString();
      if (!belongs) return res.status(403).json({ message: 'Access denied' });
  
      const message = await Message.create({
        room_id:     room._id,
        sender_type: req.senderType,
        sender_id:   req.senderId,
        text:        text.trim(),
      });
  
      await ChatRoom.findByIdAndUpdate(room._id, { last_message_at: new Date() });
      res.status(201).json({ message });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  /* POST /api/chat/:roomId/upload */
  const sendMessageWithFile = async (req, res) => {
    try {
      const room = await ChatRoom.findById(req.params.roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
  
      const belongs = req.senderType === 'user'
        ? room.user_id.toString()   === req.senderId.toString()
        : room.agency_id.toString() === req.senderId.toString();
      if (!belongs) return res.status(403).json({ message: 'Access denied' });
  
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
      const fileUrl = `${process.env.backendurl}/uploads/${req.file.filename}`;
  
      const message = await Message.create({
        room_id:     room._id,
        sender_type: req.senderType,
        sender_id:   req.senderId,
        text:        req.body.text?.trim() || '',
        attachment: {
          url:           fileUrl,
          original_name: req.file.originalname,
          mime_type:     req.file.mimetype,
        },
      });
  
      await ChatRoom.findByIdAndUpdate(room._id, { last_message_at: new Date() });
  
      // Broadcast file message to both sides in real-time
      try {
        getIO().to(req.params.roomId).emit('receive_message', {
          ...message.toObject(),
          sender:     message.sender_type,
          created_at: message.createdAt,
        });
      } catch (e) {
        console.error('Socket emit error:', e);
      }
  
      res.status(201).json({ message });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };
  

/* POST /api/chat/rooms
   Creates a chat room when a claim is assigned — called internally or by admin
   Body: { claim_id, agency_id, user_id } */
const createRoom = async (req, res) => {
  try {
    const { claim_id, agency_id, user_id } = req.body;


    const existing = await ChatRoom.findOne({ claim_id, agency_id });
    if (existing) return res.json({ room: existing });

    const room = await ChatRoom.create({ claim_id, agency_id, user_id });
    res.status(201).json({ room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getRooms, sendMessageWithFile,getMessages, sendMessage, createRoom };