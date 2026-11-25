const express = require('express');
const router = express.Router();
const {
  getWishlist,
  getWishlistIds,
  tambahWishlist,
  hapusWishlist,
} = require('../controllers/wishlistController');
const { protect, pelangganOnly } = require('../middleware/authMiddleware');

// GET    /api/wishlist            — daftar wishlist lengkap dengan data event (pelanggan)
router.get('/', protect, pelangganOnly, getWishlist);

// GET    /api/wishlist/ids        — hanya id event yang disimpan (pelanggan)
router.get('/ids', protect, pelangganOnly, getWishlistIds);

// POST   /api/wishlist            — tambah event { event_id } (pelanggan)
router.post('/', protect, pelangganOnly, tambahWishlist);

// DELETE /api/wishlist/:eventId   — hapus event dari wishlist (pelanggan)
router.delete('/:eventId', protect, pelangganOnly, hapusWishlist);

module.exports = router;
