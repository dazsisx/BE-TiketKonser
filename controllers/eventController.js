const { Op } = require('sequelize');
const { sequelize, Event, Artis, KategoriTiket, Pesanan } = require('../models');
const { removeUploadFile, removeUploadFileIfUnused } = require('../utils/uploadPaths');
const { resolveKategoriEvent } = require('../utils/kategoriEvent');
const { normalizeKota, guessKota } = require('../utils/kotaEvent');
const { resolveVenueLayout, VENUE_LAYOUT_KEYS } = require('../utils/venueLayout');
const { normalizeTanggalWIB } = require('../utils/tanggalEvent');

// Status event di database (ENUM events.status). 'aktif' = penjualan dibuka.
const STATUS_EVENT = ['draft', 'aktif', 'ditutup', 'selesai'];

// undefined/null/string kosong dianggap "tidak diisi"
const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

// Hapus file poster lama hanya jika tidak ada event lain yang masih memakainya
const removePosterIfUnused = (stored) =>
  removeUploadFileIfUnused(
    stored,
    async () =>
      (await Event.count({ where: { [Op.or]: [{ image_url: stored }, { banner: stored }] } })) > 0
  );

const normalizeEvent = (event) => {
  if (!event) return null;
  const source = typeof event.toJSON === 'function' ? event.toJSON() : event;
  const artistId = source.artist_id ?? source.artis_id ?? null;
  const posterUrl = source.image_url ?? source.banner ?? source.poster ?? null;

  return {
    ...source,
    artis_id: artistId,
    artist_id: artistId,
    poster: posterUrl,
    image_url: posterUrl,
    banner: posterUrl,
  };
};

