/**
 * Seed event musik terverifikasi dari sumber tiket/publikasi.
 * Default DRY RUN. Jalankan dengan --apply untuk menulis.
 * Tidak menghapus/mengubah event lama; duplikat dicocokkan dengan nama+tanggal+lokasi.
 * Kuota tiket adalah kuota SIMULASI 100 per kategori karena kuota resmi tidak tersedia
 * secara konsisten. Jangan anggap ini sebagai kapasitas/seatplan resmi. Sesuaikan di admin
 * sebelum penjualan sungguhan. Event yang sudah ada dilewati seluruhnya tanpa mengubah
 * poster, kategori, harga, kuota, atau data event lama.
 */
const { guessKota } = require('../utils/kotaEvent');
const fs = require('fs');
const path = require('path');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/verified-events-nov-dec-2026.json'), 'utf8'));
const DEMO_QUOTA = 100;
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sameDay = (a, b) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

async function seedVerifiedEvents(models, { apply = false, log = console.log } = {}) {
  const { sequelize, Artis, Event, KategoriTiket } = models;
  const stats = { eventsCreated: 0, artistsCreated: 0, categoriesCreated: 0, skipped: 0 };
  const transaction = await sequelize.transaction();
  try {
    for (const item of DATA) {
      // Cek event terlebih dahulu agar event lama tidak memicu pembuatan artis/kategori baru.
      const possible = await Event.findAll({ where: { nama_event: item.event.nama_event }, transaction });
      const existing = possible.find((row) => sameDay(row.tanggal, item.event.tanggal) && norm(row.lokasi) === norm(item.event.lokasi));
      if (existing) {
        stats.skipped += 1;
        log(`= Lewati event yang sudah ada (tidak diubah): ${item.event.nama_event}`);
        continue;
      }

      let artist = await Artis.findOne({ where: { nama: item.artis.nama }, transaction });
      if (!artist && apply) {
        artist = await Artis.create(item.artis, { transaction });
        stats.artistsCreated += 1;
      } else if (!artist) {
        stats.artistsCreated += 1;
      }

      let event = null;
      stats.eventsCreated += 1;
      log(`+ ${apply ? 'Buat' : 'Akan dibuat'}: ${item.event.nama_event} (${item.event.tanggal})`);
      if (apply) {
        const { source_url, ...eventFields } = item.event;
        event = await Event.create({
          ...eventFields,
          kota: guessKota(eventFields.lokasi, { segmenAkhir: true }),
          artist_id: artist.id,
          status: 'aktif',
        }, { transaction });
      }

      if (!event) {
        if (!apply) {
          stats.categoriesCreated += item.kategori.length;
          log(`  + ${item.kategori.length} kategori tiket (dry run)`);
        }
        continue;
      }

      for (const ticket of item.kategori) {
        const found = await KategoriTiket.findOne({ where: { event_id: event.id, nama_kelas: ticket.nama_kelas }, transaction });
        if (found) {
          stats.skipped += 1;
          continue;
        }
        stats.categoriesCreated += 1;
        if (apply) await KategoriTiket.create({
          ...ticket,
          event_id: event.id,
          kuota: DEMO_QUOTA,
          terjual: 0,
        }, { transaction });
      }
    }

    if (apply) await transaction.commit();
    else await transaction.rollback();
    return stats;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (process.env.NODE_ENV === 'production' && !args.includes('--allow-production')) {
    throw new Error('Seed dibatalkan pada production tanpa --allow-production.');
  }
  const models = require('../models');
  try {
    await models.sequelize.authenticate();
    console.log(apply ? 'MODE APPLY: database akan ditulis.' : 'MODE DRY RUN: tidak ada perubahan database.');
    console.log(`Data event yang disiapkan: ${DATA.length}`);
    const result = await seedVerifiedEvents(models, { apply });
    console.log('\nRingkasan:', result);
  } finally {
    await models.sequelize.close();
  }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { DATA, seedVerifiedEvents };
