// scripts/backfillTiket.js
// Membuat tiket (satu per lembar) untuk pesanan LUNAS yang belum punya tiket lengkap.
//
//   node scripts/backfillTiket.js            -> dry-run: hanya melaporkan, tidak mengubah apa pun
//   node scripts/backfillTiket.js --apply    -> benar-benar membuat tiket
//
// Aman dijalankan berulang: pesanan yang sudah punya tiket lengkap dilewati.
require('dotenv').config();
const { sequelize, Pesanan, Tiket } = require('../models');
const { konfirmasiLunas } = require('../services/pembayaranService');

const apply = process.argv.includes('--apply');

(async () => {
  try {
    await sequelize.authenticate();

    const lunas = await Pesanan.findAll({
      where: { status_bayar: 'lunas' },
      attributes: ['id', 'kode_tiket', 'jumlah'],
      order: [['id', 'ASC']],
    });

    const kurang = [];
    for (const p of lunas) {
      const ada = await Tiket.count({ where: { pesanan_id: p.id } });
      if (ada < p.jumlah) kurang.push({ id: p.id, kode: p.kode_tiket, jumlah: p.jumlah, ada });
    }

    const tiketBaru = kurang.reduce((n, p) => n + (p.jumlah - p.ada), 0);
    console.log(`Pesanan lunas        : ${lunas.length}`);
    console.log(`Perlu dilengkapi     : ${kurang.length} pesanan (${tiketBaru} tiket baru)`);
    kurang.slice(0, 20).forEach((p) =>
      console.log(`  - pesanan #${p.id} ${p.kode}: ${p.ada}/${p.jumlah} tiket`)
    );

    if (!apply) {
      console.log('\nDRY-RUN: tidak ada perubahan. Jalankan dengan --apply untuk membuat tiket.');
      return;
    }

    let selesai = 0;
    for (const p of kurang) {
      // konfirmasiLunas mengunci pesanan dan hanya melengkapi tiket yang belum ada
      await konfirmasiLunas(p.id);
      selesai += 1;
    }
    console.log(`\nSelesai: ${selesai} pesanan dilengkapi tiketnya.`);
  } catch (error) {
    console.error('Backfill gagal:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();