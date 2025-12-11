const express = require('express');
const router = express.Router();
const memeController = require('../controllers/memeController');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Public routes
router.get('/', memeController.getMemes);
router.get('/trending', memeController.getTrendingMemes);

// Protected routes (must come BEFORE /:id to avoid conflicts)
router.post('/', verifyToken, upload.single('image'), memeController.uploadMeme);
router.get('/my-memes', verifyToken, memeController.getMyMemes);
router.put('/:id', verifyToken, memeController.updateMeme);
router.delete('/:id', verifyToken, memeController.deleteMeme);

// Public routes (dynamic - must come LAST)
router.get('/:id', memeController.getSingleMeme);

module.exports = router;
