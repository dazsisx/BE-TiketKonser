-- Jenis event untuk halaman kategori (Konser, Festival, Musik Live, Akustik).
-- NULL = belum dikategorikan. Jalankan sekali, aman diulang.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS kategori_event VARCHAR(30);

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS chk_events_kategori_event;

ALTER TABLE events
  ADD CONSTRAINT chk_events_kategori_event
  CHECK (kategori_event IS NULL OR kategori_event IN ('Konser', 'Festival', 'Musik Live', 'Akustik'));

CREATE INDEX IF NOT EXISTS idx_events_kategori_event
  ON events (kategori_event);
