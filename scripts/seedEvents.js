/**
 * Seed 5 event contoh (beserta artis dan kategori tiket).
 *
 * Aman dijalankan berulang kali (idempotent):
 *  - Artis dicari berdasarkan nama, event berdasarkan (nama_event + artis),
 *    kategori tiket berdasarkan (event + nama_kelas). Yang sudah ada dilewati
 *    dan TIDAK diubah, jadi edit manual admin (harga, kuota, status) tidak tertimpa.
 *  - Tidak pernah menghapus, tidak memanggil sequelize.sync(), tidak mengubah skema.
 *  - Default-nya DRY RUN (hanya membaca dan melaporkan). Tambahkan --apply untuk menulis.
 *  - Semua penulisan dalam satu transaksi: gagal di tengah jalan = tidak ada yang tersimpan.
 *  - Menolak berjalan saat NODE_ENV=production kecuali ada --allow-production.
 *
 * Pemakaian:
 *   node scripts/seedEvents.js            # dry run
 *   node scripts/seedEvents.js --apply    # tulis ke database
 */
const SEED_DATA = [
  {
    artis: { nama: 'Nara Senja', genre: 'Pop', bio: 'Penyanyi pop dengan nuansa akustik hangat. (data contoh)' },
    event: {
      nama_event: 'Senja di Senayan',
      deskripsi: 'Konser pop akustik di bawah langit senja Jakarta. (data contoh)',
      tanggal: '2027-02-20T19:00:00+07:00',
      lokasi: 'Istora Senayan, Jakarta',
    },
    kategori: [
      { nama_kelas: 'Festival', harga: 350000, kuota: 800 },
      { nama_kelas: 'CAT 1', harga: 650000, kuota: 300 },
      { nama_kelas: 'VIP', harga: 1250000, kuota: 100 },
    ],
  },
  {
    artis: { nama: 'Rimba Raya', genre: 'Rock', bio: 'Band rock alternatif asal Bandung. (data contoh)' },
    event: {
      nama_event: 'Rimba Raya Live in Bandung',
      deskripsi: 'Malam penuh distorsi dan koor bersama Rimba Raya. (data contoh)',
      tanggal: '2027-03-13T19:30:00+07:00',
      lokasi: 'Sasana Budaya Ganesha, Bandung',
    },
    kategori: [
      { nama_kelas: 'Festival', harga: 300000, kuota: 600 },
      { nama_kelas: 'Tribun', harga: 500000, kuota: 250 },
      { nama_kelas: 'VIP', harga: 950000, kuota: 80 },
    ],
  },
  {
    artis: { nama: 'Laras Dewi', genre: 'Jazz', bio: 'Vokalis jazz dengan sentuhan musik tradisi. (data contoh)' },
    event: {
      nama_event: 'Malam Jazz Jogja',
      deskripsi: 'Pertunjukan jazz intim dengan sentuhan gamelan. (data contoh)',
      tanggal: '2027-04-17T20:00:00+07:00',
      lokasi: 'Taman Budaya Yogyakarta',
    },
    kategori: [
      { nama_kelas: 'Reguler', harga: 250000, kuota: 400 },
      { nama_kelas: 'Premium', harga: 500000, kuota: 150 },
      { nama_kelas: 'VIP', harga: 850000, kuota: 50 },
    ],
  },
  {
    artis: { nama: 'Bahari Beat', genre: 'Electronic', bio: 'Duo musik elektronik dengan set live yang energik. (data contoh)' },
    event: {
      nama_event: 'Bahari Beat Night Surabaya',
      deskripsi: 'Pesta musik elektronik semalam suntuk di Surabaya. (data contoh)',
      tanggal: '2027-05-22T20:00:00+07:00',
      lokasi: 'Grand City Convention Hall, Surabaya',
    },
    kategori: [
      { nama_kelas: 'Early Bird', harga: 275000, kuota: 500 },
      { nama_kelas: 'Reguler', harga: 400000, kuota: 700 },
      { nama_kelas: 'VIP', harga: 900000, kuota: 120 },
    ],
  },
  {
    artis: { nama: 'Suara Pantai', genre: 'Indie', bio: 'Kolektif indie folk yang lahir dari pesisir. (data contoh)' },
    event: {
      nama_event: 'Suara Pantai Sunset Session',
      deskripsi: 'Sesi musik indie saat matahari terbenam di tepi pantai. (data contoh)',
      tanggal: '2027-06-12T16:30:00+07:00',
      lokasi: 'Pantai Seminyak, Bali',
    },
    kategori: [
      { nama_kelas: 'General', harga: 325000, kuota: 500 },
      { nama_kelas: 'Beach Club', harga: 750000, kuota: 150 },
      { nama_kelas: 'VIP', harga: 1500000, kuota: 60 },
    ],
  },
];

