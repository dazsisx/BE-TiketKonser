const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin;

const getSupabaseAdmin = () => {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !secretKey) return null;
  supabaseAdmin ??= createClient(
    process.env.SUPABASE_URL,
    secretKey
  );
  return supabaseAdmin;
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// @desc    Register pelanggan baru
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { nama, email, password, no_telepon } = req.body;

    // Validasi input wajib
    if (!nama || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama, email, dan password wajib diisi.',
      });
    }

    // Cek apakah email sudah terdaftar
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar.',
      });
    }

    const user = await User.create({
      nama,
      email,
      password,
      no_telepon: no_telepon || null,
      role: 'pelanggan',
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil.',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        token,
      },
    });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Login user (admin & pelanggan)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi.',
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    const isMatch = await user.cekPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Ambil profil user yang sedang login
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
};

// @desc    Update profil user
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { nama, no_telepon, password } = req.body;

    const user = await User.findByPk(req.user.id);

    if (nama) user.nama = nama;
    if (no_telepon) user.no_telepon = no_telepon;
    if (password) user.password = password;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        no_telepon: user.no_telepon,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File avatar wajib dipilih.' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Konfigurasi Supabase Storage belum lengkap.' });
    }

    const extension = req.file.originalname.split('.').pop().toLowerCase();
    const filePath = `${req.user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const user = await User.findByPk(req.user.id);
    user.avatar_url = data.publicUrl;
    await user.save({ hooks: false });

    return res.status(200).json({
      success: true,
      message: 'Avatar berhasil diperbarui.',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('uploadAvatar error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan avatar.' });
  }
};

module.exports = { register, login, getProfile, updateProfile, uploadAvatar };
