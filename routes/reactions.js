const express = require('express');
const router = express.Router();
const reactionController = require('../controllers/reactionController');
const verifyToken = require('../middleware/verifyToken');
const jwt = require('jsonwebtoken');

// Optional token verification for get reactions (to check user's own reaction)
const optionalVerifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  console.log('[optionalVerifyToken] Authorization header:', authHeader);

  const token = authHeader?.replace('Bearer ', '');
  console.log('[optionalVerifyToken] Extracted token:', token ? 'present' : 'missing');

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('[optionalVerifyToken] Decoded token:', decoded);
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      console.log('[optionalVerifyToken] Set userId:', req.userId, 'type:', typeof req.userId);
    } catch (error) {
      console.error('[optionalVerifyToken] Token verification failed:', error.message);
      // Token invalid, but continue as unauthenticated
      req.userId = null;
    }
  } else {
    console.log('[optionalVerifyToken] No token provided, setting userId to null');
    req.userId = null;
  }
  next();
};

// Public routes (with optional auth to check user's reaction)
router.get('/meme/:meme_id', optionalVerifyToken, reactionController.getMemeReactions);

// Protected routes
router.post('/', verifyToken, reactionController.addReaction);
router.delete('/:id', verifyToken, reactionController.deleteReaction);

module.exports = router;
