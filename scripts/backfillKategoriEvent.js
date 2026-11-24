// scripts/backfillKategoriEvent.js
// Mengisi events.kategori_event untuk event hasil seed yang sudah ada (cocok lewat nama event).
//
//   node scripts/backfillKategoriEvent.js            -> dry-run
//   node scripts/backfillKategoriEvent.js --apply    -> menulis ke database
//
// Hanya mengisi event yang kategorinya masih kosong; tidak menimpa pilihan admin.
// Prasyarat: migration 20261123_add_event_category.sql sudah diterapkan.
require('dotenv').config();
const path = require('path');
const { sequelize, Event } = require('../models');
const { resolveKategoriEvent } = require('../utils/kategoriEvent');
const DATA = require(path.join(__dirname, '../data/verified-events-nov-dec-2026.json'));

const apply = process.argv.includes('--apply');

(async () => {
  try {
    await sequelize.authenticate();
    let diisi = 0;
    let lewat = 0;
    let tidakAda = 0;

    for (const item of DATA) {
      const label = resolveKategoriEvent(item.event.kategori_event);
      if (!label) continue;

      const rows = await Event.findAll({ where: { nama_event: item.event.nama_event } });
      if (!rows.length) {
        tidakAda += 1;
        console.log(`? Tidak ada di database: ${item.event.nama_event}`);
        continue;
      }
      for (const row of rows) {
        if (row.kategori_event) {
          lewat += 1;
          continue;
        }
        diisi += 1;
        console.log(`+ ${row.nama_event} -> ${label}`);
        if (apply) await row.update({ kategori_event: label });
      }
    }

    console.log(`\nDiisi: ${diisi} | Sudah berkategori (dilewati): ${lewat} | Tidak ditemukan: ${tidakAda}`);
    if (!apply) console.log('DRY-RUN: tidak ada perubahan. Tambahkan --apply untuk menulis.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
