const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pesanan = sequelize.define('Pesanan', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id',
    },
  },
  kategori_tiket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'kategori_tiket',
      key: 'id',
    },
  },
  jumlah: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: { args: [1], msg: 'Jumlah tiket minimal 1' },
      max: { args: [5], msg: 'Maksimal pembelian 5 tiket' },
    },
  },
  total_harga: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  status_bayar: {
    type: DataTypes.ENUM('pending', 'lunas', 'ditolak', 'kadaluarsa'),
    defaultValue: 'pending',
  },
  bukti_bayar: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  kode_tiket: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
  },
  qr_code: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  catatan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // ===== Penjualan offline =====
  order_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'online',
    validate: {
      isIn: { args: [['online', 'offline']], msg: 'order_type tidak valid' },
    },
  },
  nama_pembeli: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  no_telepon_pembeli: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  email_pembeli: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  // Petugas (admin / admin_offline) yang mencatat transaksi offline
  dibuat_oleh: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'pesanan',
});

module.exports = Pesanan;