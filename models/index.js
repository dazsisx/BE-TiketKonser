const sequelize = require('../config/database');
const User = require('./User');
const Artis = require('./Artis');
const Event = require('./Event');
const KategoriTiket = require('./KategoriTiket');
const Pesanan = require('./Pesanan');
const PasswordResetOtp = require('./PasswordResetOtp');
const Tiket = require('./Tiket');

// ===== RELASI =====

// Artis -> Event (1 artis punya banyak event)
Artis.hasMany(Event, { foreignKey: 'artist_id', as: 'events' });
Event.belongsTo(Artis, { foreignKey: 'artist_id', as: 'artis' });

// Event -> KategoriTiket (1 event punya banyak kategori tiket)
Event.hasMany(KategoriTiket, { foreignKey: 'event_id', as: 'kategori_tiket' });
KategoriTiket.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// User -> Pesanan (1 user punya banyak pesanan)
User.hasMany(Pesanan, { foreignKey: 'user_id', as: 'pesanan' });
Pesanan.belongsTo(User, { foreignKey: 'dibuat_oleh', as: 'petugas' });
Pesanan.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Event -> Pesanan (1 event punya banyak pesanan)
Event.hasMany(Pesanan, { foreignKey: 'event_id', as: 'pesanan' });
Pesanan.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// KategoriTiket -> Pesanan (1 kategori punya banyak pesanan)
KategoriTiket.hasMany(Pesanan, { foreignKey: 'kategori_tiket_id', as: 'pesanan' });
Pesanan.belongsTo(KategoriTiket, { foreignKey: 'kategori_tiket_id', as: 'kategori_tiket' });

// Pesanan -> Tiket (1 pesanan punya N tiket, masing-masing dengan QR sendiri)
Pesanan.hasMany(Tiket, { foreignKey: 'pesanan_id', as: 'tiket' });
Tiket.belongsTo(Pesanan, { foreignKey: 'pesanan_id', as: 'pesanan' });
Tiket.belongsTo(User, { foreignKey: 'digunakan_oleh', as: 'petugas_scan' });

// User -> PasswordResetOtp (1 user punya banyak riwayat OTP reset password)
User.hasMany(PasswordResetOtp, { foreignKey: 'user_id', as: 'password_reset_otps' });
PasswordResetOtp.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Artis,
  Event,
  KategoriTiket,
  Pesanan,
  Tiket,
  PasswordResetOtp,
};