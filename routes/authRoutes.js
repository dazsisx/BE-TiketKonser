const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, uploadAvatar } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { avatarUpload, handleUploadError } = require('../middleware/uploadMiddleware');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/profile
router.get('/profile', protect, getProfile);

// PUT /api/auth/profile
router.put('/profile', protect, updateProfile);

// POST /api/auth/avatar
router.post('/avatar', protect, avatarUpload.single('avatar'), handleUploadError, uploadAvatar);

module.exports = router;
