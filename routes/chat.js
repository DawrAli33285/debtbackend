const express    = require('express');
const router     = express.Router();
const { getRooms, getMessages, sendMessage, createRoom } = require('../controller/chatController');
const auth        = require('../middleware/auth');        // sets req.user  (business user)
const agencyAuth  = require('../middleware/agencyauth'); // sets req.agencyUser

// ── Middleware: unify identity so controllers don't care who's calling ────────
const asUser = (req, res, next) => {
  req.senderType = 'user';
  req.senderId   = req.user.id;
  next();
};

const asAgency = (req, res, next) => {
  req.senderType = 'agency';
  req.senderId   = req.agencyUser.agency_id; // the Agency _id, not AgencyUser _id
  next();
};

// ── User routes ───────────────────────────────────────────────────────────────
router.get('/rooms',                    auth, asUser,   getRooms);
router.get('/:roomId/messages',         auth, asUser,   getMessages);
router.post('/:roomId/messages',        auth, asUser,   sendMessage);

// ── Agency routes ─────────────────────────────────────────────────────────────
router.get('/agency/rooms',             agencyAuth, asAgency, getRooms);
router.get('/agency/:roomId/messages',  agencyAuth, asAgency, getMessages);
router.post('/agency/:roomId/messages', agencyAuth, asAgency, sendMessage);

// ── Internal: create a room when a claim is assigned ─────────────────────────
router.post('/rooms', auth, createRoom);

module.exports = router;