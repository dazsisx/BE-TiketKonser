// Satu-satunya sumber daftar kategori event di backend.
// slug dipakai di URL FE (/kategori/<slug>), label disimpan di kolom events.kategori_event.
const KATEGORI_EVENT = [
  { slug: 'konser', label: 'Konser' },
  { slug: 'festival', label: 'Festival' },
  { slug: 'musik-live', label: 'Musik Live' },
  { slug: 'akustik', label: 'Akustik' },
];

const LABELS = KATEGORI_EVENT.map((k) => k.label);

/** Terima slug ("musik-live") atau label ("Musik Live"); kembalikan label baku atau null. */
function resolveKategoriEvent(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  const hit = KATEGORI_EVENT.find((k) => k.slug === v || k.label.toLowerCase() === v);
  return hit ? hit.label : null;
}

module.exports = { KATEGORI_EVENT, LABELS, resolveKategoriEvent };
