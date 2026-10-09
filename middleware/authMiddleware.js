const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Daftar role yang valid di sistem
const ROLES = {
  ADMIN: 'admin',
  ADMIN_OFFLINE: 'admin_offline',
  PELANGGAN: 'pelanggan',
};

// Middleware: cek apakah user sudah login (ada JWT valid)
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Silakan login terlebih dahulu.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid. User tidak ditemukan.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token sudah kadaluarsa. Silakan login ulang.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

// Middleware generik: izinkan satu atau lebih role.
// Contoh: router.post('/offline', protect, authorize('admin', 'admin_offline'), handler)
// Role dibaca dari database (lewat protect), bukan dari isi JWT,
// jadi perubahan role langsung berlaku tanpa menunggu token kadaluarsa.
const authorize = (...allowedRoles) => (req, res, next) => {
  if (req.user && allowedRoles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.',
  });
};

// cek apakah user adalah admin (full admin saja)
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === ROLES.ADMIN) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak. Hanya admin yang diizinkan.',
  });
};

// cek apakah user adalah pelanggan
const pelangganOnly = (req, res, next) => {
  if (req.user && req.user.role === ROLES.PELANGGAN) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak. Hanya pelanggan yang diizinkan.',
  });
};

module.exports = { protect, authorize, adminOnly, pelangganOnly, ROLES };