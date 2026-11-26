/**
 * Seed 6 konser yang sedang dijual di Loket (beserta artis dan kategori tiket).
 *
 * Sumber: artikel harga tiket resmi di loket.com/blog (nama, tanggal, venue, kategori, harga).
 * Yang TIDAK ada di Loket dan jadi data contoh: jam tayang (kecuali LaLaLa), kuota, deskripsi, bio artis.
 * Poster tidak disalin (hak cipta): image_url dikosongkan, upload lewat halaman admin.
 *
 * Aman dijalankan berulang kali (idempotent), pola sama seperti seedEvents.js:
 *  - Artis dicari berdasarkan nama, event berdasarkan (nama_event + artis),
 *    kategori tiket berdasarkan (event + nama_kelas). Yang sudah ada dilewati dan TIDAK diubah.
 *  - Tidak pernah menghapus, tidak memanggil sequelize.sync(), tidak mengubah skema.
 *  - Default-nya DRY RUN. Tambahkan --apply untuk menulis.
 *  - Satu transaksi: gagal di tengah jalan = tidak ada yang tersimpan.
 *
 * Pemakaian (dari folder BE):
 *   node scripts/seedLoketEvents.js            # dry run
 *   node scripts/seedLoketEvents.js --apply    # tulis ke Supabase
 */
const { guessKota } = require('../utils/kotaEvent');

