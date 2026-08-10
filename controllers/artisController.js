const { Artis, Event } = require('../models');
const fs = require('fs');

// @desc    Ambil semua artis
// @route   GET /api/artis
// @access  Public
const getAllArtis = async (req, res) => {
  try {
    const artis = await Artis.findAll({
      order: [['nama', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      total: artis.length,
      data: artis,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Ambil detail satu artis
// @route   GET /api/artis/:id
// @access  Public
const getArtisById = async (req, res) => {
  try {
    const artis = await Artis.findByPk(req.params.id, {
      include: [{ model: Event, as: 'events' }],
    });

    if (!artis) {
      return res.status(404).json({
        success: false,
        message: 'Artis tidak ditemukan.',
      });
    }

    return res.status(200).json({
      success: true,
      data: artis,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Tambah artis baru
// @route   POST /api/artis
// @access  Admin
const createArtis = async (req, res) => {
  try {
    const { nama, bio, genre } = req.body;

    if (!nama) {
      return res.status(400).json({
        success: false,
        message: 'Nama artis wajib diisi.',
      });
    }

    const artis = await Artis.create({
      nama,
      bio: bio || null,
      genre: genre || null,
      foto: req.file ? req.file.path : null,
    });

    return res.status(201).json({
      success: true,
      message: 'Artis berhasil ditambahkan.',
      data: artis,
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

// @desc    Update artis
// @route   PUT /api/artis/:id
// @access  Admin
const updateArtis = async (req, res) => {
  try {
    const artis = await Artis.findByPk(req.params.id);

    if (!artis) {
      return res.status(404).json({
        success: false,
        message: 'Artis tidak ditemukan.',
      });
    }

    const { nama, bio, genre } = req.body;

    // Hapus foto lama kalau ada foto baru
    if (req.file && artis.foto) {
      if (fs.existsSync(artis.foto)) {
        fs.unlinkSync(artis.foto);
      }
    }

    await artis.update({
      nama: nama || artis.nama,
      bio: bio !== undefined ? bio : artis.bio,
      genre: genre !== undefined ? genre : artis.genre,
      foto: req.file ? req.file.path : artis.foto,
    });

    return res.status(200).json({
      success: true,
      message: 'Artis berhasil diperbarui.',
      data: artis,
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

// @desc    Hapus artis
// @route   DELETE /api/artis/:id
// @access  Admin
const deleteArtis = async (req, res) => {
  try {
    const artis = await Artis.findByPk(req.params.id);

    if (!artis) {
      return res.status(404).json({
        success: false,
        message: 'Artis tidak ditemukan.',
      });
    }

    // Hapus foto jika ada
    if (artis.foto && fs.existsSync(artis.foto)) {
      fs.unlinkSync(artis.foto);
    }

    await artis.destroy();

    return res.status(200).json({
      success: true,
      message: 'Artis berhasil dihapus.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

module.exports = { getAllArtis, getArtisById, createArtis, updateArtis, deleteArtis };
