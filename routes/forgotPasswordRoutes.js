// routes/forgotPasswordRoutes.js
const express = require("express");
const router = express.Router();
const {
  forgotPassword,
  verifyResetOtp,
  resendResetOtp,
  resetPassword,
} = require("../controllers/forgotPasswordController");
const {
  forgotPasswordLimiter,
  verifyOtpLimiter,
} = require("../middleware/otpRateLimit");

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/verify-reset-otp", verifyOtpLimiter, verifyResetOtp);
router.post("/resend-reset-otp", forgotPasswordLimiter, resendResetOtp);
router.post("/reset-password", resetPassword);

module.exports = router;

// Di app.js / server.js kamu, daftarkan seperti ini
// (di samping route auth yang sudah ada):
//
//   const forgotPasswordRoutes = require("./routes/forgotPasswordRoutes");
//   app.use("/api/auth", forgotPasswordRoutes);