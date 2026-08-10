const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nama: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Nama tidak boleh kosong' },
      len: { args: [2, 100], msg: 'Nama minimal 2 karakter' },
    },
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: { msg: 'Email sudah terdaftar' },
    validate: {
      isEmail: { msg: 'Format email tidak valid' },
      notEmpty: { msg: 'Email tidak boleh kosong' },
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Password tidak boleh kosong' },
      len: { args: [6, 255], msg: 'Password minimal 6 karakter' },
    },
  },
  no_telepon: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('admin', 'pelanggan'),
    defaultValue: 'pelanggan',
  },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

// Method untuk cek password
User.prototype.cekPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
