const pool = require('../config/database');

// Get all memes with filters
const getMemes = async (req, res, next) => {
  try {
    const { category, search, sort, limit = 10, offset = 0 } = req.query;

    let query = 'SELECT m.*, u.username, COUNT(r.id) as reactions_count FROM memes m LEFT JOIN users u ON m.uploader_id = u.id LEFT JOIN reactions r ON m.id = r.meme_id';
    const params = [];

    // Filters
    const filters = [];
    if (category) {
      filters.push('m.category = ?');
      params.push(category);
    }

    if (search) {
      filters.push('(LOWER(m.title) LIKE LOWER(?) OR LOWER(m.caption) LIKE LOWER(?))');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (filters.length > 0) {
      query += ' WHERE ' + filters.join(' AND ');
    }

    query += ' GROUP BY m.id';

    // Sorting
    if (sort === 'trending') {
      query += ' ORDER BY reactions_count DESC';
    } else {
      query += ' ORDER BY m.created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const connection = await pool.getConnection();
    const [memes] = await connection.query(query, params);
    connection.release();

    res.json({ memes });
  } catch (error) {
    next(error);
  }
};

// Get trending memes
const getTrendingMemes = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;

    const connection = await pool.getConnection();
    const [memes] = await connection.query(
      `SELECT m.*, u.username, COUNT(r.id) as reactions_count 
       FROM memes m 
       LEFT JOIN users u ON m.uploader_id = u.id 
       LEFT JOIN reactions r ON m.id = r.meme_id 
       GROUP BY m.id 
       ORDER BY reactions_count DESC 
       LIMIT ?`,
      [parseInt(limit)]
    );
    connection.release();

    res.json({ memes });
  } catch (error) {
    next(error);
  }
};

// Get user's own memes
const getMyMemes = async (req, res, next) => {
  try {
    const userId = req.userId;

    const connection = await pool.getConnection();
    const [memes] = await connection.query(
      `SELECT m.*, u.username, COUNT(r.id) as reactions_count 
       FROM memes m 
       LEFT JOIN users u ON m.uploader_id = u.id 
       LEFT JOIN reactions r ON m.id = r.meme_id 
       WHERE m.uploader_id = ? 
       GROUP BY m.id 
       ORDER BY m.created_at DESC`,
      [userId]
    );
    connection.release();

    res.json({ memes });
  } catch (error) {
    next(error);
  }
};

// Get single meme with reactions
const getSingleMeme = async (req, res, next) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    const [memes] = await connection.query(
      `SELECT m.*, u.username, COUNT(r.id) as reactions_count 
       FROM memes m 
       LEFT JOIN users u ON m.uploader_id = u.id 
       LEFT JOIN reactions r ON m.id = r.meme_id 
       WHERE m.id = ? 
       GROUP BY m.id`,
      [id]
    );

    if (memes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Meme not found' });
    }

    // Get all reactions for this meme
    const [reactions] = await connection.query(
      `SELECT r.*, u.username FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.meme_id = ?`,
      [id]
    );
    connection.release();

    const meme = memes[0];
    meme.reactions = reactions;

    res.json(meme);
  } catch (error) {
    next(error);
  }
};

// Upload meme
const uploadMeme = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { title, caption, category } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;

    // Validation
    if (!title || !caption || !category || !imageUrl) {
      return res.status(400).json({ error: 'Title, caption, category, and image are required' });
    }

    if (caption.length > 140) {
      return res.status(400).json({ error: 'Caption must be 140 characters or less' });
    }

    const validCategories = ['AI', 'Grok', 'xAI', 'Futuristic'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO memes (title, caption, image_url, category, uploader_id) VALUES (?, ?, ?, ?, ?)',
      [title, caption, imageUrl, category, userId]
    );
    connection.release();

    res.status(201).json({
      message: 'Meme uploaded successfully',
      id: result.insertId,
      title,
      caption,
      image_url: imageUrl,
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Update meme
const updateMeme = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, caption, category } = req.body;

    // Validation
    if (!title || !caption || !category) {
      return res.status(400).json({ error: 'Title, caption, and category are required' });
    }

    if (caption.length > 140) {
      return res.status(400).json({ error: 'Caption must be 140 characters or less' });
    }

    const connection = await pool.getConnection();

    // Check if user owns the meme
    const [memes] = await connection.query('SELECT uploader_id FROM memes WHERE id = ?', [id]);
    if (memes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Meme not found' });
    }

    if (memes[0].uploader_id !== userId) {
      connection.release();
      return res.status(403).json({ error: 'You can only edit your own memes' });
    }

    await connection.query('UPDATE memes SET title = ?, caption = ?, category = ? WHERE id = ?', [
      title,
      caption,
      category,
      id,
    ]);
    connection.release();

    res.json({ message: 'Meme updated successfully' });
  } catch (error) {
    next(error);
  }
};

// Delete meme
const deleteMeme = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const connection = await pool.getConnection();

    // Check if user owns the meme
    const [memes] = await connection.query('SELECT uploader_id FROM memes WHERE id = ?', [id]);
    if (memes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Meme not found' });
    }

    if (memes[0].uploader_id !== userId) {
      connection.release();
      return res.status(403).json({ error: 'You can only delete your own memes' });
    }

    await connection.query('DELETE FROM memes WHERE id = ?', [id]);
    connection.release();

    res.json({ message: 'Meme deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMemes,
  getTrendingMemes,
  getMyMemes,
  getSingleMeme,
  uploadMeme,
  updateMeme,
  deleteMeme,
};
