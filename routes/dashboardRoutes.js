const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/dashboard    — statistik dashboard (admin)
router.get('/', protect, adminOnly, getDashboard);

module.exports = router;
