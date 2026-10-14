const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT, toPublicPath } = require('../utils/uploadPaths');

// Tentukan folder tujuan (absolut, di bawah UPLOAD_ROOT) berdasarkan base URL route
// (menggantikan folder Cloudinary tiket-konser/artis, /event, /bukti_bayar)
const getUploadFolder = (req) => {
  if (req.baseUrl.includes('artis')) return path.join(UPLOAD_ROOT, 'artis');
  if (req.baseUrl.includes('event')) return path.join(UPLOAD_ROOT, 'event');
  if (req.baseUrl.includes('pesanan')) return path.join(UPLOAD_ROOT, 'bukti_bayar');
  return path.join(UPLOAD_ROOT, 'lainnya');
};

// Simpan langsung ke disk, per-folder sesuai route
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = getUploadFolder(req);
    fs.mkdirSync(folder, { recursive: true }); // auto-create kalau belum ada
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter hanya file gambar
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const isExtValid = allowedTypes.test(file.originalname.toLowerCase());
  const isMimeValid = allowedTypes.test(file.mimetype);

  if (isExtValid && isMimeValid) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diizinkan (jpeg, jpg, png, gif, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maksimal 5MB
  },
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/**
 * Middleware setelah multer: timpa req.file.path (path absolut lokal)
 * jadi path publik yang bisa diakses via express.static.
 * Controller yang baca req.file.path tidak perlu diubah.
 * (Nama `uploadToCloudinary` dipertahankan agar route tidak berubah.)
 */
const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();

  req.file.path = toPublicPath(req.file.path); // contoh: /uploads/artis/172xxx-123.jpg

  next();
};

// Error handler untuk multer (tidak berubah)
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Ukuran file terlalu besar. Maksimal 5MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

module.exports = { upload, avatarUpload, uploadToCloudinary, handleUploadError };