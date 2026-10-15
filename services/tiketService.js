// services/tiketService.js
// Penerbitan tiket per lembar + QR bertanda tangan (HMAC). Tanda tangan dihitung
// ulang saat QR dibaca, jadi tidak disimpan di database.
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Tiket } = require('../models');

const QR_PREFIX = 'DRSTAR';
const KODE_TIKET_REGEX = /^TK-[0-9A-F]{12}$/;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (UTC+7, tanpa DST)
const DAY_MS = 24 * 60 * 60 * 1000;

const getSecret = () => {
  const secret = process.env.QR_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('QR_SECRET belum diatur atau kurang dari 32 karakter.');
  }
  return secret;
};

// Dipanggil saat server start supaya salah konfigurasi ketahuan lebih awal
const assertQrSecret = () => {
  getSecret();
};

const generateKodeTiket = () => 'TK-' + crypto.randomBytes(6).toString('hex').toUpperCase();

const tandaTangan = (kode) =>
  crypto
    .createHmac('sha256', getSecret())
    .update(`tiket:${kode}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');

// Isi QR: DRSTAR.<kode>.<tanda tangan>
const buatIsiQr = (kode) => `${QR_PREFIX}.${kode}.${tandaTangan(kode)}`;

// Kembalikan kode tiket jika format dan tanda tangan benar, selain itu null.
// Belum memeriksa database: QR yang lolos di sini baru "asli", belum tentu "berlaku".
const bacaIsiQr = (isi) => {
  if (typeof isi !== 'string' || isi.length > 100) return null;
  const bagian = isi.trim().split('.');
  if (bagian.length !== 3 || bagian[0] !== QR_PREFIX) return null;

  const [, kode, tanda] = bagian;
  if (!KODE_TIKET_REGEX.test(kode)) return null;

  const diharapkan = Buffer.from(tandaTangan(kode));
  const diterima = Buffer.from(tanda);
  if (diharapkan.length !== diterima.length) return null;
  return crypto.timingSafeEqual(diharapkan, diterima) ? kode : null;
};

const buatGambarQr = (kode) =>
  QRCode.toDataURL(buatIsiQr(kode), { errorCorrectionLevel: 'M', margin: 2, width: 360 });

// Terbitkan tiket sesuai `pesanan.jumlah`. HARUS dipanggil di dalam transaksi
// yang sudah mengunci baris pesanan (lihat pembayaranService). Aman dipanggil
// berulang: nomor_urut yang sudah ada tidak dibuat lagi.
const terbitkanTiket = async (pesanan, transaction) => {
  if (!transaction) throw new Error('terbitkanTiket wajib dipanggil di dalam transaksi.');
  if (pesanan.status_bayar !== 'lunas') {
    throw new Error('Tiket hanya boleh diterbitkan untuk pesanan lunas.');
  }

  const ada = await Tiket.findAll({
    where: { pesanan_id: pesanan.id },
    order: [['nomor_urut', 'ASC']],
    transaction,
  });
  if (ada.length >= pesanan.jumlah) return ada;

  const terpakai = new Set(ada.map((t) => t.nomor_urut));
  const baru = [];
  for (let nomor = 1; nomor <= pesanan.jumlah; nomor += 1) {
    if (!terpakai.has(nomor)) {
      baru.push({ pesanan_id: pesanan.id, nomor_urut: nomor, kode: generateKodeTiket() });
    }
  }
  const dibuat = await Tiket.bulkCreate(baru, { transaction });
  return [...ada, ...dibuat].sort((a, b) => a.nomor_urut - b.nomor_urut);
};

// Daftar tiket sebuah pesanan untuk ditampilkan. Gambar QR hanya dibuat untuk
// tiket yang masih aktif; tiket terpakai/dibatalkan tidak membawa QR.
const daftarTiket = async (pesananId, { sertakanQr = true, sertakanKode = true } = {}) => {
  const rows = await Tiket.findAll({
    where: { pesanan_id: pesananId },
    order: [['nomor_urut', 'ASC']],
  });

  return Promise.all(
    rows.map(async (t) => ({
      nomor_urut: t.nomor_urut,
      ...(sertakanKode ? { kode: t.kode } : {}),
      status: t.status,
      digunakan_pada: t.digunakan_pada || null,
      qr_code: sertakanQr && t.status === 'aktif' ? await buatGambarQr(t.kode) : null,
    }))
  );
};

// Nomor hari menurut WIB (untuk aturan "hanya berlaku pada tanggal event")
const nomorHariWIB = (date) => Math.floor((new Date(date).getTime() + WIB_OFFSET_MS) / DAY_MS);

const formatTanggalWIB = (date) =>
  new Date(date).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

module.exports = {
  assertQrSecret,
  generateKodeTiket,
  buatIsiQr,
  bacaIsiQr,
  buatGambarQr,
  terbitkanTiket,
  daftarTiket,
  nomorHariWIB,
  formatTanggalWIB,
};