const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createClaim, getClaims, addDocuments,deleteDocument,getClaimById,updateClaim } = require('../controller/claimController');
const auth = require('../middleware/auth');
const fs=require('fs')
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = '/tmp/public/files/files';
      
      const fs = require('fs');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

const fileFilter = (req, file, cb) => {
  const allowed = /pdf|jpg|jpeg|png|doc|docx/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only PDF, images, and Word documents are allowed'));
};

const upload = multer({
  storage,
  
  fileFilter,
});

router.post('/create', auth, upload.array('documents', 5), createClaim);
router.get('/', auth, getClaims);
router.get('/:id', auth, getClaimById);
router.put('/:id', auth, updateClaim);


router.post('/:id/documents',                   auth, upload.array('documents', 5), addDocuments);
router.delete('/:id/documents/:docId',          auth, deleteDocument);

module.exports = router;