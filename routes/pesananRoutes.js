const express = require('express');
const router = express.Router();
const {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
} = require('../controllers/pesananController');
const { protect, adminOnly, pelangganOnly } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

// GET /api/pesanan                    — semua pesanan (admin)
router.get('/', protect, adminOnly, getAllPesanan);

// GET /api/pesanan/riwayat            — riwayat pesanan pelanggan (pelanggan)
router.get('/riwayat', protect, pelangganOnly, getRiwayatPesanan);

// GET /api/pesanan/:id                — detail pesanan (pelanggan)
router.get('/:id', protect, pelangganOnly, getDetailPesanan);

// POST /api/pesanan                   — buat pesanan baru (pelanggan)
router.post('/', protect, pelangganOnly, buatPesanan);

// POST /api/pesanan/:id/bayar         — upload bukti bayar (pelanggan)
router.post(
  '/:id/bayar',
  protect,
  pelangganOnly,
  upload.single('bukti_bayar'),
  handleUploadError,
  uploadBuktiBayar
);

// PATCH /api/pesanan/:id/verifikasi   — verifikasi pembayaran (admin)
router.patch('/:id/verifikasi', protect, adminOnly, verifikasiPembayaran);

module.exports = router;
