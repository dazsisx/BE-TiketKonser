// middleware/pembelianRateLimit.js
const rateLimit = require('express-rate-limit');

const { KODE_REGEX, normalisasiKode } = require('../utils/cekPembelian');

// Kode booking hanya 8 karakter hex, jadi percobaan tebak harus dibatasi.
// Hanya permintaan yang gagal (status >= 400) yang dihitung: maksimal 10x per 15 menit per IP.
const cekPembelianLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.',
  },
});

// Batas kedua per kode booking (bukan per IP), supaya penebak tidak lolos hanya dengan ganti IP.
// Permintaan dengan format kode tidak valid dilewati di sini (sudah dihitung limiter IP),
// supaya tidak semua kode tidak valid berbagi satu hitungan.
// Konsekuensi: orang lain bisa membuat satu kode terkunci sementara dengan sengaja salah menebak;
// karena itu batasnya lebih longgar (30 kegagalan per jam).
const cekPembelianKodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !KODE_REGEX.test(normalisasiKode(req.body && req.body.kode_tiket)),
  keyGenerator: (req) => `kode:${normalisasiKode(req.body && req.body.kode_tiket)}`,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat.',
  },
});

module.exports = { cekPembelianLimiter, cekPembelianKodeLimiter };