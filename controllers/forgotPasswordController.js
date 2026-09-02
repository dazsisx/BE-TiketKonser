// controllers/forgotPasswordController.js
//
// Catatan: model User sudah punya hook beforeUpdate yang otomatis
// hash password (pakai bcryptjs) setiap kali field `password` berubah,
// jadi di sini kita cukup kirim password polos ke user.update() —
// JANGAN di-hash manual di sini, nanti double-hash.

const { User, PasswordResetOtp } = require("../models");
const { sendOtpEmail } = require("../services/emailService");
const {
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS,
  generateOtp,
  generateResetToken,
  hashOtp,
  compareOtp,
  getExpiryDate,
} = require("../utils/otp");

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Format email tidak valid." });
    }

    const user = await User.findOne({ where: { email } });

    // Selalu balas sukses walau email tidak ditemukan, supaya endpoint
    // ini tidak bisa dipakai untuk menebak email yang terdaftar.
    if (!user) {
      return res.json({
        success: true,
        message: "Jika email terdaftar, kode OTP telah dikirim.",
      });
    }

    // Nonaktifkan OTP lama yang belum dipakai untuk user ini.
    await PasswordResetOtp.update(
      { is_used: true },
      { where: { user_id: user.id, is_used: false } }
    );

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await PasswordResetOtp.create({
      user_id: user.id,
      email: user.email,
      otp_hash: otpHash,
      expires_at: getExpiryDate(),
      attempts: 0,
      is_used: false,
    });

    await sendOtpEmail({
      to: user.email,
      otp,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    return res.json({
      success: true,
      message: "Jika email terdaftar, kode OTP telah dikirim.",
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server." });
  }
}

// POST /api/auth/verify-reset-otp
async function verifyResetOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email dan kode OTP wajib diisi." });
    }

    const record = await PasswordResetOtp.findOne({
      where: { email, is_used: false },
      order: [["created_at", "DESC"]],
    });

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: "Kode OTP tidak valid atau sudah kedaluwarsa." });
    }

    if (new Date() > record.expires_at) {
      return res
        .status(400)
        .json({ success: false, message: "Kode OTP sudah kedaluwarsa." });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Terlalu banyak percobaan. Minta kode OTP baru.",
      });
    }

    const isMatch = await compareOtp(otp, record.otp_hash);

    if (!isMatch) {
      await record.increment("attempts");
      return res
        .status(400)
        .json({ success: false, message: "Kode OTP tidak valid." });
    }

    const resetToken = generateResetToken();
    await record.update({ is_used: true, reset_token: resetToken });

    return res.json({
      success: true,
      message: "Kode OTP berhasil diverifikasi.",
      data: { resetToken },
    });
  } catch (err) {
    console.error("verifyResetOtp error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server." });
  }
}

// POST /api/auth/resend-reset-otp
async function resendResetOtp(req, res) {
  // Menggunakan logika yang sama seperti forgotPassword.
  return forgotPassword(req, res);
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { email, resetToken, password } = req.body;

    if (!email || !resetToken || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Data tidak lengkap." });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Kata sandi minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.",
      });
    }

    const record = await PasswordResetOtp.findOne({
      where: { email, is_used: true, reset_token: resetToken },
      order: [["created_at", "DESC"]],
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Sesi reset password tidak valid. Ulangi proses dari awal.",
      });
    }

    if (new Date() > record.expires_at) {
      return res
        .status(400)
        .json({ success: false, message: "Sesi reset password sudah kedaluwarsa." });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Akun tidak ditemukan." });
    }

    // Kirim password polos — hook beforeUpdate di model User yang
    // akan hash otomatis pakai bcryptjs.
    await user.update({ password });

    // Cabut token supaya tidak bisa dipakai ulang.
    await record.update({ reset_token: null });

    return res.json({
      success: true,
      message:
        "Kata sandi berhasil diatur ulang. Kamu sekarang bisa masuk dengan kata sandi baru.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server." });
  }
}

module.exports = {
  forgotPassword,
  verifyResetOtp,
  resendResetOtp,
  resetPassword,
};