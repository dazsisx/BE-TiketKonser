// utils/otp.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  // Angka acak 6 digit yang aman secara kriptografis (bukan Math.random).
  const max = 10 ** OTP_LENGTH;
  const otp = crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
  return otp;
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

function getExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

module.exports = {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS,
  generateOtp,
  generateResetToken,
  hashOtp,
  compareOtp,
  getExpiryDate,
};