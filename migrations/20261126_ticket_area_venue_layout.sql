-- Sinkronisasi Admin dengan fitur User: area/zona tiket pada denah venue + kolom denah venue event.
-- Hanya MENAMBAH kolom/indeks. Tidak menghapus atau mengubah data yang ada. Aman diulang.
-- Jalankan sekali di Supabase (SQL editor) SEBELUM menjalankan backend versi ini.

-- Denah venue event (arena | stadium | theater | club). NULL = FE menebak dari events.lokasi.
-- Sudah ada di model sejak sebelumnya, tetapi belum punya file migration.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_layout VARCHAR(30);

-- Area/zona kategori tiket pada denah (lounge | pit | balkon | sayap | festival).
-- NULL = otomatis: FE menebak zona dari kata kunci pada nama_kelas (perilaku lama, data lama tidak berubah).
ALTER TABLE kategori_tiket
  ADD COLUMN IF NOT EXISTS area VARCHAR(30);

ALTER TABLE kategori_tiket
  DROP CONSTRAINT IF EXISTS chk_kategori_tiket_area;

ALTER TABLE kategori_tiket
  ADD CONSTRAINT chk_kategori_tiket_area
  CHECK (area IS NULL OR area IN ('lounge', 'pit', 'balkon', 'sayap', 'festival'));

-- Satu area hanya untuk satu kategori per event (denah menampilkan satu kategori per zona).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kategori_tiket_event_area
  ON kategori_tiket (event_id, area)
  WHERE area IS NOT NULL;
