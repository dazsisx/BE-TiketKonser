// Waktu acara selalu dipahami sebagai WIB (Asia/Jakarta, UTC+7, tanpa DST), sama dengan aturan
// penjualan (utils/eventSales.js) dan semua tampilan di FE. Input dari <input type="datetime-local">
// tidak membawa zona waktu ("2026-12-20T19:00"); tanpa normalisasi ini nilainya ditafsirkan memakai
// zona waktu SERVER, sehingga di server UTC acara jam 19.00 tersimpan sebagai 02.00 WIB keesokan harinya.

const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/**
 * Tambahkan offset WIB bila string tanggal-waktu belum memuat zona waktu.
 * String yang sudah punya zona (Z, +07:00, ...), objek Date, atau format lain dikembalikan apa adanya
 * agar validasi model tetap yang memutuskan.
 */
function normalizeTanggalWIB(value) {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (!NAIVE_DATETIME.test(v)) return value;
  const iso = v.replace(' ', 'T');
  const withSeconds = /T\d{2}:\d{2}$/.test(iso) ? `${iso}:00` : iso;
  return `${withSeconds}+07:00`;
}

module.exports = { normalizeTanggalWIB };
