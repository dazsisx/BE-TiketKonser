-- Tabel wishlist pelanggan. Server membuatnya otomatis lewat sequelize.sync(),
-- file ini disediakan untuk yang menjalankan migrasi manual di Supabase.
CREATE TABLE IF NOT EXISTS wishlist (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_user_event_unique ON wishlist (user_id, event_id);
CREATE INDEX IF NOT EXISTS wishlist_event_id_idx ON wishlist (event_id);
