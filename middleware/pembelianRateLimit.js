const rateLimit = require('express-rate-limit');
const { normalisasiEmail, normalisasiTelepon } = require('../utils/cekPembelian');

const kontakKey = (req) => {
  const body = req.body || {};
  const email = normalisasiEmail(body.email);
  if (email) return `email:${email}`;
  const tel = normalisasiTelepon(body.no_telepon);
  return tel ? `tel:${tel}` : 'kosong';
};

// Kirim OTP: maks 5x / 15 menit per IP
const kirimOtpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan kode. Coba lagi dalam beberapa menit.' },
});

// Kirim OTP: maks 3x / 15 menit per email/nomor, supaya email orang lain tidak dibanjiri OTP
const kirimOtpKontakLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `kirim:${kontakKey(req)}`,
  message: { success: false, message: 'Terlalu banyak permintaan kode. Coba lagi dalam beberapa menit.' },
});

// Verifikasi: hanya percobaan gagal yang dihitung, maks 10x / 15 menit per IP
const verifikasiOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' },
});

module.exports = { kirimOtpIpLimiter, kirimOtpKontakLimiter, verifikasiOtpLimiter };