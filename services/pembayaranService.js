// services/pembayaranService.js
// Satu-satunya tempat status pembayaran pesanan berubah. Dipakai verifikasi admin
// sekarang, dan nanti oleh webhook payment gateway (Midtrans) setelah tanda
// tangan notifikasinya diverifikasi. Frontend tidak pernah memanggil ini.
const { sequelize, Pesanan, KategoriTiket } = require('../models');
const { terbitkanTiket } = require('./tiketService');

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const dalamTransaksi = (transaction, fn) =>
  transaction ? fn(transaction) : sequelize.transaction(fn);

// Tandai pesanan lunas dan terbitkan tiketnya, atomik dan idempoten.
// Baris pesanan dikunci (FOR UPDATE), sehingga dua pemanggil bersamaan
// (klik ganda admin, webhook terkirim ulang) diproses bergantian dan hanya satu
// yang mengubah status. Pemanggil kedua melihat `sudahLunas: true`.
const konfirmasiLunas = (pesananId, { transaction } = {}) =>
  dalamTransaksi(transaction, async (t) => {
    const pesanan = await Pesanan.findByPk(pesananId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!pesanan) throw httpError(404, 'Pesanan tidak ditemukan.');

    if (pesanan.status_bayar === 'lunas') {
      const tiket = await terbitkanTiket(pesanan, t); // melengkapi jika belum ada
      return { pesanan, tiket, sudahLunas: true };
    }
    if (pesanan.status_bayar !== 'pending') {
      throw httpError(400, 'Pesanan ini sudah diverifikasi sebelumnya.');
    }

    await pesanan.update({ status_bayar: 'lunas' }, { transaction: t });
    const tiket = await terbitkanTiket(pesanan, t);
    return { pesanan, tiket, sudahLunas: false };
  });

// Tutup pesanan yang belum dibayar ('ditolak' atau 'kadaluarsa') dan kembalikan kuota.
const tutupTanpaBayar = (pesananId, statusAkhir, { transaction } = {}) => {
  if (!['ditolak', 'kadaluarsa'].includes(statusAkhir)) {
    throw new Error('statusAkhir harus "ditolak" atau "kadaluarsa".');
  }

  return dalamTransaksi(transaction, async (t) => {
    const pesanan = await Pesanan.findByPk(pesananId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!pesanan) throw httpError(404, 'Pesanan tidak ditemukan.');
    if (pesanan.status_bayar !== 'pending') {
      throw httpError(400, 'Pesanan ini sudah diverifikasi sebelumnya.');
    }

    const kategori = await KategoriTiket.findByPk(pesanan.kategori_tiket_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (kategori) {
      await kategori.update(
        { terjual: Math.max(0, kategori.terjual - pesanan.jumlah) },
        { transaction: t }
      );
    }

    await pesanan.update({ status_bayar: statusAkhir }, { transaction: t });
    return { pesanan };
  });
};

module.exports = { konfirmasiLunas, tutupTanpaBayar };