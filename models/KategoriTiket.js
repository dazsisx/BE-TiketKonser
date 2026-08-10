const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KategoriTiket = sequelize.define('KategoriTiket', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id',
    },
  },
  nama_kelas: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Nama kelas tidak boleh kosong' },
    },
  },
  harga: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      isDecimal: { msg: 'Harga harus berupa angka' },
      min: { args: [0], msg: 'Harga tidak boleh negatif' },
    },
  },
  kuota: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isInt: { msg: 'Kuota harus berupa angka bulat' },
      min: { args: [1], msg: 'Kuota minimal 1' },
    },
  },
  terjual: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'kategori_tiket',
});

// Virtual field: sisa kuota
KategoriTiket.prototype.getSisaKuota = function () {
  return this.kuota - this.terjual;
};

module.exports = KategoriTiket;
