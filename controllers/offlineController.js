const QRCode = require('qrcode');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Pesanan, Event, KategoriTiket, User } = require('../models');
const { withPembeli } = require('../utils/pesananFormat');

const MAX_TIKET = 5; // sama dengan batas di model Pesanan
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (UTC+7, tanpa DST)
const DAY_MS = 24 * 60 * 60 * 1000;

const generateKodeTiket = () => 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const handleError = (res, error) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: error.errors.map((e) => e.message).join(', '),
    });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
};

const isPositiveInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

// Awal hari ini menurut WIB, dalam bentuk Date (UTC)
const startOfTodayWIB = () => {
  const start = Math.floor((Date.now() + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
  return new Date(start);
};

// admin_offline hanya melihat transaksi miliknya; admin melihat semua transaksi offline
const scopeOffline = (user) =>
  user.role === 'admin_offline'
    ? { order_type: 'offline', dibuat_oleh: user.id }
    : { order_type: 'offline' };

const includeRelasi = [
  { model: Event, as: 'event', attributes: ['id', 'nama_event', 'tanggal', 'lokasi'] },
  { model: KategoriTiket, as: 'kategori_tiket', attributes: ['id', 'nama_kelas', 'harga'] },
  { model: User, as: 'petugas', attributes: ['id', 'nama'] },
];

// @route   POST /api/offline/pesanan
const jualOffline = async (req, res) => {
  try {
    const { event_id, kategori_tiket_id, nama_pembeli, no_telepon, email } = req.body;
    const jumlah = Number(req.body.jumlah);
    const nama = typeof nama_pembeli === 'string' ? nama_pembeli.trim() : '';

    if (!isPositiveInt(event_id) || !isPositiveInt(kategori_tiket_id) || !nama) {
      throw httpError(400, 'event_id, kategori_tiket_id, jumlah, dan nama_pembeli wajib diisi.');
    }
    if (nama.length < 2 || nama.length > 100) {
      throw httpError(400, 'Nama pembeli harus 2-100 karakter.');
    }
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > MAX_TIKET) {
      throw httpError(400, `Jumlah tiket harus antara 1 dan ${MAX_TIKET}.`);
    }
    if (email && !/^\S+@\S+\.\S+$/.test(String(email))) {
      throw httpError(400, 'Format email tidak valid.');
    }
    if (no_telepon && !/^[0-9+\-\s]{6,20}$/.test(String(no_telepon))) {
      throw httpError(400, 'Format nomor telepon tidak valid.');
    }

    // Satu transaksi + row lock pada kategori tiket, supaya dua penjualan
    // bersamaan tidak membuat stok minus (oversell).
    const pesananId = await sequelize.transaction(async (t) => {
      const event = await Event.findByPk(event_id, { transaction: t });
      if (!event) throw httpError(404, 'Event tidak ditemukan.');
            if (event.status !== 'aktif') {
        throw httpError(400, 'Penjualan tiket untuk event ini sedang tidak dibuka.');
      }

      const kategori = await KategoriTiket.findOne({
        where: { id: kategori_tiket_id, event_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!kategori) throw httpError(404, 'Kategori tiket tidak ditemukan.');

      const sisaKuota = kategori.kuota - kategori.terjual;
      if (jumlah > sisaKuota) {
        throw httpError(400, `Kuota tidak cukup. Sisa kuota: ${sisaKuota} tiket.`);
      }

      const kode_tiket = generateKodeTiket();
      const total_harga = Number(kategori.harga) * jumlah;

      const qr_code = await QRCode.toDataURL(
        JSON.stringify({
          kode_tiket,
          event: event.nama_event,
          kategori: kategori.nama_kelas,
          jumlah,
          nama,
        })
      );

      const pesanan = await Pesanan.create(
        {
          user_id: null,
          event_id,
          kategori_tiket_id,
          jumlah,
          total_harga,
          status_bayar: 'lunas',
          kode_tiket,
          qr_code,
          order_type: 'offline',
          nama_pembeli: nama,
          no_telepon_pembeli: no_telepon ? String(no_telepon).trim() : null,
          email_pembeli: email ? String(email).trim() : null,
          dibuat_oleh: req.user.id,
        },
        { transaction: t }
      );

      await kategori.update({ terjual: kategori.terjual + jumlah }, { transaction: t });

      return pesanan.id;
    });

    const pesanan = await Pesanan.findByPk(pesananId, { include: includeRelasi });

    return res.status(201).json({
      success: true,
      message: 'Transaksi offline berhasil.',
      data: withPembeli(pesanan),
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// @route   GET /api/offline/pesanan?page=1&limit=50
const getRiwayatOffline = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const { count, rows } = await Pesanan.findAndCountAll({
      where: scopeOffline(req.user),
      include: includeRelasi,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      data: rows.map(withPembeli),
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// @route   GET /api/offline/pesanan/:id
const getDetailOffline = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.id)) {
      throw httpError(404, 'Transaksi tidak ditemukan.');
    }

    const pesanan = await Pesanan.findOne({
      where: { id: req.params.id, ...scopeOffline(req.user) },
      include: includeRelasi,
    });

    if (!pesanan) throw httpError(404, 'Transaksi tidak ditemukan.');

    return res.status(200).json({ success: true, data: withPembeli(pesanan) });
  } catch (error) {
    return handleError(res, error);
  }
};

// @route   GET /api/offline/dashboard
const getDashboardOffline = async (req, res) => {
  try {
    const where = { ...scopeOffline(req.user), status_bayar: 'lunas' };
    const hariIni = { ...where, createdAt: { [Op.gte]: startOfTodayWIB() } };

    const [transaksiHariIni, tiketHariIni, pendapatanHariIni, totalTransaksi, terbaru] =
      await Promise.all([
        Pesanan.count({ where: hariIni }),
        Pesanan.sum('jumlah', { where: hariIni }),
        Pesanan.sum('total_harga', { where: hariIni }),
        Pesanan.count({ where }),
        Pesanan.findAll({
          where: scopeOffline(req.user),
          include: includeRelasi,
          order: [['created_at', 'DESC']],
          limit: 5,
        }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        ringkasan: {
          penjualan_hari_ini: transaksiHariIni,
          tiket_terjual_hari_ini: Number(tiketHariIni || 0),
          total_transaksi_offline: totalTransaksi,
          pendapatan_hari_ini: Number(pendapatanHariIni || 0),
        },
        transaksi_terbaru: terbaru.map(withPembeli),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { jualOffline, getRiwayatOffline, getDetailOffline, getDashboardOffline };