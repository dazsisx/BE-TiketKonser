const express = require('express');
const router = express.Router();
const {
  getKategoriByEvent,
  createKategori,
  updateKategori,
  deleteKategori,
} = require('../controllers/kategoriTiketController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/kategori-tiket/event/:eventId   — kategori tiket berdasarkan event (publik)
router.get('/event/:eventId', getKategoriByEvent);

// POST /api/kategori-tiket                 — tambah kategori tiket (admin)
router.post('/', protect, adminOnly, createKategori);

// PUT /api/kategori-tiket/:id              — update kategori tiket (admin)
router.put('/:id', protect, adminOnly, updateKategori);

// DELETE /api/kategori-tiket/:id           — hapus kategori tiket (admin)
router.delete('/:id', protect, adminOnly, deleteKategori);

module.exports = router;
