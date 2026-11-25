const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Satu baris = satu event yang disimpan seorang pelanggan ke wishlist.
// Pasangan (user_id, event_id) unik, jadi menambah event yang sama dua kali tidak membuat baris ganda.
const Wishlist = sequelize.define('Wishlist', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'events', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'wishlist',
  indexes: [
    { unique: true, fields: ['user_id', 'event_id'], name: 'wishlist_user_event_unique' },
    { fields: ['event_id'], name: 'wishlist_event_id_idx' },
  ],
});

module.exports = Wishlist;
