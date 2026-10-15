const { Tiket, Pesanan, Event, KategoriTiket, User } = require('../models');
const { bacaIsiQr, nomorHariWIB, formatTanggalWIB } = require('../services/tiketService');

// Semua hasil validasi dikembalikan dengan kode `hasil` yang tetap, supaya FE pemindai
// cukup membaca `hasil` dan tidak menebak dari teks pesan.
const HASIL = {
  valid: { http: 200, success: true },
  tidak_valid: { http: 404, success: false, pesan: 'QR tidak valid.' },
  belum_lunas: { http: 409, success: false, pesan: 'Pesanan belum lunas. Tiket tidak dapat digunakan.' },
  dibatalkan: { http: 409, success: false, pesan: 'Tiket ini sudah dibatalkan.' },
  sudah_digunakan: { http: 409, success: false, pesan: 'Tiket sudah digunakan.' },
  bukan_hari_event: { http: 409, success: false, pesan: 'Tiket hanya berlaku pada tanggal event.' },
};

const kirim = (res, hasil, { pesan, data } = {}) => {
  const def = HASIL[hasil];
  return res.status(def.http).json({
    success: def.success,
    hasil,
    message: pesan || def.pesan || 'Tiket valid.',
    ...(data ? { data } : {}),
  });
};

const ringkasan = (tiket, pesanan) => ({
  nomor_urut: tiket.nomor_urut,
  dari: pesanan.jumlah,
  status: tiket.status,
  digunakan_pada: tiket.digunakan_pada || null,
  kode_booking: pesanan.kode_tiket,
  nama_pembeli: (pesanan.user && pesanan.user.nama) || pesanan.nama_pembeli || null,
  order_type: pesanan.order_type || 'online',
  event: pesanan.event
    ? { nama_event: pesanan.event.nama_event, tanggal: pesanan.event.tanggal, lokasi: pesanan.event.lokasi }
    : null,
  kategori: pesanan.kategori_tiket ? pesanan.kategori_tiket.nama_kelas : null,
});

// @desc    Validasi QR tiket. mode "cek" hanya melihat, mode "gunakan" menandai terpakai.
// @route   POST /api/tiket/validasi   body: { qr, mode }
// @access  admin, admin_offline
const validasiTiket = async (req, res) => {
  try {
    const { qr } = req.body || {};
    const mode = (req.body && req.body.mode) || 'cek';
    if (!['cek', 'gunakan'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'mode harus "cek" atau "gunakan".' });
    }

    // 1) Tanda tangan: QR palsu ditolak tanpa menyentuh database
    const kode = bacaIsiQr(qr);
    if (!kode) return kirim(res, 'tidak_valid');

    // 2) Data resmi dari database
    const tiket = await Tiket.findOne({
      where: { kode },
      include: [
        {
          model: Pesanan,
          as: 'pesanan',
          include: [
            { model: Event, as: 'event', attributes: ['id', 'nama_event', 'tanggal', 'lokasi'] },
            { model: KategoriTiket, as: 'kategori_tiket', attributes: ['nama_kelas'] },
            { model: User, as: 'user', attributes: ['nama'] },
          ],
        },
      ],
    });
    if (!tiket || !tiket.pesanan) return kirim(res, 'tidak_valid'); // pesan sama dengan QR palsu

    const pesanan = tiket.pesanan;
    const data = () => ringkasan(tiket, pesanan);

    if (pesanan.status_bayar !== 'lunas') return kirim(res, 'belum_lunas');
    if (tiket.status === 'dibatalkan') return kirim(res, 'dibatalkan', { data: data() });
    if (tiket.status === 'terpakai') {
      return kirim(res, 'sudah_digunakan', {
        pesan: `Tiket sudah digunakan pada ${new Date(tiket.digunakan_pada).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
        })} WIB.`,
        data: data(),
      });
    }

    // 3) Hanya berlaku pada tanggal event (WIB)
    if (!pesanan.event || nomorHariWIB(new Date()) !== nomorHariWIB(pesanan.event.tanggal)) {
      return kirim(res, 'bukan_hari_event', {
        pesan: pesanan.event
          ? `Tiket hanya berlaku pada ${formatTanggalWIB(pesanan.event.tanggal)} (WIB).`
          : undefined,
        data: data(),
      });
    }

    if (mode === 'cek') return kirim(res, 'valid', { data: data() });

    // 4) Satu UPDATE bersyarat: hanya satu dari beberapa petugas yang memindai bersamaan
    //    yang mendapat affectedCount = 1. Sisanya 0 dan dijawab "sudah digunakan".
    const sekarang = new Date();
    const [diubah] = await Tiket.update(
      { status: 'terpakai', digunakan_pada: sekarang, digunakan_oleh: req.user.id },
      { where: { id: tiket.id, status: 'aktif' } }
    );

    if (diubah === 0) {
      const terbaru = await Tiket.findByPk(tiket.id);
      return kirim(res, terbaru && terbaru.status === 'dibatalkan' ? 'dibatalkan' : 'sudah_digunakan', {
        data: ringkasan(terbaru || tiket, pesanan),
      });
    }

    tiket.status = 'terpakai';
    tiket.digunakan_pada = sekarang;
    return kirim(res, 'valid', { pesan: 'Tiket valid. Silakan masuk.', data: data() });
  } catch (error) {
    console.error('validasiTiket error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

module.exports = { validasiTiket };