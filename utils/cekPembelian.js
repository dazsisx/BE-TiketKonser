// Helper untuk cek pembelian tanpa login (verifikasi lewat OTP):
//   POST /api/pesanan/cek/kirim-otp
//   POST /api/pesanan/cek/verifikasi

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalisasiEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

// Samakan 0812xxx, +62812xxx, 62812xxx, dan 812xxx (spasi/tanda hubung diabaikan) menjadi 0812xxx
const normalisasiTelepon = (value) => {
  if (value === null || value === undefined) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('62')) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  return digits ? `0${digits}` : '';
};

const emailValid = (email) => email.length <= 150 && EMAIL_REGEX.test(email);
const teleponValid = (telepon) => telepon.length >= 9 && telepon.length <= 15;

// Kunci unik kontak untuk menyimpan & mencari OTP: "email:a@b.com" atau "tel:0812xxx"
const kunciKontak = ({ email, telepon }) => (email ? `email:${email}` : `tel:${telepon}`);

// Cocokkan kontak input dengan semua kontak yang tersimpan untuk pesanan ini:
// akun pembeli (online) dan data pembeli yang diisi petugas (offline).
const kontakCocok = (pesanan, { email, telepon }) => {
  if (email) {
    return [pesanan.user && pesanan.user.email, pesanan.email_pembeli].some(
      (kandidat) => kandidat && normalisasiEmail(kandidat) === email
    );
  }
  if (telepon) {
    return [pesanan.user && pesanan.user.no_telepon, pesanan.no_telepon_pembeli].some(
      (kandidat) => kandidat && normalisasiTelepon(kandidat) === telepon
    );
  }
  return false;
};

// Whitelist field yang boleh dilihat publik. Kontak pembeli sengaja tidak dikembalikan.
const formatHasilPembelian = (pesanan, tiket = []) => ({
  kode_tiket: pesanan.kode_tiket,
  status_bayar: pesanan.status_bayar,
  order_type: pesanan.order_type || 'online',
  jumlah: pesanan.jumlah,
  total_harga: Number(pesanan.total_harga),
  dibuat_pada: pesanan.createdAt || null,
  nama_pembeli: (pesanan.user && pesanan.user.nama) || pesanan.nama_pembeli || null,
  event: pesanan.event
    ? {
        id: pesanan.event.id,
        nama_event: pesanan.event.nama_event,
        tanggal: pesanan.event.tanggal,
        lokasi: pesanan.event.lokasi,
        status: pesanan.event.status,
      }
    : null,
  kategori: pesanan.kategori_tiket
    ? {
        nama_kelas: pesanan.kategori_tiket.nama_kelas,
        harga: Number(pesanan.kategori_tiket.harga),
      }
    : null,
  // true jika pelanggan sudah upload bukti bayar (status masih pending = menunggu verifikasi)
  bukti_bayar_terunggah: Boolean(pesanan.bukti_bayar),
  // Satu entri per tiket dengan QR sendiri. Hanya terisi untuk pesanan lunas.
  tiket: pesanan.status_bayar === 'lunas' ? tiket : [],
});

module.exports = {
  normalisasiEmail,
  normalisasiTelepon,
  emailValid,
  teleponValid,
  kunciKontak,
  kontakCocok,
  formatHasilPembelian,
};