const SEED_DATA = [
  {
    artis: { nama: "D'MASIV", genre: 'Pop Rock', bio: "Band pop rock Indonesia. (data contoh)" },
    event: {
      nama_event: "D'MASIV Asia Home Run - Indonesia",
      deskripsi: "Konser tunggal D'MASIV di Jakarta dalam rangkaian Asia Home Run. (data contoh)",
      tanggal: '2026-12-05T19:00:00+07:00',
      lokasi: 'Tennis Indoor Senayan, Jakarta',
    },
    kategori: [
      { nama_kelas: 'Tribune', harga: 350000, kuota: 400 },
      { nama_kelas: 'Festival Sendiri', harga: 325000, kuota: 700 },
      { nama_kelas: 'Platinum', harga: 500000, kuota: 250 },
      { nama_kelas: 'Festival Berdua', harga: 600000, kuota: 200 },
      { nama_kelas: 'Diamond', harga: 850000, kuota: 120 },
      { nama_kelas: 'Festival Berempat', harga: 1000000, kuota: 100 },
    ],
  },
  {
    artis: { nama: 'Boyz II Men', genre: 'R&B', bio: 'Grup vokal R&B legendaris asal Amerika Serikat. (data contoh)' },
    event: {
      nama_event: 'Boyz II Men + Dewa19 Feat Ari Lasso Virzha Live in Jakarta',
      deskripsi: 'Satu panggung Boyz II Men dan Dewa19 feat Ari Lasso & Virzha di Jakarta. (data contoh)',
      tanggal: '2026-12-09T19:30:00+07:00',
      lokasi: 'Indonesia Arena, Jakarta',
    },
    kategori: [
      { nama_kelas: 'Pearl', harga: 300000, kuota: 300 },
      { nama_kelas: 'Bronze', harga: 500000, kuota: 300 },
      { nama_kelas: 'Silver', harga: 750000, kuota: 400 },
      { nama_kelas: 'Gold', harga: 1000000, kuota: 400 },
      { nama_kelas: 'Festival', harga: 1750000, kuota: 500 },
      { nama_kelas: 'Platinum', harga: 2500000, kuota: 200 },
      { nama_kelas: 'Diamond', harga: 3250000, kuota: 150 },
      { nama_kelas: 'VIP', harga: 5000000, kuota: 80 },
      { nama_kelas: 'VIP Box', harga: 7500000, kuota: 40 },
    ],
  },
  {
    artis: { nama: 'BIGBANG', genre: 'K-Pop', bio: 'Grup K-Pop asal Korea Selatan. (data contoh)' },
    event: {
      nama_event: 'BIGBANG 2026-2027 WORLD TOUR <XX : COSMOS> IN JAKARTA',
      deskripsi: 'Tur dunia BIGBANG singgah di Jakarta International Stadium. (data contoh)',
      tanggal: '2027-01-16T19:00:00+07:00',
      lokasi: 'Jakarta International Stadium (JIS), Jakarta',
    },
    kategori: [
      { nama_kelas: 'CAT 7 A & B', harga: 1550000, kuota: 800 },
      { nama_kelas: 'CAT 6 A & B', harga: 1850000, kuota: 800 },
      { nama_kelas: 'CAT 5 A & B', harga: 2250000, kuota: 800 },
      { nama_kelas: 'CAT 4', harga: 2550000, kuota: 600 },
      { nama_kelas: 'CAT 3', harga: 2850000, kuota: 600 },
      { nama_kelas: 'CAT 2', harga: 3750000, kuota: 500 },
      { nama_kelas: 'CAT 1 A & B', harga: 4750000, kuota: 400 },
      { nama_kelas: 'Gold VIP', harga: 5500000, kuota: 200 },
      { nama_kelas: 'Diamond VIP', harga: 6000000, kuota: 150 },
      { nama_kelas: 'Ultimate VIP', harga: 6500000, kuota: 100 },
    ],
  },
  {
    artis: { nama: 'Olivia Dean', genre: 'Soul', bio: 'Penyanyi soul-pop asal Inggris, headliner LaLaLa Festival 2027. (data contoh)' },
    event: {
      nama_event: 'LaLaLa Festival Jakarta 2027',
      deskripsi: 'Festival musik dengan Olivia Dean, JUNGLE, dan St. Vincent sebagai headliner. (data contoh)',
      tanggal: '2027-01-17T15:00:00+07:00', // Loket: early entry harus masuk sebelum 17.00 WIB
      lokasi: 'ICE BSD City, Tangerang',
    },
    kategori: [
      { nama_kelas: 'Early Entry', harga: 1550000, kuota: 1500 },
      { nama_kelas: 'General Admission', harga: 1850000, kuota: 4000 },
      { nama_kelas: 'VIP', harga: 2850000, kuota: 600 },
      { nama_kelas: 'VVIP Group of Six', harga: 30000000, kuota: 20 },
    ],
  },
  {
    artis: { nama: 'ENHYPEN', genre: 'K-Pop', bio: 'Boy group K-Pop asal Korea Selatan. (data contoh)' },
    event: {
      nama_event: "ENHYPEN WORLD TOUR 'BLOOD SAGA' IN JAKARTA",
      deskripsi: 'Konser ENHYPEN World Tour Blood Saga di Jakarta International Stadium. (data contoh)',
      tanggal: '2027-01-23T18:00:00+07:00',
      lokasi: 'Jakarta International Stadium (JIS), Jakarta',
    },
    kategori: [
      { nama_kelas: 'CAT 7 A & B', harga: 1450000, kuota: 800 },
      { nama_kelas: 'CAT 6 A & B', harga: 1850000, kuota: 800 },
      { nama_kelas: 'CAT 5', harga: 2250000, kuota: 700 },
      { nama_kelas: 'CAT 4', harga: 2750000, kuota: 600 },
      { nama_kelas: 'CAT 3', harga: 2950000, kuota: 600 },
      { nama_kelas: 'CAT 2 A, B, C', harga: 3250000, kuota: 600 },
      { nama_kelas: 'CAT 1', harga: 3450000, kuota: 400 },
      { nama_kelas: 'VIP A & B', harga: 3650000, kuota: 300 },
    ],
  },
  {
    artis: { nama: 'Westlife', genre: 'Pop', bio: 'Boy band pop asal Irlandia. (data contoh)' },
    event: {
      nama_event: 'Westlife 25 - The Anniversary World Tour in Jakarta',
      deskripsi: 'Perayaan 25 tahun Westlife di Gelora Bung Karno. (data contoh)',
      tanggal: '2027-01-23T19:30:00+07:00',
      lokasi: 'Gelora Bung Karno, Jakarta',
    },
    kategori: [
      { nama_kelas: 'CAT 6 A & B', harga: 850000, kuota: 1000 },
      { nama_kelas: 'CAT 5 A & B', harga: 1250000, kuota: 1000 },
      { nama_kelas: 'CAT 4 A & B', harga: 1450000, kuota: 900 },
      { nama_kelas: 'CAT 3 A & B', harga: 1850000, kuota: 900 },
      { nama_kelas: 'CAT 2 A & B', harga: 2250000, kuota: 700 },
      { nama_kelas: 'CAT 1 A & B', harga: 2500000, kuota: 500 },
      { nama_kelas: 'VIP Package', harga: 2750000, kuota: 200 },
    ],
  },
];

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
              { ...item.event, kota: guessKota(item.event.lokasi, { segmenAkhir: true }), artist_id: artis.id, image_url: null, status: 'aktif' },
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