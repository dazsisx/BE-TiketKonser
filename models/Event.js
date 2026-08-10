const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  poster: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  artis_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'artis',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('buka', 'tutup'),
    defaultValue: 'buka',
  },
}, {
  tableName: 'events',
});

module.exports = Event;
