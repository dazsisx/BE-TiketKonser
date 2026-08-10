const { Pesanan, Event, User, KategoriTiket, Artis } = require('../models');
const { Op } = require('sequelize');

// @desc    Data statistik dashboard admin
// @route   GET /api/dashboard
// @access  Admin
const getDashboard = async (req, res) => {
  try {
    // Total user pelanggan
    const totalPelanggan = await User.count({ where: { role: 'pelanggan' } });

    // Total event
    const totalEvent = await Event.count();
    const eventBuka = await Event.count({ where: { status: 'buka' } });
    const eventTutup = await Event.count({ where: { status: 'tutup' } });

    // Total pesanan berdasarkan status
    const totalPesanan = await Pesanan.count();
    const pesananPending = await Pesanan.count({ where: { status_bayar: 'pending' } });
    const pesananLunas = await Pesanan.count({ where: { status_bayar: 'lunas' } });
    const pesananDitolak = await Pesanan.count({ where: { status_bayar: 'ditolak' } });

    // Total pendapatan (hanya dari pesanan lunas)
    const pendapatan = await Pesanan.sum('total_harga', {
      where: { status_bayar: 'lunas' },
    });

    // Total tiket terjual (dari pesanan lunas)
    const totalTiketTerjual = await Pesanan.sum('jumlah', {
      where: { status_bayar: 'lunas' },
    });

    // Total artis
    const totalArtis = await Artis.count();

    // 5 event dengan tiket terjual terbanyak
    const topEvent = await Event.findAll({
      include: [
        { model: Artis, as: 'artis', attributes: ['nama'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas', 'kuota', 'terjual'] },
      ],
      order: [['tanggal', 'ASC']],
      limit: 5,
    });

    // 5 pesanan terbaru menunggu verifikasi
    const pesananTerbaru = await Pesanan.findAll({
      where: { status_bayar: 'pending' },
      include: [
        { model: User, as: 'user', attributes: ['nama', 'email'] },
        { model: Event, as: 'event', attributes: ['nama_event'] },
        { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    return res.status(200).json({
      success: true,
      data: {
        ringkasan: {
          total_pelanggan: totalPelanggan,
          total_artis: totalArtis,
          total_event: totalEvent,
          event_buka: eventBuka,
          event_tutup: eventTutup,
          total_pesanan: totalPesanan,
          pesanan_pending: pesananPending,
          pesanan_lunas: pesananLunas,
          pesanan_ditolak: pesananDitolak,
          total_tiket_terjual: totalTiketTerjual || 0,
          total_pendapatan: pendapatan || 0,
        },
        top_event: topEvent,
        pesanan_menunggu_verifikasi: pesananTerbaru,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
};

module.exports = { getDashboard };
