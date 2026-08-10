const { KategoriTiket, Event } = require('../models');

// @desc    Ambil semua kategori tiket berdasarkan event
// @route   GET /api/kategori-tiket/event/:eventId
// @access  Public
const getKategoriByEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    const kategori = await KategoriTiket.findAll({
      where: { event_id: req.params.eventId },
      order: [['harga', 'ASC']],
    });

    const result = kategori.map((k) => ({
      ...k.toJSON(),
      sisa_kuota: k.kuota - k.terjual,
    }));

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Tambah kategori tiket untuk suatu event
// @route   POST /api/kategori-tiket
// @access  Admin
const createKategori = async (req, res) => {
  try {
    const { event_id, nama_kelas, harga, kuota } = req.body;

    if (!event_id || !nama_kelas || harga === undefined || !kuota) {
      return res.status(400).json({
        success: false,
        message: 'event_id, nama_kelas, harga, dan kuota wajib diisi.',
      });
    }

    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    const kategori = await KategoriTiket.create({
      event_id,
      nama_kelas,
      harga,
      kuota,
      terjual: 0,
    });

    return res.status(201).json({
      success: true,
      message: 'Kategori tiket berhasil ditambahkan.',
      data: {
        ...kategori.toJSON(),
        sisa_kuota: kategori.kuota - kategori.terjual,
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

// @desc    Update kategori tiket
// @route   PUT /api/kategori-tiket/:id
// @access  Admin
const updateKategori = async (req, res) => {
  try {
    const kategori = await KategoriTiket.findByPk(req.params.id);

    if (!kategori) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tiket tidak ditemukan.',
      });
    }

    const { nama_kelas, harga, kuota } = req.body;

    // Validasi kuota baru tidak boleh lebih kecil dari yang sudah terjual
    if (kuota && kuota < kategori.terjual) {
      return res.status(400).json({
        success: false,
        message: `Kuota tidak boleh kurang dari tiket yang sudah terjual (${kategori.terjual}).`,
      });
    }

    await kategori.update({
      nama_kelas: nama_kelas || kategori.nama_kelas,
      harga: harga !== undefined ? harga : kategori.harga,
      kuota: kuota || kategori.kuota,
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori tiket berhasil diperbarui.',
      data: {
        ...kategori.toJSON(),
        sisa_kuota: kategori.kuota - kategori.terjual,
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

// @desc    Hapus kategori tiket
// @route   DELETE /api/kategori-tiket/:id
// @access  Admin
const deleteKategori = async (req, res) => {
  try {
    const kategori = await KategoriTiket.findByPk(req.params.id);

    if (!kategori) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tiket tidak ditemukan.',
      });
    }

    if (kategori.terjual > 0) {
      return res.status(400).json({
        success: false,
        message: 'Kategori tiket tidak bisa dihapus karena sudah ada tiket yang terjual.',
      });
    }

    await kategori.destroy();

    return res.status(200).json({
      success: true,
      message: 'Kategori tiket berhasil dihapus.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

module.exports = { getKategoriByEvent, createKategori, updateKategori, deleteKategori };
