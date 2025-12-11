const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register
const register = async (req, res, next) => {
  try {
    const { username, email, password, location_lat, location_long } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into DB
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO users (username, email, password, location_lat, location_long) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, location_lat || null, location_long || null]
    );

    const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    const userId = users[0].id;
    connection.release();

    // Generate JWT
    const token = jwt.sign({ userId, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    });

    res.status(201).json({
      message: 'User registered successfully',
      id: userId,
      username,
      email,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Fetch user
    const connection = await pool.getConnection();
    const [users] = await connection.query('SELECT id, username, password FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      connection.release();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    });

    connection.release();

    res.json({
      message: 'Login successful',
      id: user.id,
      username: user.username,
      email,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Get Current User
const getMe = async (req, res, next) => {
  try {
    const userId = req.userId;

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, email, location_lat, location_long FROM users WHERE id = ?',
      [userId]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    next(error);
  }
};

// Update Location
const updateLocation = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { location_lat, location_long } = req.body;

    if (location_lat === undefined || location_long === undefined) {
      return res.status(400).json({ error: 'Location coordinates are required' });
    }

    const connection = await pool.getConnection();
    await connection.query('UPDATE users SET location_lat = ?, location_long = ? WHERE id = ?', [
      location_lat,
      location_long,
      userId,
    ]);
    connection.release();

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateLocation };
