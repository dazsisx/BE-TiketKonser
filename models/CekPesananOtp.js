const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// OTP untuk "cek pesanan tanpa login". Terpisah dari PasswordResetOtp karena
// pembeli offline tidak punya akun (tidak ada user_id).
const CekPesananOtp = sequelize.define(
  'CekPesananOtp',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Kunci kontak yang dimasukkan pengunjung: "email:budi@mail.com" atau "tel:081234567890"
    kontak: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    // Email tujuan pengiriman OTP (untuk pencarian via nomor HP, diambil dari data pesanan)
    email_tujuan: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    otp_hash: {
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
  },
  {
    tableName: 'cek_pesanan_otp',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['kontak'] }],
  }
);

module.exports = CekPesananOtp;