const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./backend/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security & Caching Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA Fallback Catch-all
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Job Booking App running at http://localhost:${PORT}`);
  console.log(` Owner account: osanyintuyimofeoluwa@gmail.com`);
  console.log(`====================================================`);
});
