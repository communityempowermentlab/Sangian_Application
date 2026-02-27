const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./src/routes/userRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Sangian Backend API is running');
});

module.exports = app;
