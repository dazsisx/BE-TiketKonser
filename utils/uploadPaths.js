const fs = require('fs');
const path = require('path');

/**
 * Satu-satunya sumber kebenaran lokasi folder upload.
 * Path dihitung dari lokasi file ini (bukan process.cwd()), sehingga upload,
 * static serving, dan penghapusan file selalu menunjuk folder yang sama
 * walaupun server dijalankan dari direktori lain.
 */
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const PUBLIC_PREFIX = '/uploads';

// Absolut di disk -> path publik yang disimpan di DB, mis. /uploads/event/172xxx.jpg
const toPublicPath = (absPath) => {
  const rel = path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
  return `${PUBLIC_PREFIX}/${rel}`;
};

/**
 * Path yang tersimpan di DB -> path absolut di disk.
 * Mengembalikan null kalau nilainya bukan file upload lokal yang valid:
 * kosong, URL eksternal, atau mencoba keluar dari folder uploads (../).
 * Format lama (tanpa slash depan, atau pakai backslash Windows) tetap dikenali.
 */
const resolveUploadFile = (stored) => {
  if (!stored || typeof stored !== 'string') return null;

  const normalized = stored.trim().replace(/\\/g, '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null; // http(s):, data:, C:/ dst.

  const trimmed = normalized.replace(/^\/+/, '');
  if (!trimmed.startsWith('uploads/')) return null;

  const abs = path.resolve(UPLOAD_ROOT, trimmed.slice('uploads/'.length));
  const rel = path.relative(UPLOAD_ROOT, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  return abs;
};

/**
 * Hapus file upload dengan aman. Tidak pernah melempar error:
 * file yang sudah tidak ada atau path yang tidak valid diabaikan.
 * @returns {Promise<boolean>} true jika ada file yang benar-benar terhapus
 */
const removeUploadFile = async (stored) => {
  const abs = resolveUploadFile(stored);
  if (!abs) return false;

  try {
    await fs.promises.unlink(abs);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Gagal menghapus file upload ${abs}: ${error.message}`);
    }
    return false;
  }
};

/**
 * Hapus file hanya jika tidak ada record lain yang masih memakainya.
 * isUsed: async () => boolean, dijalankan setelah operasi DB berhasil.
 */
const removeUploadFileIfUnused = async (stored, isUsed) => {
  if (!resolveUploadFile(stored)) return false;
  try {
    if (await isUsed()) return false;
  } catch (error) {
    console.warn(`Pengecekan pemakaian file gagal, file tidak dihapus: ${error.message}`);
    return false;
  }
  return removeUploadFile(stored);
};

module.exports = {
  UPLOAD_ROOT,
  PUBLIC_PREFIX,
  toPublicPath,
  resolveUploadFile,
  removeUploadFile,
  removeUploadFileIfUnused,
};