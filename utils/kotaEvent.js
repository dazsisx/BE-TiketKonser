// Satu-satunya sumber aturan penulisan kota event di backend (kolom events.kota).
// Dipakai controller (create/update/filter), script backfill, dan seeder.
// Harus searah dengan FE-Tiket-Konser/utils/kota.ts supaya "Kota Bandung", "bandung", dan "BANDUNG"
// menjadi satu pilihan yang sama.

const MAX_LENGTH = 80;
const AWALAN = /^(kota administrasi|kota|kabupaten|kab\.?|dki)\s+/i;

// [kata kunci pada teks lokasi, nama kota]. Hanya nama yang tidak ambigu.
// Dipakai untuk menebak kota dari events.lokasi saat admin tidak mengisi kota.
const TEBAKAN = [
  ['jakarta', 'Jakarta'],
  ['gelora bung karno', 'Jakarta'],
  ['senayan', 'Jakarta'],
  ['istora', 'Jakarta'],
  ['jiexpo', 'Jakarta'],
  ['ancol', 'Jakarta'],
  ['bandung', 'Bandung'],
  ['surabaya', 'Surabaya'],
  ['yogyakarta', 'Yogyakarta'],
  ['jogja', 'Yogyakarta'],
  ['yogya', 'Yogyakarta'],
  ['semarang', 'Semarang'],
  ['malang', 'Malang'],
  ['medan', 'Medan'],
  ['makassar', 'Makassar'],
  ['bali', 'Bali'],
  ['denpasar', 'Bali'],
  ['badung', 'Bali'],
  ['bogor', 'Bogor'],
  ['depok', 'Depok'],
  ['tangerang', 'Tangerang'],
  ['bekasi', 'Bekasi'],
  ['surakarta', 'Surakarta'],
  ['solo', 'Surakarta'],
  ['palembang', 'Palembang'],
  ['balikpapan', 'Balikpapan'],
  ['samarinda', 'Samarinda'],
  ['batam', 'Batam'],
  ['manado', 'Manado'],
  ['pontianak', 'Pontianak'],
];

const TEBAKAN_REGEX = TEBAKAN.map(([kunci, kota]) => [new RegExp(`(^|[^a-z])${kunci}([^a-z]|$)`), kota]);

function judul(teks) {
  return teks
    .toLowerCase()
    .split(' ')
    .map((k) => (k ? k[0].toUpperCase() + k.slice(1) : k))
    .join(' ');
}

/** Rapikan tulisan kota: buang awalan "Kota/Kab./DKI", spasi ganda, huruf besar-kecil. Kosong -> null. */
function normalizeKota(value) {
  if (value === undefined || value === null) return null;
  const bersih = String(value).replace(AWALAN, '').replace(/\s+/g, ' ').trim();
  return bersih ? judul(bersih).slice(0, MAX_LENGTH) : null;
}

/**
 * Tebak kota dari teks lokasi. Kata kunci kota dikenal dicek dulu.
 * Dengan { segmenAkhir: true }, bila tidak ada yang cocok dan lokasi berformat "Venue, Kota",
 * bagian setelah koma terakhir dipakai (dipakai script backfill, hasilnya ditinjau dulu lewat dry-run).
 */
function guessKota(lokasi, { segmenAkhir = false } = {}) {
  const teks = String(lokasi ?? '').toLowerCase();
  if (!teks.trim()) return null;
  for (const [regex, kota] of TEBAKAN_REGEX) {
    if (regex.test(teks)) return kota;
  }
  if (segmenAkhir && teks.includes(',')) {
    return normalizeKota(String(lokasi).split(',').pop());
  }
  return null;
}

module.exports = { normalizeKota, guessKota, MAX_LENGTH };
