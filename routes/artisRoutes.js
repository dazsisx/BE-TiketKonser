const express = require('express');
const router = express.Router();
const {
  getAllArtis,
  getArtisById,
  createArtis,
  updateArtis,
  deleteArtis,
} = require('../controllers/artisController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

// GET /api/artis              — semua artis (publik)
router.get('/', getAllArtis);

// GET /api/artis/:id          — detail artis (publik)
router.get('/:id', getArtisById);

// POST /api/artis             — tambah artis (admin)
router.post('/', protect, adminOnly, upload.single('foto'), handleUploadError, createArtis);

// PUT /api/artis/:id          — update artis (admin)
router.put('/:id', protect, adminOnly, upload.single('foto'), handleUploadError, updateArtis);

// DELETE /api/artis/:id       — hapus artis (admin)
router.delete('/:id', protect, adminOnly, deleteArtis);

module.exports = router;
