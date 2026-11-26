-- Kota tempat acara, dipakai filter lokasi di navbar FE.
-- NULL = belum diisi. Jalankan sekali di Supabase (SQL editor), aman diulang.
-- Setelah itu isi event lama dengan: node scripts/backfillKotaEvent.js (dry-run) lalu --apply.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS kota VARCHAR(80);

-- Filter di API membandingkan lower(kota), jadi indeksnya ikut lower().
CREATE INDEX IF NOT EXISTS idx_events_kota
  ON events (lower(kota));
