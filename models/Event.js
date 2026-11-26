const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { LABELS } = require('../utils/kategoriEvent');
const { MAX_LENGTH: KOTA_MAX } = require('../utils/kotaEvent');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nama_event: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Nama event tidak boleh kosong' },
    },
  },
  deskripsi: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tanggal: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { msg: 'Format tanggal tidak valid' },
      notEmpty: { msg: 'Tanggal tidak boleh kosong' },
    },
  },
  lokasi: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Lokasi tidak boleh kosong' },
    },
  },
  // Kota untuk filter lokasi di FE. NULL = belum diisi. Ditulis lewat normalizeKota (utils/kotaEvent.js).
  kota: {
    type: DataTypes.STRING(KOTA_MAX),
    allowNull: true,
    defaultValue: null,
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  banner: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  artist_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'artist_id',
    references: {
      model: 'artis',
      key: 'id',
    },
  },
  // Kunci denah venue di halaman pembelian (arena | stadium | theater | club).
  // NULL = FE menebak dari nama lokasi. Daftar nilai valid dicek di eventController.
  venue_layout: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
  },
  // Jenis event untuk halaman kategori. NULL = belum dikategorikan.
  kategori_event: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
    validate: {
      isIn: { args: [LABELS], msg: `Kategori event harus salah satu dari: ${LABELS.join(', ')}` },
    },
  },
  status: {
    type: DataTypes.ENUM('draft', 'aktif', 'ditutup', 'selesai'),
    defaultValue: 'aktif',
  },
}, {
  tableName: 'events',
  timestamps: false,
});

module.exports = Event;
