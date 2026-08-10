const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Artis = sequelize.define('Artis', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nama: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Nama artis tidak boleh kosong' },
    },
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  foto: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  genre: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'artis',
});

module.exports = Artis;
