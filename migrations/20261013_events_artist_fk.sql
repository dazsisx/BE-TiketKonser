ALTER TABLE events
  DROP CONSTRAINT IF EXISTS fk_events_artist;

ALTER TABLE events
  ADD CONSTRAINT fk_events_artist
  FOREIGN KEY (artist_id)
  REFERENCES artis(id)
  ON DELETE RESTRICT;
