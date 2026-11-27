const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { sequelize, Pesanan, Event, KategoriTiket, User, CekPesananOtp } = require('../models');
const crypto = require('crypto');
const fs = require('fs');
const { withPembeli } = require('../utils/pesananFormat');
const { konfirmasiLunas, tutupTanpaBayar } = require('../services/pembayaranService');
const { daftarTiket } = require('../services/tiketService');
const { createSnapTransaction, isConfigured, verifyNotification } = require('../services/midtransService');
const { assertEventOpenForSale } = require('../utils/eventSales');
const { sendCekPesananOtpEmail } = require('../services/emailService');
const {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  compareOtp,
  getExpiryDate,
} = require('../utils/otp');

const {
  normalisasiEmail,
  normalisasiTelepon,
  emailValid,
  teleponValid,
  kunciKontak,
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
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway belum dikonfigurasi. Silakan hubungi admin.',
      });
    }

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
      // Aturan yang sama dengan penjualan offline: status 'aktif' dan belum lewat hari acara (WIB)
      assertEventOpenForSale(event, 'online');

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

      dibuat.gateway_order_id = `DRSTAR-${dibuat.id}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      await dibuat.save({ transaction: t });

      return { pesanan: dibuat, kategori };
    });

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'nama', 'email', 'no_telepon'],
    });
    if (!user) throw httpError(404, 'Data pembeli tidak ditemukan.');

    try {
      const payment = await createSnapTransaction({
        pesanan: pesanan.pesanan,
        kategori: pesanan.kategori,
        user,
      });
      await pesanan.pesanan.update({
        payment_url: payment.paymentUrl,
        payment_status: 'pending',
      });
    } catch (error) {
      await tutupTanpaBayar(pesanan.pesanan.id, 'ditolak');
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat. Lanjutkan pembayaran melalui Midtrans.',
      data: pesanan.pesanan,
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

    if (pesanan.gateway_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini menggunakan pembayaran online. Selesaikan pembayaran melalui Midtrans.',
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

// @desc    Notifikasi pembayaran dari Midtrans
// @route   POST /api/pesanan/webhook/midtrans
// @access  Public (signature diverifikasi dengan Server Key)
const midtransNotification = async (req, res) => {
  try {
    const notification = req.body;
    if (!verifyNotification(notification)) {
      return res.status(401).json({ success: false, message: 'Signature notifikasi tidak valid.' });
    }

    const pesanan = await Pesanan.findOne({
      where: { gateway_order_id: notification.order_id },
    });
    if (!pesanan) {
      console.warn('Midtrans notification references an unknown order:', notification.order_id);
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    if (Number(notification.gross_amount) !== Number(pesanan.total_harga)) {
      return res.status(400).json({ success: false, message: 'Nominal pembayaran tidak cocok.' });
    }

    const status = notification.transaction_status;
    const fraudAccepted = notification.fraud_status === 'accept';

    if (
      (status === 'settlement' || (status === 'capture' && fraudAccepted)) &&
      pesanan.status_bayar === 'pending'
    ) {
      await konfirmasiLunas(pesanan.id);
    } else if (status === 'expire' && pesanan.status_bayar === 'pending') {
      await tutupTanpaBayar(pesanan.id, 'kadaluarsa');
    } else if (
      (status === 'cancel' || status === 'deny') &&
      pesanan.status_bayar === 'pending'
    ) {
      await tutupTanpaBayar(pesanan.id, 'ditolak');
    }

    if (pesanan.status_bayar !== 'lunas' || status === 'settlement' || status === 'capture') {
      await pesanan.update({ payment_status: status });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('midtransNotification error:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Notifikasi pembayaran gagal diproses.',
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
            'status',
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
          attributes: ['id', 'nama_event', 'tanggal', 'lokasi'],
        },
        {
          model: KategoriTiket,
          as: 'kategori_tiket',
          attributes: ['nama_kelas', 'harga', 'area'],
        },
        // Petugas loket untuk transaksi offline (null untuk pesanan online)
        {
          model: User,
          as: 'petugas',
          attributes: ['id', 'nama'],
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

// ===== CEK PEMBELIAN TANPA LOGIN (verifikasi OTP) =====

const MAX_PESANAN_CEK = 20;

// Baca & validasi email / nomor HP dari body. Mengembalikan { error } atau { email, telepon }.
const bacaKontakCek = (body = {}) => {
  const emailMentah = typeof body.email === 'string' ? body.email.trim() : '';
  const teleponMentah =
    body.no_telepon === undefined || body.no_telepon === null ? '' : String(body.no_telepon).trim();

  if (!emailMentah && !teleponMentah) return { error: 'Email atau nomor HP wajib diisi.' };
  if (emailMentah && teleponMentah) return { error: 'Gunakan salah satu: email atau nomor HP.' };

  const email = normalisasiEmail(emailMentah);
  const telepon = normalisasiTelepon(teleponMentah);
  if (emailMentah && !emailValid(email)) return { error: 'Format email tidak valid.' };
  if (teleponMentah && !teleponValid(telepon)) return { error: 'Format nomor HP tidak valid.' };

  return { email, telepon };
};

// Semua pesanan yang kontak pembelinya cocok (akun pembeli online atau data pembeli offline).
const cariPesananByKontak = async ({ email, telepon }) => {
  let kondisi;
  if (email) {
    kondisi = {
      [Op.or]: [
        sqlWhere(fn('lower', col('user.email')), email),
        sqlWhere(fn('lower', col('Pesanan.email_pembeli')), email),
      ],
    };
  } else {
    // 0812xxx -> cocokkan juga dengan 62812xxx dan 812xxx; tanda baca/spasi diabaikan
    const inti = telepon.slice(1);
    const varian = [`0${inti}`, `62${inti}`, inti];
    const digits = (kolom) =>
      sqlWhere(fn('regexp_replace', col(kolom), '[^0-9]', '', 'g'), { [Op.in]: varian });
    kondisi = { [Op.or]: [digits('user.no_telepon'), digits('Pesanan.no_telepon_pembeli')] };
  }

  const rows = await Pesanan.findAll({
    where: kondisi,
    include: [
      { model: User, as: 'user', attributes: ['id', 'nama', 'email', 'no_telepon'] },
      { model: Event, as: 'event', attributes: ['id', 'nama_event', 'tanggal', 'lokasi', 'status'] },
      { model: KategoriTiket, as: 'kategori_tiket', attributes: ['id', 'nama_kelas', 'harga'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: MAX_PESANAN_CEK,
  });

  // Pengaman tambahan: cocokkan ulang di JavaScript dengan aturan normalisasi yang sama.
  return rows.filter((p) => kontakCocok(p, { email, telepon }));
};

// @desc    Kirim OTP cek pesanan ke email pembeli (tanpa login)
// @route   POST /api/pesanan/cek/kirim-otp
// @access  Publik (dibatasi rate limiter)
const kirimOtpCekPembelian = async (req, res) => {
  try {
    const kontak = bacaKontakCek(req.body);
    if (kontak.error) {
      return res.status(400).json({ success: false, message: kontak.error });
    }

    const pesananList = await cariPesananByKontak(kontak);

    // Email tujuan: email yang diketik, atau (jika cari lewat nomor HP) email yang tersimpan di pesanan.
    const emailTujuan =
      kontak.email ||
      pesananList
        .map((p) => (p.user && p.user.email) || p.email_pembeli)
        .find(Boolean);

    if (pesananList.length > 0 && emailTujuan) {
      const kunci = kunciKontak(kontak);

      // Nonaktifkan OTP lama yang belum dipakai untuk kontak ini.
      await CekPesananOtp.update({ is_used: true }, { where: { kontak: kunci, is_used: false } });

      const otp = generateOtp();
      await CekPesananOtp.create({
        kontak: kunci,
        email_tujuan: emailTujuan,
        otp_hash: await hashOtp(otp),
        expires_at: getExpiryDate(),
      });

      await sendCekPesananOtpEmail({ to: emailTujuan, otp, expiryMinutes: OTP_EXPIRY_MINUTES });
    }

    // Balasan sama untuk semua kasus, supaya orang luar tidak bisa menebak email/nomor yang terdaftar.
    return res.status(200).json({
      success: true,
      message: 'Jika ada pesanan yang cocok, kode OTP telah dikirim ke email pembeli.',
      data: { otp_length: OTP_LENGTH, berlaku_menit: OTP_EXPIRY_MINUTES },
    });
  } catch (error) {
    console.error('kirimOtpCekPembelian error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// @desc    Verifikasi OTP lalu kembalikan daftar pesanan (tanpa login)
// @route   POST /api/pesanan/cek/verifikasi
// @access  Publik (dibatasi rate limiter)
const verifikasiOtpCekPembelian = async (req, res) => {
  try {
    const body = req.body || {};
    const kontak = bacaKontakCek(body);
    if (kontak.error) {
      return res.status(400).json({ success: false, message: kontak.error });
    }

    const otp = typeof body.otp === 'string' || typeof body.otp === 'number' ? String(body.otp).trim() : '';
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
      return res.status(400).json({ success: false, message: `Masukkan ${OTP_LENGTH} digit kode OTP.` });
    }

    const record = await CekPesananOtp.findOne({
      where: { kontak: kunciKontak(kontak), is_used: false },
      order: [['created_at', 'DESC']],
    });

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
    }
    if (new Date() > record.expires_at) {
      return res.status(400).json({ success: false, message: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' });
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      return res
        .status(429)
        .json({ success: false, message: 'Terlalu banyak percobaan. Minta kode OTP baru.' });
    }

    if (!(await compareOtp(otp, record.otp_hash))) {
      await record.increment('attempts');
      return res.status(400).json({ success: false, message: 'Kode OTP tidak valid.' });
    }

    // OTP hanya berlaku sekali. Update bersyarat supaya dua request bersamaan tidak sama-sama lolos.
    const [terpakai] = await CekPesananOtp.update(
      { is_used: true },
      { where: { id: record.id, is_used: false } }
    );
    if (!terpakai) {
      return res
        .status(400)
        .json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
    }

    const pesananList = await cariPesananByKontak(kontak);

    // Tiket + QR diambil dari tabel `tiket` dan hanya untuk pesanan lunas
    const data = await Promise.all(
      pesananList.map(async (pesanan) =>
        formatHasilPembelian(
          pesanan,
          pesanan.status_bayar === 'lunas' ? await daftarTiket(pesanan.id, { sertakanKode: false }) : []
        )
      )
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('verifikasiOtpCekPembelian error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

module.exports = {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
  kirimOtpCekPembelian,
  verifikasiOtpCekPembelian,
  midtransNotification,
};