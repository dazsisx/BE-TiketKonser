const { Pesanan, Event, KategoriTiket, User } = require('../models');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');

// Generate kode tiket unik
const generateKodeTiket = () => {
  return 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// @desc    Buat pesanan tiket baru
// @route   POST /api/pesanan
// @access  Pelanggan
const buatPesanan = async (req, res) => {
  try {
    const { event_id, kategori_tiket_id, jumlah } = req.body;

    if (!event_id || !kategori_tiket_id || !jumlah) {
      return res.status(400).json({
        success: false,
        message: 'event_id, kategori_tiket_id, dan jumlah wajib diisi.',
      });
    }

    // Cek event ada dan masih buka
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event tidak ditemukan.' });
    }
    if (event.status === 'tutup') {
      return res.status(400).json({ success: false, message: 'Penjualan tiket untuk event ini sudah ditutup.' });
    }

    // Cek kategori tiket
    const kategori = await KategoriTiket.findOne({
      where: { id: kategori_tiket_id, event_id },
    });
    if (!kategori) {
      return res.status(404).json({ success: false, message: 'Kategori tiket tidak ditemukan.' });
    }

    // Cek sisa kuota
    const sisaKuota = kategori.kuota - kategori.terjual;
    if (jumlah > sisaKuota) {
      return res.status(400).json({
        success: false,
        message: `Kuota tidak cukup. Sisa kuota: ${sisaKuota} tiket.`,
      });
    }

    const total_harga = kategori.harga * jumlah;
    const kode_tiket = generateKodeTiket();

    const pesanan = await Pesanan.create({
      user_id: req.user.id,
      event_id,
      kategori_tiket_id,
      jumlah,
      total_harga,
      kode_tiket,
      status_bayar: 'pending',
    });

    // Update jumlah terjual
    await kategori.update({ terjual: kategori.terjual + jumlah });

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran.',
      data: pesanan,
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

// @desc    Upload bukti pembayaran
// @route   POST /api/pesanan/:id/bayar
// @access  Pelanggan
const uploadBuktiBayar = async (req, res) => {
  try {
    const pesanan = await Pesanan.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!pesanan) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    if (pesanan.status_bayar !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Hanya pesanan berstatus pending yang bisa upload bukti bayar.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File bukti pembayaran wajib diupload.' });
    }

    await pesanan.update({ bukti_bayar: req.file.path });

    return res.status(200).json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.',
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
const verifikasiPembayaran = async (req, res) => {
  try {
    const { aksi } = req.body; // 'setujui' atau 'tolak'

    if (!aksi || !['setujui', 'tolak'].includes(aksi)) {
      return res.status(400).json({
        success: false,
        message: 'aksi wajib diisi: "setujui" atau "tolak".',
      });
    }

    const pesanan = await Pesanan.findByPk(req.params.id, {
      include: [
        { model: Event, as: 'event', attributes: ['nama_event', 'tanggal', 'lokasi'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas'] },
        { model: User, as: 'user', attributes: ['nama', 'email'] },
      ],
    });

    if (!pesanan) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    if (pesanan.status_bayar !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini sudah diverifikasi sebelumnya.',
      });
    }

    if (aksi === 'tolak') {
      // Kembalikan kuota tiket
      const kategori = await KategoriTiket.findByPk(pesanan.kategori_tiket_id);
      await kategori.update({ terjual: kategori.terjual - pesanan.jumlah });

      await pesanan.update({ status_bayar: 'ditolak' });

      return res.status(200).json({
        success: true,
        message: 'Pembayaran ditolak.',
        data: pesanan,
      });
    }

    // Setujui: generate QR Code
    const qrData = JSON.stringify({
      kode_tiket: pesanan.kode_tiket,
      event: pesanan.event?.nama_event,
      kategori: pesanan.kategori_tiket?.nama_kelas,
      jumlah: pesanan.jumlah,
      nama: pesanan.user?.nama,
    });

    const qrCode = await QRCode.toDataURL(qrData);

    await pesanan.update({
      status_bayar: 'lunas',
      qr_code: qrCode,
    });

    return res.status(200).json({
      success: true,
      message: 'Pembayaran berhasil diverifikasi. Tiket sudah aktif.',
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

// @desc    Riwayat pesanan milik pelanggan yang login
// @route   GET /api/pesanan/riwayat
// @access  Pelanggan
const getRiwayatPesanan = async (req, res) => {
  try {
    const pesanan = await Pesanan.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'nama_event', 'tanggal', 'lokasi', 'poster'],
          include: [{ model: require('../models/Artis'), as: 'artis', attributes: ['nama'] }],
        },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas', 'harga'] },
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
      where: { id: req.params.id, user_id: req.user.id },
      include: [
        { model: Event, as: 'event' },
        { model: KategoriTiket, as: 'kategori_tiket' },
      ],
    });

    if (!pesanan) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    return res.status(200).json({
      success: true,
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

// @desc    Semua pesanan (admin)
// @route   GET /api/pesanan
// @access  Admin
const getAllPesanan = async (req, res) => {
  try {
    const pesanan = await Pesanan.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'nama', 'email', 'no_telepon'] },
        { model: Event, as: 'event', attributes: ['id', 'nama_event', 'tanggal'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas', 'harga'] },
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

module.exports = {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
};
