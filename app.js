require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const { UPLOAD_ROOT, PUBLIC_PREFIX } = require('./utils/uploadPaths');

// Import routes
const authRoutes = require('./routes/authRoutes');
const artisRoutes = require('./routes/artisRoutes');
const eventRoutes = require('./routes/eventRoutes');
const kategoriTiketRoutes = require('./routes/kategoriTiketRoutes');
const pesananRoutes = require('./routes/pesananRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const forgotPasswordRoutes = require('./routes/forgotPasswordRoutes');
const offlineRoutes = require('./routes/offlineRoutes');
const tiketRoutes = require('./routes/tiketRoutes');
const { assertQrSecret } = require('./services/tiketService');

const app = express();
const PORT = process.env.PORT || 5000;

// Jumlah proxy tepercaya di depan aplikasi (angka). Kosongkan jika aplikasi diakses langsung.
// Jangan diisi `true` dan jangan melebihi jumlah proxy yang sebenarnya, karena IP pengunjung
// bisa dipalsukan lewat header X-Forwarded-For dan rate limiter jadi mudah dilewati.
if (process.env.TRUST_PROXY) {
  const hop = Number(process.env.TRUST_PROXY);
  if (!Number.isInteger(hop) || hop < 1) {
    throw new Error('TRUST_PROXY harus berupa bilangan bulat >= 1 (jumlah proxy tepercaya).');
  }
  app.set('trust proxy', hop);
}

// ===== MIDDLEWARE GLOBAL =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve folder uploads sebagai file statis
app.use(PUBLIC_PREFIX, express.static(UPLOAD_ROOT));

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/auth', forgotPasswordRoutes); // /forgot-password, /verify-reset-otp, /resend-reset-otp, /reset-password
app.use('/api/artis', artisRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/kategori-tiket', kategoriTiketRoutes);
app.use('/api/pesanan', pesananRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/offline', offlineRoutes);
app.use('/api/tiket', tiketRoutes);

// Route default
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API Tiket Konser berjalan!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      artis: '/api/artis',
      event: '/api/event',
      kategori_tiket: '/api/kategori-tiket',
      pesanan: '/api/pesanan',
      dashboard: '/api/dashboard',
    },
  });
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ===== ERROR HANDLER GLOBAL =====
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

// ===== KONEKSI DATABASE & JALANKAN SERVER =====
const startServer = async () => {
    // Gagal cepat jika QR_SECRET belum diatur, sebelum menyentuh database
  try {
    assertQrSecret();
  } catch (error) {
    console.error('❌ Konfigurasi tidak valid:', error.message);
    process.exit(1);
  }
  
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil.');

    // Set DB_SYNC_ALTER=true only when intentionally updating an existing schema.
    await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });
    console.log('✅ Database siap digunakan.');

    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Gagal koneksi ke database:', error.message);
    process.exit(1);
  }
};

startServer();