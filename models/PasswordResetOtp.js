const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordResetOtp = sequelize.define(
  'PasswordResetOtp',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    otp_hash: {
      // Simpan hash-nya, bukan OTP mentah, sama seperti password.
      type: DataTypes.STRING,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reset_token: {
      // Token sekali pakai setelah OTP terverifikasi, dipakai untuk
      // mengesahkan request ke /reset-password.
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'password_reset_otps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = PasswordResetOtp;