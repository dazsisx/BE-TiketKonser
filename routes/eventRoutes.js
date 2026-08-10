const express = require('express');
const router = express.Router();
const {
  getAllEvent,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  tutupEvent,
  bukaEvent,
} = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

// GET /api/event              — semua event (publik)
router.get('/', getAllEvent);

// GET /api/event/:id          — detail event (publik)
router.get('/:id', getEventById);

// POST /api/event             — tambah event (admin)
router.post('/', protect, adminOnly, upload.single('poster'), handleUploadError, createEvent);

// PUT /api/event/:id          — update event (admin)
router.put('/:id', protect, adminOnly, upload.single('poster'), handleUploadError, updateEvent);

// DELETE /api/event/:id       — hapus event (admin)
router.delete('/:id', protect, adminOnly, deleteEvent);

// PATCH /api/event/:id/tutup  — tutup penjualan tiket (admin)
router.patch('/:id/tutup', protect, adminOnly, tutupEvent);

// PATCH /api/event/:id/buka   — buka kembali penjualan tiket (admin)
router.patch('/:id/buka', protect, adminOnly, bukaEvent);

module.exports = router;
