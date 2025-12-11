const pool = require('../config/database');

// Add or update reaction
const addReaction = async (req, res, next) => {
  try {
    const userId = parseInt(req.userId, 10); // Convert to integer
    const { meme_id, reaction_type } = req.body;

    // Validation
    if (!meme_id || !reaction_type) {
      return res.status(400).json({ error: 'Meme ID and reaction type are required' });
    }

    const validReactions = ['laugh', 'robot', 'think'];
    if (!validReactions.includes(reaction_type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const connection = await pool.getConnection();

    // Check if meme exists
    const [memes] = await connection.query('SELECT id FROM memes WHERE id = ?', [meme_id]);
    if (memes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Meme not found' });
    }

    // Check if user already reacted
    const [existingReactions] = await connection.query(
      'SELECT id FROM reactions WHERE meme_id = ? AND user_id = ?',
      [meme_id, userId]
    );

    if (existingReactions.length > 0) {
      // Update existing reaction
      await connection.query(
        'UPDATE reactions SET reaction_type = ? WHERE meme_id = ? AND user_id = ?',
        [reaction_type, meme_id, userId]
      );
      connection.release();
      return res.json({ message: 'Reaction updated', reaction_type });
    }

    // Insert new reaction
    const [result] = await connection.query(
      'INSERT INTO reactions (meme_id, user_id, reaction_type) VALUES (?, ?, ?)',
      [meme_id, userId, reaction_type]
    );
    connection.release();

    res.status(201).json({
      message: 'Reaction added',
      id: result.insertId,
      meme_id,
      user_id: userId,
      reaction_type,
    });
  } catch (error) {
    next(error);
  }
};

// Delete reaction
const deleteReaction = async (req, res, next) => {
  try {
    const userId = parseInt(req.userId, 10); // Convert to integer
    const { id } = req.params;

    const connection = await pool.getConnection();

    // Check if user owns the reaction
    const [reactions] = await connection.query('SELECT user_id FROM reactions WHERE id = ?', [id]);
    if (reactions.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Reaction not found' });
    }

    if (reactions[0].user_id !== userId) {
      connection.release();
      return res.status(403).json({ error: 'You can only delete your own reactions' });
    }

    await connection.query('DELETE FROM reactions WHERE id = ?', [id]);
    connection.release();

    res.json({ message: 'Reaction deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get reactions for a meme
const getMemeReactions = async (req, res, next) => {
  try {
    const { meme_id } = req.params;
    const userId = req.userId; // Optional - null if not authenticated

    const connection = await pool.getConnection();
    const [reactions] = await connection.query(
      `SELECT r.*, u.username FROM reactions r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.meme_id = ? 
       ORDER BY r.created_at DESC`,
      [meme_id]
    );

    // Count reactions by type
    const reactionCounts = {
      laugh: 0,
      robot: 0,
      think: 0,
    };

    reactions.forEach((reaction) => {
      reactionCounts[reaction.reaction_type]++;
    });

    // Check if current user has reacted
    let userReaction = null;
    if (userId) {
      // Convert userId to integer to ensure proper comparison with database
      const userIdInt = parseInt(userId, 10);
      console.log(`[getMemeReactions] Checking reaction for meme ${meme_id}, userId: ${userId} (type: ${typeof userId}), userIdInt: ${userIdInt}`);

      const [userReactions] = await connection.query(
        'SELECT reaction_type FROM reactions WHERE meme_id = ? AND user_id = ?',
        [meme_id, userIdInt]
      );
      console.log(`[getMemeReactions] Found ${userReactions.length} reactions for user`);

      if (userReactions.length > 0) {
        userReaction = userReactions[0].reaction_type;
        console.log(`[getMemeReactions] User reaction: ${userReaction}`);
      }
    }

    connection.release();

    res.json({
      reactions,
      counts: reactionCounts,
      userReaction, // Which reaction type the current user has, or null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addReaction,
  deleteReaction,
  getMemeReactions,
};