// @desc    Ambil semua event
// @route   GET /api/event
// @access  Public
const getAllEvent = async (req, res) => {
  try {
    // ?kategori=konser|festival|musik-live|akustik (slug atau label). Kosong = semua event.
    const where = {};
    if (req.query.kategori) {
      const label = resolveKategoriEvent(req.query.kategori);
      if (!label) {
        return res.status(400).json({ success: false, message: 'Kategori event tidak dikenal.' });
      }
      where.kategori_event = label;
    }
    // ?kota=Jakarta (tidak peduli huruf besar/kecil, "Kota Bandung" sama dengan "bandung"). Kosong = semua kota.
    if (req.query.kota) {
      const kota = normalizeKota(req.query.kota);
      if (kota) where[Op.and] = [sequelize.where(sequelize.fn('lower', sequelize.col('Event.kota')), kota.toLowerCase())];
    }

    const events = await Event.findAll({
      where,
      include: [
        { model: Artis, as: 'artis', attributes: ['id', 'nama', 'foto', 'genre'] },
        { model: KategoriTiket, as: 'kategori_tiket' },
      ],
      order: [['tanggal', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      total: events.length,
      data: events.map((event) => normalizeEvent(event)),
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

    const eventData = normalizeEvent(event);
    eventData.kategori_tiket = (eventData.kategori_tiket || []).map((k) => ({
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
  let saved = false;
  try {
    const { nama_event, deskripsi, tanggal, lokasi, kota, artis_id, artist_id, kategori_event, venue_layout, status } = req.body;
    const resolvedArtistId = Number(artis_id ?? artist_id);
    const resolvedKategori = resolveKategoriEvent(kategori_event);
    if (kategori_event && !resolvedKategori) {
      return res.status(400).json({ success: false, message: 'Kategori event tidak dikenal.' });
    }
    // kosong = otomatis (FE menebak denah dari lokasi)
    const resolvedLayout = resolveVenueLayout(venue_layout);
    if (hasValue(venue_layout) && !resolvedLayout) {
      return res.status(400).json({
        success: false,
        message: `Denah venue tidak dikenal. Pilihan: ${VENUE_LAYOUT_KEYS.join(', ')}.`,
      });
    }
    // kosong = langsung dijual (perilaku lama)
    const resolvedStatus = hasValue(status) ? String(status).trim().toLowerCase() : 'aktif';
    if (!STATUS_EVENT.includes(resolvedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Status event tidak valid. Pilihan: ${STATUS_EVENT.join(', ')}.`,
      });
    }

    if (!nama_event || !tanggal || !lokasi || !resolvedArtistId) {
      return res.status(400).json({
        success: false,
        message: 'Nama event, tanggal, lokasi, dan artis_id wajib diisi.',
      });
    }

    const artis = await Artis.findByPk(resolvedArtistId);
    if (!artis) {
      return res.status(404).json({
        success: false,
        message: 'Artis tidak ditemukan.',
      });
    }

    const event = await Event.create({
      nama_event,
      deskripsi: deskripsi || null,
      tanggal: normalizeTanggalWIB(tanggal),
      lokasi,
      // kosong -> ditebak dari lokasi (null kalau tidak dikenal)
      kota: normalizeKota(kota) ?? guessKota(lokasi),
      artist_id: resolvedArtistId,
      kategori_event: resolvedKategori,
      venue_layout: resolvedLayout,
      image_url: req.file ? req.file.path : null,
      status: resolvedStatus,
    });
    saved = true;

    return res.status(201).json({
      success: true,
      message: 'Event berhasil ditambahkan.',
      data: normalizeEvent(event),
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
  } finally {
    // Request gagal/ditolak: file yang baru diupload tidak boleh jadi yatim
    if (!saved && req.file) await removeUploadFile(req.file.path);
  }
};

// @desc    Update event
// @route   PUT /api/event/:id
// @access  Admin
const updateEvent = async (req, res) => {
  let saved = false;
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    const { nama_event, deskripsi, tanggal, lokasi, kota, artis_id, artist_id, status, kategori_event, venue_layout } = req.body;
    // undefined = tidak diubah; string kosong = hapus kategori; selain itu harus valid
    let nextKategori = event.kategori_event;
    if (kategori_event !== undefined) {
      nextKategori = resolveKategoriEvent(kategori_event);
      if (String(kategori_event).trim() && !nextKategori) {
        return res.status(400).json({ success: false, message: 'Kategori event tidak dikenal.' });
      }
    }
    // undefined = tidak diubah; string kosong = otomatis (null); selain itu harus denah yang dikenal
    let nextLayout = event.venue_layout;
    if (venue_layout !== undefined) {
      nextLayout = resolveVenueLayout(venue_layout);
      if (hasValue(venue_layout) && !nextLayout) {
        return res.status(400).json({
          success: false,
          message: `Denah venue tidak dikenal. Pilihan: ${VENUE_LAYOUT_KEYS.join(', ')}.`,
        });
      }
    }
    // undefined/kosong = tidak diubah; selain itu harus salah satu status yang dikenal
    let nextStatus = event.status;
    if (hasValue(status)) {
      nextStatus = String(status).trim().toLowerCase();
      if (!STATUS_EVENT.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Status event tidak valid. Pilihan: ${STATUS_EVENT.join(', ')}.`,
        });
      }
    }
    // undefined = tidak diubah; string kosong = tebak ulang dari lokasi
    const nextLokasi = lokasi || event.lokasi;
    const nextKota = kota !== undefined ? (normalizeKota(kota) ?? guessKota(nextLokasi)) : event.kota;
    const resolvedArtistId = Number(artis_id ?? artist_id ?? event.artist_id ?? event.artis_id);
    const nextImageUrl = req.file ? req.file.path : (req.body.image_url ?? req.body.poster ?? event.image_url ?? event.poster ?? null);

    const oldPoster = event.image_url || event.banner || event.poster || null;

    await event.update({
      nama_event: nama_event || event.nama_event,
      deskripsi: deskripsi !== undefined ? deskripsi : event.deskripsi,
      tanggal: tanggal ? normalizeTanggalWIB(tanggal) : event.tanggal,
      lokasi: nextLokasi,
      kota: nextKota,
      artist_id: resolvedArtistId,
      kategori_event: nextKategori,
      venue_layout: nextLayout,
      image_url: nextImageUrl,
      status: nextStatus,
    });
    saved = true;

    // File lama dihapus hanya setelah DB berhasil diperbarui
    if (req.file && oldPoster && oldPoster !== nextImageUrl) {
      await removePosterIfUnused(oldPoster);
    }

    return res.status(200).json({
      success: true,
      message: 'Event berhasil diperbarui.',
      data: normalizeEvent(event),
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
  } finally {
    if (!saved && req.file) await removeUploadFile(req.file.path);
  }
};

// @desc    Hapus event
// @route   DELETE /api/event/:id
// @access  Admin
const deleteEvent = async (req, res) => {
  try {
    const posterPaths = [];

    await sequelize.transaction(async (t) => {
      const event = await Event.findByPk(req.params.id, { transaction: t });

      if (!event) {
        const err = new Error('Event tidak ditemukan.');
        err.status = 404;
        throw err;
      }

      // Kunci kategori tiket event ini. Pembuatan pesanan juga mengunci baris kategori,
      // jadi pesanan baru tidak bisa menyelinap masuk saat event sedang dihapus.
      await KategoriTiket.findAll({
        where: { event_id: event.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // Pesanan dalam status apa pun (pending/lunas/ditolak/kadaluarsa) adalah
      // catatan transaksi, jadi event yang pernah dipesan tidak boleh dihapus.
      const jumlahPesanan = await Pesanan.count({ where: { event_id: event.id }, transaction: t });
      if (jumlahPesanan > 0) {
        const err = new Error(
          `Event tidak bisa dihapus karena sudah memiliki ${jumlahPesanan} pesanan. Gunakan "tutup penjualan" untuk menghentikan penjualan.`
        );
        err.status = 409;
        throw err;
      }

      // Kategori tiket tanpa pesanan dihapus eksplisit, tidak bergantung pada ON DELETE di DB
      await KategoriTiket.destroy({ where: { event_id: event.id }, transaction: t });
      await event.destroy({ transaction: t });

      posterPaths.push(...[event.image_url, event.banner].filter(Boolean));
    });

    // File dihapus hanya setelah transaksi DB berhasil (commit)
    for (const stored of [...new Set(posterPaths)]) {
      await removePosterIfUnused(stored);
    }

    return res.status(200).json({
      success: true,
      message: 'Event berhasil dihapus.',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Event tidak bisa dihapus karena masih terhubung dengan data lain.',
      });
    }
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

    await event.update({ status: 'ditutup' });

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

    await event.update({ status: 'aktif' });

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
