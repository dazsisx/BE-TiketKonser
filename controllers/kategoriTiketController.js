const { sequelize, KategoriTiket, Event, Pesanan } = require('../models');
const { resolveAreaTiket, AREA_KEYS, LABEL_BY_KEY } = require('../utils/areaTiket');

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// undefined/null/string kosong dianggap "tidak diisi"
const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

// Area harus dikenal, dan satu area hanya dipakai satu kategori per event
// (denah venue menampilkan satu kategori per zona). Mengembalikan key area atau null (otomatis).
const validateArea = async (rawArea, eventId, { exceptId, transaction } = {}) => {
  const area = resolveAreaTiket(rawArea);
  if (hasValue(rawArea) && !area) {
    throw httpError(400, `Area tiket tidak dikenal. Pilihan: ${AREA_KEYS.join(', ')}.`);
  }
  if (!area) return null;

  const dipakai = await KategoriTiket.findOne({
    where: { event_id: eventId, area },
    transaction,
  });
  if (dipakai && dipakai.id !== exceptId) {
    throw httpError(
      409,
      `Area ${LABEL_BY_KEY[area]} sudah dipakai kategori "${dipakai.nama_kelas}" pada event ini. Satu area hanya untuk satu kategori.`
    );
  }
  return area;
};

// Error umum dari operasi tulis kategori: validasi Sequelize, bentrok indeks unik area, dan error ber-status
const handleWriteError = (res, error) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: error.errors.map((e) => e.message).join(', '),
    });
  }
  if (error.name === 'SequelizeUniqueConstraintError') {
    // Dua permintaan bersamaan memakai area yang sama: indeks unik di database yang menang
    return res.status(409).json({
      success: false,
      message: 'Area tiket tersebut sudah dipakai kategori lain pada event ini.',
    });
  }
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server.',
    error: error.message,
  });
};

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
    const { event_id, nama_kelas, harga, kuota, area } = req.body;

    if (!event_id || !nama_kelas || harga === undefined || !kuota) {
      return res.status(400).json({
        success: false,
        message: 'event_id, nama_kelas, harga, dan kuota wajib diisi.',
      });
    }
    const hargaNum = Number(harga);
    const kuotaNum = Number(kuota);
    if (!Number.isFinite(hargaNum) || hargaNum < 0) {
      return res.status(400).json({ success: false, message: 'Harga harus berupa angka dan tidak boleh negatif.' });
    }
    if (!Number.isInteger(kuotaNum) || kuotaNum < 1) {
      return res.status(400).json({ success: false, message: 'Kuota harus berupa angka bulat minimal 1.' });
    }

    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event tidak ditemukan.',
      });
    }

    const resolvedArea = await validateArea(area, event.id);

    const kategori = await KategoriTiket.create({
      event_id,
      nama_kelas,
      harga: hargaNum,
      kuota: kuotaNum,
      terjual: 0,
      area: resolvedArea,
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
    return handleWriteError(res, error);
  }
};

// @desc    Update kategori tiket
// @route   PUT /api/kategori-tiket/:id
// @access  Admin
const updateKategori = async (req, res) => {
  try {
    const { nama_kelas, harga, kuota, area } = req.body;

    // Satu transaksi + row lock pada kategori: pembuatan pesanan (online maupun offline) juga mengunci baris
    // ini, jadi `terjual` yang dibandingkan dengan kuota baru tidak bisa berubah di tengah proses.
    const kategori = await sequelize.transaction(async (t) => {
      const row = await KategoriTiket.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!row) throw httpError(404, 'Kategori tiket tidak ditemukan.');

      let nextKuota = row.kuota;
      if (kuota !== undefined) {
        nextKuota = Number(kuota);
        if (!Number.isInteger(nextKuota) || nextKuota < 1) {
          throw httpError(400, 'Kuota harus berupa angka bulat minimal 1.');
        }
      }
      // Kuota baru tidak boleh lebih kecil dari yang sudah terjual (termasuk pesanan yang masih menunggu bayar)
      if (nextKuota < row.terjual) {
        throw httpError(400, `Kuota tidak boleh kurang dari tiket yang sudah terjual (${row.terjual}).`);
      }

      let nextHarga = row.harga;
      if (harga !== undefined) {
        nextHarga = Number(harga);
        if (!Number.isFinite(nextHarga) || nextHarga < 0) {
          throw httpError(400, 'Harga harus berupa angka dan tidak boleh negatif.');
        }
      }

      // undefined = tidak diubah; string kosong = otomatis (null)
      const nextArea =
        area === undefined ? row.area : await validateArea(area, row.event_id, { exceptId: row.id, transaction: t });

      await row.update(
        {
          nama_kelas: nama_kelas || row.nama_kelas,
          harga: nextHarga,
          kuota: nextKuota,
          area: nextArea,
        },
        { transaction: t }
      );
      return row;
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
    return handleWriteError(res, error);
  }
};

// @desc    Hapus kategori tiket
// @route   DELETE /api/kategori-tiket/:id
// @access  Admin
const deleteKategori = async (req, res) => {
  try {
    await sequelize.transaction(async (t) => {
      // Kunci baris kategori: pembuatan pesanan juga mengunci baris ini,
      // jadi pesanan baru tidak bisa masuk di tengah proses penghapusan.
      const kategori = await KategoriTiket.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!kategori) {
        const err = new Error('Kategori tiket tidak ditemukan.');
        err.status = 404;
        throw err;
      }

      if (kategori.terjual > 0) {
        const err = new Error('Kategori tiket tidak bisa dihapus karena sudah ada tiket yang terjual.');
        err.status = 400;
        throw err;
      }

      // `terjual` turun lagi saat pembayaran ditolak, jadi 0 belum berarti tidak pernah
      // dipesan. Pesanan dalam status apa pun tetap merupakan catatan transaksi.
      const jumlahPesanan = await Pesanan.count({
        where: { kategori_tiket_id: kategori.id },
        transaction: t,
      });
      if (jumlahPesanan > 0) {
        const err = new Error(
          `Kategori tiket tidak bisa dihapus karena sudah memiliki ${jumlahPesanan} pesanan.`
        );
        err.status = 409;
        throw err;
      }

      await kategori.destroy({ transaction: t });
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori tiket berhasil dihapus.',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Kategori tiket tidak bisa dihapus karena masih terhubung dengan data lain.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

module.exports = { getKategoriByEvent, createKategori, updateKategori, deleteKategori };