/**
 * @param {object} deps  { sequelize, Artis, Event, KategoriTiket }
 * @param {object} opts  { apply: boolean, log: function }
 * @returns {Promise<{artis:number, event:number, kategori:number, skipped:number}>}
 */
const seedEvents = async ({ sequelize, Artis, Event, KategoriTiket }, { apply = false, log = console.log } = {}) => {
  const stats = { artis: 0, event: 0, kategori: 0, skipped: 0 };
  const verb = apply ? 'DIBUAT' : 'AKAN DIBUAT';

  const t = await sequelize.transaction();
  try {
    for (const item of SEED_DATA) {
      let artis = await Artis.findOne({ where: { nama: item.artis.nama }, transaction: t });
      if (artis) {
        stats.skipped += 1;
        log(`  = artis sudah ada: ${item.artis.nama}`);
      } else {
        stats.artis += 1;
        log(`  + artis ${verb}: ${item.artis.nama}`);
        // Saat dry run artis tidak ditulis, jadi tidak ada id; event/kategori ikut dianggap baru
        artis = apply ? await Artis.create(item.artis, { transaction: t }) : null;
      }

      let event = artis
        ? await Event.findOne({
            where: { nama_event: item.event.nama_event, artist_id: artis.id },
            transaction: t,
          })
        : null;

      if (event) {
        stats.skipped += 1;
        log(`  = event sudah ada: ${item.event.nama_event} (data tidak diubah)`);
      } else {
        stats.event += 1;
        log(`  + event ${verb}: ${item.event.nama_event} — ${item.event.tanggal}`);
        event = apply
          ? await Event.create(
              { ...item.event, artist_id: artis.id, image_url: null, status: 'aktif' },
              { transaction: t }
            )
          : null;
      }

      for (const kat of item.kategori) {
        const ada = event
          ? await KategoriTiket.findOne({
              where: { event_id: event.id, nama_kelas: kat.nama_kelas },
              transaction: t,
            })
          : null;

        if (ada) {
          stats.skipped += 1;
          log(`      = kategori sudah ada: ${kat.nama_kelas}`);
        } else {
          stats.kategori += 1;
          log(`      + kategori ${verb}: ${kat.nama_kelas} (Rp${kat.harga}, kuota ${kat.kuota})`);
          if (apply) {
            await KategoriTiket.create({ ...kat, event_id: event.id, terjual: 0 }, { transaction: t });
          }
        }
      }
    }

    if (apply) await t.commit();
    else await t.rollback();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  return stats;
};

const main = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  if (process.env.NODE_ENV === 'production' && !args.includes('--allow-production')) {
    console.error('NODE_ENV=production: seed dibatalkan. Tambahkan --allow-production jika memang disengaja.');
    process.exit(1);
  }

  const models = require('../models'); // memuat dotenv + koneksi
  try {
    await models.sequelize.authenticate();
    console.log(apply ? 'MODE APPLY: data akan ditulis.\n' : 'MODE DRY RUN: tidak ada data yang ditulis (pakai --apply untuk menulis).\n');

    const stats = await seedEvents(models, { apply });

    console.log(
      `\nRingkasan: artis baru ${stats.artis}, event baru ${stats.event}, kategori baru ${stats.kategori}, dilewati ${stats.skipped}.` +
        (apply ? '' : ' (dry run, belum ditulis)')
    );
  } catch (error) {
    console.error('Seed gagal, tidak ada perubahan yang disimpan:', error.message);
    process.exitCode = 1;
  } finally {
    await models.sequelize.close();
  }
};

if (require.main === module) main();

module.exports = { SEED_DATA, seedEvents };