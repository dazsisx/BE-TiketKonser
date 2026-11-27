// Satu-satunya sumber daftar denah venue di backend (kolom events.venue_layout).
// Harus searah dengan key LAYOUTS di FE (utils/venueLayouts.ts): arena | stadium | theater | club.
// NULL = otomatis: FE menebak denah dari teks `lokasi`.
const VENUE_LAYOUTS = [
  { key: 'arena', label: 'Arena' },
  { key: 'stadium', label: 'Stadion' },
  { key: 'theater', label: 'Teater' },
  { key: 'club', label: 'Club / Live House' },
];

const VENUE_LAYOUT_KEYS = VENUE_LAYOUTS.map((l) => l.key);

/** Terima key ("theater") atau label ("Teater"); kembalikan key baku atau null. Kosong/tidak dikenal -> null. */
function resolveVenueLayout(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  const hit = VENUE_LAYOUTS.find((l) => l.key === v || l.label.toLowerCase() === v);
  return hit ? hit.key : null;
}

module.exports = { VENUE_LAYOUTS, VENUE_LAYOUT_KEYS, resolveVenueLayout };
