const express = require('express');
const router = express.Router();
const {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
  kirimOtpCekPembelian,
  verifikasiOtpCekPembelian,
  midtransNotification,
} = require('../controllers/pesananController');
const { protect, adminOnly, pelangganOnly } = require('../middleware/authMiddleware');
const { upload, uploadToCloudinary, handleUploadError } = require('../middleware/uploadMiddleware');
const {
  kirimOtpIpLimiter,
  kirimOtpKontakLimiter,
  verifikasiOtpLimiter,
} = require('../middleware/pembelianRateLimit');

// POST /api/pesanan/cek/kirim-otp     — kirim kode OTP ke email pembeli (tanpa login)
router.post('/cek/kirim-otp', kirimOtpIpLimiter, kirimOtpKontakLimiter, kirimOtpCekPembelian);

// POST /api/pesanan/cek/verifikasi    — verifikasi OTP, lalu kembalikan daftar pesanan (tanpa login)
router.post('/cek/verifikasi', verifikasiOtpLimiter, verifikasiOtpCekPembelian);

// POST /api/pesanan/webhook/midtrans — notifikasi pembayaran gateway
router.post('/webhook/midtrans', midtransNotification);

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
  uploadToCloudinary,
  uploadBuktiBayar
);

// PATCH /api/pesanan/:id/verifikasi   — verifikasi pembayaran (admin)
router.patch('/:id/verifikasi', protect, adminOnly, verifikasiPembayaran);

module.exports = router;