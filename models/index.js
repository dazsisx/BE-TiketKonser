const sequelize = require('../config/database');
const User = require('./User');
const Artis = require('./Artis');
const Event = require('./Event');
const KategoriTiket = require('./KategoriTiket');
const Pesanan = require('./Pesanan');

// ===== RELASI =====

// Artis -> Event (1 artis punya banyak event)
Artis.hasMany(Event, { foreignKey: 'artis_id', as: 'events' });
Event.belongsTo(Artis, { foreignKey: 'artis_id', as: 'artis' });

// Event -> KategoriTiket (1 event punya banyak kategori tiket)
Event.hasMany(KategoriTiket, { foreignKey: 'event_id', as: 'kategori_tiket' });
KategoriTiket.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// User -> Pesanan (1 user punya banyak pesanan)
User.hasMany(Pesanan, { foreignKey: 'user_id', as: 'pesanan' });
Pesanan.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Event -> Pesanan (1 event punya banyak pesanan)
Event.hasMany(Pesanan, { foreignKey: 'event_id', as: 'pesanan' });
Pesanan.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// KategoriTiket -> Pesanan (1 kategori punya banyak pesanan)
KategoriTiket.hasMany(Pesanan, { foreignKey: 'kategori_tiket_id', as: 'pesanan' });
Pesanan.belongsTo(KategoriTiket, { foreignKey: 'kategori_tiket_id', as: 'kategori_tiket' });

module.exports = {
  sequelize,
  User,
  Artis,
  Event,
  KategoriTiket,
  Pesanan,
};
