// scripts/backfillKotaEvent.js
// Mengisi events.kota untuk event lama dengan menebak dari teks lokasi.
//
//   node scripts/backfillKotaEvent.js            -> dry-run (hanya menampilkan)
//   node scripts/backfillKotaEvent.js --apply    -> menulis ke database
//
// Hanya mengisi event yang kolom kotanya masih kosong; tidak menimpa isian admin.
// Tinjau dulu daftar dry-run: baris bertanda "~" memakai bagian setelah koma terakhir (kurang pasti),
// baris bertanda "?" tidak bisa ditebak dan perlu diisi manual lewat halaman admin.
// Prasyarat: migration 20261126_add_event_kota.sql sudah diterapkan.
require('dotenv').config();
const { Op } = require('sequelize');
const { sequelize, Event } = require('../models');
const { guessKota } = require('../utils/kotaEvent');

const apply = process.argv.includes('--apply');

(async () => {
  try {
    await sequelize.authenticate();
    const rows = await Event.findAll({
      where: { [Op.or]: [{ kota: null }, { kota: '' }] },
      order: [['id', 'ASC']],
    });

    let diisi = 0;
    let kurangPasti = 0;
    let manual = 0;

    for (const row of rows) {
      const pasti = guessKota(row.lokasi);
      const kota = pasti ?? guessKota(row.lokasi, { segmenAkhir: true });
      if (!kota) {
        manual += 1;
        console.log(`? #${row.id} ${row.nama_event} | lokasi: ${row.lokasi} -> (isi manual)`);
        continue;
      }
      if (pasti) diisi += 1;
      else kurangPasti += 1;
      console.log(`${pasti ? '+' : '~'} #${row.id} ${row.nama_event} | ${row.lokasi} -> ${kota}`);
      if (apply) await row.update({ kota });
    }

    console.log(
      `\nDiisi: ${diisi} | Kurang pasti (~): ${kurangPasti} | Perlu isi manual (?): ${manual} | Sudah berkota (dilewati): tidak dihitung`
    );
    if (!apply) console.log('DRY-RUN: tidak ada perubahan. Tambahkan --apply untuk menulis.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
