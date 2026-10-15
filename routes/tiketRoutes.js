const express = require('express');
const router = express.Router();
const { validasiTiket } = require('../controllers/tiketController');
const { protect, authorize, ROLES } = require('../middleware/authMiddleware');

// Hanya petugas yang boleh memvalidasi tiket (role dibaca dari database lewat `protect`)
router.post('/validasi', protect, authorize(ROLES.ADMIN, ROLES.ADMIN_OFFLINE), validasiTiket);

module.exports = router;