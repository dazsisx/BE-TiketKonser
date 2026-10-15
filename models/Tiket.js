const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Satu baris = satu lembar tiket. Satu pesanan berjumlah N menghasilkan N baris.
// Status memakai STRING + validasi (bukan ENUM) supaya mudah ditambah tanpa ALTER TYPE.
const Tiket = sequelize.define('Tiket', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  pesanan_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pesanan', key: 'id' },
  },
  nomor_urut: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  kode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'aktif',
    validate: { isIn: [['aktif', 'terpakai', 'dibatalkan']] },
  },
  digunakan_pada: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  digunakan_oleh: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'tiket',
  indexes: [{ unique: true, fields: ['pesanan_id', 'nomor_urut'] }],
});

module.exports = Tiket;