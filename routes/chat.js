const express    = require('express');
const router     = express.Router();
const { getRooms, getMessages, sendMessage, createRoom, sendMessageWithFile, getUnreadCount } = require('../controller/chatController');
const auth        = require('../middleware/auth');        // sets req.user  (business user)
const agencyAuth  = require('../middleware/agencyauth'); // sets req.agencyUser
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

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

const uploadDir = '/tmp/public/files/files';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|png|jpg|jpeg|gif|webp|txt|xlsx|csv/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            && allowed.test(file.mimetype.split('/')[1]);
    ok ? cb(null, true) : cb(new Error('File type not allowed'));
  },
});



// ── User routes ───────────────────────────────────────────────────────────────
router.get('/rooms',                    auth, asUser,   getRooms);
router.get('/:roomId/messages',         auth, asUser,   getMessages);
router.post('/:roomId/messages',        auth, asUser,   sendMessage);

// ── Agency routes ─────────────────────────────────────────────────────────────
router.get('/agency/rooms',             agencyAuth, asAgency, getRooms);
router.get('/agency/:roomId/messages',  agencyAuth, asAgency, getMessages);
router.post('/agency/:roomId/messages', agencyAuth, asAgency, sendMessage);



// For agency uploads
router.post('/agency/:roomId/upload', agencyAuth, asAgency, upload.single('file'), sendMessageWithFile);

// For user uploads  
router.post('/:roomId/upload', auth, asUser, upload.single('file'), sendMessageWithFile);
// ── Internal: create a room when a claim is assigned ─────────────────────────
router.post('/rooms', auth, createRoom);

router.get('/unread-count',        auth,       asUser,   getUnreadCount);
router.get('/agency/unread-count', agencyAuth, asAgency, getUnreadCount);

module.exports = router;