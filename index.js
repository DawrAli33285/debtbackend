const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const claimRoutes = require('./routes/claims');
const adminRoutes = require('./routes/admin');
const businessSubscriptionRoutes = require('./routes/businesssubscription');
const agencySubscriptionRoutes = require('./routes/agencysubscription');
const businessAccountRoutes=require('./routes/account')
require('dotenv').config();
const connection = require('./connection/connection');
const { Message, ChatRoom } = require('./models/chat');
const subscriptionReset=require('./util/subscriptionreset')
const app = express();
const server = http.createServer(app); // ← wrap express in http server

const io = new Server(server, {
  cors: {
    origin: '*', // tighten this in production
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

app.use((req, res, next) => {
  if (req.originalUrl === '/subscription/webhook' || 
      req.originalUrl === '/businessSubscription/webhook') {
    next()
  } else {
    express.json()(req, res, next)
  }
})
app.use((req, res, next) => {
  if (req.originalUrl === '/subscription/webhook' || 
      req.originalUrl === '/businessSubscription/webhook') {
    express.raw({ type: 'application/json' })(req, res, next)
  } else {
    next()
  }
})

connection;

app.use('/uploads', express.static('/tmp/public/files/files'));
app.use('/auth', authRoutes);
app.use('/claims', claimRoutes);
app.use('/chat', require('./routes/chat'));
app.use('/agencies', require('./routes/agency'));
app.use('/assignments', require('./routes/assignment'));
app.use('/subscription', agencySubscriptionRoutes);
app.use('/businessSubscription', businessSubscriptionRoutes);
app.use('/agency/claims', require('./routes/agencyclaim'));
app.use('/businessAccount',businessAccountRoutes)
app.use('/admin', adminRoutes);

// ── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Client joins a chat room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Client leaves a chat room
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
  });

  // Real-time message (text only — file uploads still go through REST)
  socket.on('send_message', async (data) => {
    // data: { roomId, text, senderId, senderType }
    try {
      const room = await ChatRoom.findById(data.roomId);
      if (!room) return;

      const message = await Message.create({
        room_id:     data.roomId,
        sender_type: data.senderType,
        sender_id:   data.senderId,
        text:        data.text?.trim() || '',
      });


      console.log('message created:', message);
      await ChatRoom.findByIdAndUpdate(data.roomId, {
        last_message_at: new Date(),
      });

      // Broadcast to everyone in the room (including sender)
      io.to(data.roomId).emit('receive_message', {
        ...message.toObject(),
        room_id: message.room_id.toString(), // ← explicit string to avoid ObjectId mismatch
        sender: message.sender_type,
        created_at: message.createdAt,
      });

    } catch (err) {
      console.error('Socket send_message error:', err);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Export io so chat controller can emit file-upload messages too
module.exports.io = io;

subscriptionReset

server.listen(5000, () => console.log('Server running on port 5000'));