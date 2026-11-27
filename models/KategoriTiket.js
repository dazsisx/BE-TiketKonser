const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');
const { AREA_KEYS } = require('../utils/areaTiket');

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
  // Area/zona kategori ini pada denah venue (lounge | pit | balkon | sayap | festival).
  // NULL = otomatis: FE menebak zona dari kata kunci pada nama_kelas. Satu area hanya boleh dipakai
  // satu kategori per event (indeks unik parsial di bawah).
  area: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
    validate: {
      isIn: { args: [AREA_KEYS], msg: `Area tiket harus salah satu dari: ${AREA_KEYS.join(', ')}` },
    },
  },
}, {
  tableName: 'kategori_tiket',
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'area'],
      where: { area: { [Op.ne]: null } },
      name: 'uq_kategori_tiket_event_area',
    },
  ],
});

// Virtual field: sisa kuota
KategoriTiket.prototype.getSisaKuota = function () {
  return this.kuota - this.terjual;
};

module.exports = KategoriTiket;
