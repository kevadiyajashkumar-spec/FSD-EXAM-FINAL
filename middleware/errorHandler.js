const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'Duplicate entry. Username or email already exists.' });
  }

  if (err.message.includes('validation')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
