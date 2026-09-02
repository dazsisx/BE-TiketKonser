// middleware/otpRateLimit.js
const rateLimit = require("express-rate-limit");

// Batasi permintaan OTP baru: maksimal 3x per 15 menit per IP+email.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit.",
  },
});

// Batasi percobaan verifikasi OTP: maksimal 10x per 15 menit per IP.
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan verifikasi. Coba lagi nanti.",
  },
});

module.exports = { forgotPasswordLimiter, verifyOtpLimiter };