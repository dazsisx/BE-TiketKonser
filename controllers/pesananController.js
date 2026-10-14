const { sequelize, Pesanan, Event, KategoriTiket, User } = require('../models');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { withPembeli } = require('../utils/pesananFormat');
const { assertEventOpenForSale } = require('../utils/eventSales');
const { removeUploadFile } = require('../utils/uploadPaths');

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
  let saved = false;
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
    saved = true;

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
  } finally {
    // Request gagal/ditolak: file yang baru diupload tidak boleh jadi yatim
    if (!saved && req.file) await removeUploadFile(req.file.path);
  }
};

// @desc    Verifikasi pembayaran (admin)
// @route   PATCH /api/pesanan/:id/verifikasi
// @access  Admin
const verifikasiPembayaran = async (req, res) => {
  try {
    const { aksi } = req.body;

    if (!aksi || !['setujui', 'tolak'].includes(aksi)) {
      return res.status(400).json({
        success: false,
        message: 'aksi wajib diisi: "setujui" atau "tolak".',
      });
    }

    // Satu transaksi + row lock pada pesanan: verifikasi ganda (klik dua kali / dua admin)
    // tidak boleh mengembalikan kuota dua kali atau memproses pesanan dua kali.
    const { pesanan, message } = await sequelize.transaction(async (t) => {
      const locked = await Pesanan.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!locked) throw httpError(404, 'Pesanan tidak ditemukan.');

      if (locked.status_bayar !== 'pending') {
        throw httpError(400, 'Pesanan ini sudah diverifikasi sebelumnya.');
      }

      // Relasi dimuat setelah baris terkunci (FOR UPDATE tidak bisa dipakai dengan LEFT JOIN)
      await locked.reload({
        transaction: t,
        include: [
          { model: Event, as: 'event', attributes: ['nama_event', 'tanggal', 'lokasi'] },
          { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas'] },
          { model: User, as: 'user', attributes: ['nama', 'email'] },
        ],
      });

      if (aksi === 'tolak') {
        // Kembalikan kuota tiket
        const kategori = await KategoriTiket.findByPk(locked.kategori_tiket_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (kategori) {
          await kategori.update(
            { terjual: Math.max(0, kategori.terjual - locked.jumlah) },
            { transaction: t }
          );
        }

        await locked.update({ status_bayar: 'ditolak' }, { transaction: t });

        return { pesanan: locked, message: 'Pembayaran ditolak.' };
      }

      // Setujui: generate QR Code
      const qrData = JSON.stringify({
        kode_tiket: locked.kode_tiket,
        event: locked.event?.nama_event,
        kategori: locked.kategori_tiket?.nama_kelas,
        jumlah: locked.jumlah,
        nama: locked.user?.nama,
      });

      const qrCode = await QRCode.toDataURL(qrData);

      await locked.update({ status_bayar: 'lunas', qr_code: qrCode }, { transaction: t });

      return { pesanan: locked, message: 'Pembayaran berhasil diverifikasi. Tiket sudah aktif.' };
    });

    return res.status(200).json({
      success: true,
      message,
      data: pesanan,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
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
      where: {
        user_id: req.user.id,
      },
      include: [
        {
          model: Event,
          as: 'event',
          // Event tidak punya kolom `poster`; poster disimpan di image_url/banner
          attributes: [
            'id',
            'nama_event',
            'tanggal',
            'lokasi',
            'image_url',
            'banner',
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

    // Bentuk respons event sama dengan endpoint /api/event: poster = image_url = banner
    const data = pesanan.map((p) => {
      const json = p.toJSON();
      if (json.event) {
        const poster = json.event.image_url ?? json.event.banner ?? null;
        json.event = { ...json.event, poster, image_url: poster, banner: poster };
      }
      return json;
    });

    return res.status(200).json({
      success: true,
      total: pesanan.length,
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

module.exports = {
  buatPesanan,
  uploadBuktiBayar,
  verifikasiPembayaran,
  getRiwayatPesanan,
  getDetailPesanan,
  getAllPesanan,
};