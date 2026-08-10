require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/authRoutes');
const artisRoutes = require('./routes/artisRoutes');
const eventRoutes = require('./routes/eventRoutes');
const kategoriTiketRoutes = require('./routes/kategoriTiketRoutes');
const pesananRoutes = require('./routes/pesananRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE GLOBAL =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve folder uploads sebagai file statis
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/artis', artisRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/kategori-tiket', kategoriTiketRoutes);
app.use('/api/pesanan', pesananRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil.');

    // Sync tabel otomatis (alter: update kolom yang berubah tanpa hapus data)
    await sequelize.sync({ alter: true });
    console.log('✅ Sinkronisasi tabel selesai.');

    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Gagal koneksi ke database:', error.message);
    process.exit(1);
  }
};

startServer();
