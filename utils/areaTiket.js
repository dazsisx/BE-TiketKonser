// Satu-satunya sumber daftar area tiket di backend (kolom kategori_tiket.area).
// `key` HARUS sama dengan key GROUPS di FE (components/ui/VenueMap.tsx): lounge | pit | balkon | sayap | festival.
// Area menentukan di zona mana kategori tiket tampil pada denah venue halaman pembelian.
// NULL = otomatis: FE menebak zona dari kata kunci pada nama kategori (perilaku lama).
const AREA_TIKET = [
  { key: 'lounge', label: 'Lounge' },
  { key: 'pit', label: 'Front Pit' },
  { key: 'balkon', label: 'Balkon' },
  { key: 'sayap', label: 'Tribune / Sayap' },
  { key: 'festival', label: 'Festival' },
];

const AREA_KEYS = AREA_TIKET.map((a) => a.key);
const LABEL_BY_KEY = Object.fromEntries(AREA_TIKET.map((a) => [a.key, a.label]));

/** Terima key ("pit") atau label ("Front Pit"); kembalikan key baku atau null. Kosong/tidak dikenal -> null. */
function resolveAreaTiket(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  const hit = AREA_TIKET.find((a) => a.key === v || a.label.toLowerCase() === v);
  return hit ? hit.key : null;
}

module.exports = { AREA_TIKET, AREA_KEYS, LABEL_BY_KEY, resolveAreaTiket };
