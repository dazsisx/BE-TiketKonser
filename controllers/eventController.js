const { Event, Artis, KategoriTiket, Pesanan } = require('../models');
const fs = require('fs');

// @desc    Ambil semua event
// @route   GET /api/event
// @access  Public
const getAllEvent = async (req, res) => {
  try {
    const events = await Event.findAll({
      include: [
        { model: Artis, as: 'artis', attributes: ['id', 'nama', 'foto', 'genre'] },
        { model: KategoriTiket, as: 'kategori_tiket' },
      ],
      order: [['tanggal', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      total: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Ambil detail satu event
// @route   GET /api/event/:id
// @access  Public
const getEventById = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      include: [
        { model: Artis, as: 'artis' },
        { model: KategoriTiket, as: 'kategori_tiket' },
      ],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    // Tambahkan info sisa kuota di setiap kategori
    const eventData = event.toJSON();
    eventData.kategori_tiket = eventData.kategori_tiket.map((k) => ({
      ...k,
      sisa_kuota: k.kuota - k.terjual,
    }));

    return res.status(200).json({
      success: true,
      data: eventData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Tambah event baru
// @route   POST /api/event
// @access  Admin
const createEvent = async (req, res) => {
  try {
    const { nama_event, deskripsi, tanggal, lokasi, artis_id } = req.body;

    if (!nama_event || !tanggal || !lokasi || !artis_id) {
      return res.status(400).json({
        success: false,
        message: 'Nama event, tanggal, lokasi, dan artis_id wajib diisi.',
      });
    }

    // Cek artis ada
    const artis = await Artis.findByPk(artis_id);
    if (!artis) {
      return res.status(404).json({
        success: false,
        message: 'Artis tidak ditemukan.',
      });
    }

    const event = await Event.create({
      nama_event,
      deskripsi: deskripsi || null,
      tanggal,
      lokasi,
      artis_id,
      poster: req.file ? req.file.path : null,
      status: 'buka',
    });

    return res.status(201).json({
      success: true,
      message: 'Event berhasil ditambahkan.',
      data: event,
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

// @desc    Update event
// @route   PUT /api/event/:id
// @access  Admin
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    const { nama_event, deskripsi, tanggal, lokasi, artis_id, status } = req.body;

    // Hapus poster lama jika ada poster baru
    if (req.file && event.poster) {
      if (fs.existsSync(event.poster)) {
        fs.unlinkSync(event.poster);
      }
    }

    await event.update({
      nama_event: nama_event || event.nama_event,
      deskripsi: deskripsi !== undefined ? deskripsi : event.deskripsi,
      tanggal: tanggal || event.tanggal,
      lokasi: lokasi || event.lokasi,
      artis_id: artis_id || event.artis_id,
      poster: req.file ? req.file.path : event.poster,
      status: status || event.status,
    });

    return res.status(200).json({
      success: true,
      message: 'Event berhasil diperbarui.',
      data: event,
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

// @desc    Hapus event
// @route   DELETE /api/event/:id
// @access  Admin
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    // Hapus poster jika ada
    if (event.poster && fs.existsSync(event.poster)) {
      fs.unlinkSync(event.poster);
    }

    await event.destroy();

    return res.status(200).json({
      success: true,
      message: 'Event berhasil dihapus.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Tutup penjualan tiket suatu event
// @route   PATCH /api/event/:id/tutup
// @access  Admin
const tutupEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    await event.update({ status: 'tutup' });

    return res.status(200).json({
      success: true,
      message: 'Penjualan tiket event berhasil ditutup.',
      data: event,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Buka kembali penjualan tiket suatu event
// @route   PATCH /api/event/:id/buka
// @access  Admin
const bukaEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    await event.update({ status: 'buka' });

    return res.status(200).json({
      success: true,
      message: 'Penjualan tiket event berhasil dibuka.',
      data: event,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

module.exports = {
  getAllEvent,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  tutupEvent,
  bukaEvent,
};
