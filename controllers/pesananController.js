const { sequelize, Pesanan, Event, KategoriTiket, User } = require('../models');
const crypto = require('crypto');
const fs = require('fs');
const { withPembeli } = require('../utils/pesananFormat');
const { konfirmasiLunas, tutupTanpaBayar } = require('../services/pembayaranService');
const { daftarTiket } = require('../services/tiketService');

const {
  KODE_REGEX,
  normalisasiKode,
  normalisasiEmail,
  normalisasiTelepon,
  emailValid,
  teleponValid,
  kontakCocok,
  formatHasilPembelian,
} = require('../utils/cekPembelian');

// Generate kode tiket unik
const generateKodeTiket = () => {
  return 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// @desc    Buat pesanan tiket baru
// @route   POST /api/pesanan
// @access  Pelanggan
const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const buatPesanan = async (req, res) => {
  try {
    const { event_id, kategori_tiket_id } = req.body;
    const jumlah = Number(req.body.jumlah);

    if (!event_id || !kategori_tiket_id || !Number.isInteger(jumlah) || jumlah < 1) {
      return res.status(400).json({
        success: false,
        message: 'event_id, kategori_tiket_id, dan jumlah wajib diisi.',
      });
    }

    // Satu transaksi + row lock, supaya pembelian bersamaan tidak membuat stok minus
    const pesanan = await sequelize.transaction(async (t) => {
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

      const dibuat = await Pesanan.create(
        {
          user_id: req.user.id,
          event_id,
          kategori_tiket_id,
          jumlah,
          total_harga: Number(kategori.harga) * jumlah,
          kode_tiket: generateKodeTiket(),
          status_bayar: 'pending',
          order_type: 'online',
        },
        { transaction: t }
      );

      await kategori.update({ terjual: kategori.terjual + jumlah }, { transaction: t });

      return dibuat;
    });

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran.',
      data: pesanan,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
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

// @desc    Upload bukti pembayaran
// @route   POST /api/pesanan/:id/bayar
// @access  Pelanggan
const uploadBuktiBayar = async (req, res) => {
  try {
    const pesanan = await Pesanan.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
    });

    if (!pesanan) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    if (pesanan.status_bayar !== 'pending') {
      return res.status(400).json({
        success: false,
        message:
          'Hanya pesanan berstatus pending yang bisa upload bukti bayar.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File bukti pembayaran wajib diupload.',
      });
    }

    await pesanan.update({
      bukti_bayar: req.file.path,
    });

    return res.status(200).json({
      success: true,
      message:
        'Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.',
      data: pesanan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Verifikasi pembayaran (admin)
// @route   PATCH /api/pesanan/:id/verifikasi
// @access  Admin
// Perubahan status + penerbitan tiket dilakukan atomik di pembayaranService.
const verifikasiPembayaran = async (req, res) => {
  try {
    const { aksi } = req.body || {};

    if (!aksi || !['setujui', 'tolak'].includes(aksi)) {
      return res.status(400).json({
        success: false,
        message: 'aksi wajib diisi: "setujui" atau "tolak".',
      });
    }
    if (!/^\d+$/.test(String(req.params.id))) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    const hasil =
      aksi === 'setujui'
        ? await konfirmasiLunas(req.params.id)
        : await tutupTanpaBayar(req.params.id, 'ditolak');

    // Panggilan berulang pada pesanan yang sudah lunas: tidak membuat tiket baru
    if (hasil.sudahLunas) {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini sudah diverifikasi sebelumnya.',
      });
    }

    const pesanan = await Pesanan.findByPk(req.params.id, {
      include: [
        { model: Event, as: 'event', attributes: ['nama_event', 'tanggal', 'lokasi'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas'] },
        { model: User, as: 'user', attributes: ['nama', 'email'] },
      ],
    });

    const data = pesanan.toJSON();
    data.tiket = aksi === 'setujui' ? await daftarTiket(pesanan.id, { sertakanQr: false }) : [];

    return res.status(200).json({
      success: true,
      message:
        aksi === 'setujui'
          ? 'Pembayaran berhasil diverifikasi. Tiket sudah aktif.'
          : 'Pembayaran ditolak.',
      data,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('verifikasiPembayaran error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

// @desc    Riwayat pesanan milik pelanggan yang login
// @route   GET /api/pesanan/riwayat
// @access  Pelanggan
const getRiwayatPesanan = async (req, res) => {
  try {
    const pesanan = await Pesanan.findAll({
      where: {
        user_id: req.user.id,
      },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: [
            'id',
            'nama_event',
            'tanggal',
            'lokasi',
            'image_url',
          ],
          include: [
            {
              model: require('../models/Artis'),
              as: 'artis',
              attributes: ['nama'],
            },
          ],
        },
        {
          model: KategoriTiket,
          as: 'kategori_tiket',
          attributes: ['nama_kelas', 'harga'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      total: pesanan.length,
      data: pesanan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Detail satu pesanan (pelanggan)
// @route   GET /api/pesanan/:id
// @access  Pelanggan
const getDetailPesanan = async (req, res) => {
  try {
    const pesanan = await Pesanan.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
      include: [
        {
          model: Event,
          as: 'event',
        },
        {
          model: KategoriTiket,
          as: 'kategori_tiket',
        },
      ],
    });

    if (!pesanan) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

       const data = pesanan.toJSON();
    data.tiket = pesanan.status_bayar === 'lunas' ? await daftarTiket(pesanan.id) : [];

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Semua pesanan (admin)
// @route   GET /api/pesanan
// @access  Admin
const getAllPesanan = async (req, res) => {
  try {
    // Filter berdasarkan order_type jika diberikan
    const where = {};

    if (['online', 'offline'].includes(req.query.order_type)) {
      where.order_type = req.query.order_type;
    }

    const pesanan = await Pesanan.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nama', 'email', 'no_telepon'],
        },
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'nama_event', 'tanggal'],
        },
        {
          model: KategoriTiket,
          as: 'kategori_tiket',
          attributes: ['nama_kelas', 'harga'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      total: pesanan.length,
      data: pesanan.map(withPembeli),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

// @desc    Cek pembelian tanpa login (email atau nomor HP + kode booking)
// @route   POST /api/pesanan/cek
// @access  Publik (dibatasi rate limiter)
const cekPembelian = async (req, res) => {
  try {
    const body = req.body || {};
    const kode = normalisasiKode(body.kode_tiket);
    const emailMentah = typeof body.email === 'string' ? body.email.trim() : '';
    const teleponMentah = body.no_telepon === undefined || body.no_telepon === null
      ? ''
      : String(body.no_telepon).trim();

    if (!KODE_REGEX.test(kode)) {
      return res.status(400).json({
        success: false,
        message: 'Format kode booking tidak valid. Contoh: TKT-1A2B3C4D.',
      });
    }
    if (!emailMentah && !teleponMentah) {
      return res.status(400).json({
        success: false,
        message: 'Email atau nomor HP wajib diisi.',
      });
    }
    if (emailMentah && teleponMentah) {
      return res.status(400).json({
        success: false,
        message: 'Gunakan salah satu: email atau nomor HP.',
      });
    }

    const email = normalisasiEmail(emailMentah);
    const telepon = normalisasiTelepon(teleponMentah);

    if (emailMentah && !emailValid(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
    }
    if (teleponMentah && !teleponValid(telepon)) {
      return res.status(400).json({ success: false, message: 'Format nomor HP tidak valid.' });
    }

    const pesanan = await Pesanan.findOne({
      where: { kode_tiket: kode },
      include: [
        { model: User, as: 'user', attributes: ['id', 'nama', 'email', 'no_telepon'] },
        { model: Event, as: 'event', attributes: ['id', 'nama_event', 'tanggal', 'lokasi', 'status'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['id', 'nama_kelas', 'harga'] },
      ],
    });

    // Satu pesan untuk semua kegagalan (kode salah / kontak tidak cocok),
    // supaya orang luar tidak bisa menebak email atau nomor yang terdaftar.
    if (!pesanan || !kontakCocok(pesanan, { email, telepon })) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan. Periksa kembali email/nomor HP dan kode booking.',
      });
    }

        // Tiket + QR diambil dari tabel `tiket` dan hanya untuk pesanan lunas
    const tiket =
      pesanan.status_bayar === 'lunas' ? await daftarTiket(pesanan.id, { sertakanKode: false }) : [];

    return res.status(200).json({
      success: true,
      data: formatHasilPembelian(pesanan, tiket),
    });

  } catch (error) {
    console.error('cekPembelian error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

module.exports = {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
  cekPembelian,
};