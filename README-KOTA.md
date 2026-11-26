# Kolom `events.kota`

Urutan pemasangan (dari folder BE):

1. Timpa file di zip ini ke project (`models/Event.js`, `controllers/eventController.js`, `utils/kotaEvent.js`,
   `scripts/*`, `migrations/20261126_add_event_kota.sql`).
2. Jalankan `migrations/20261126_add_event_kota.sql` di Supabase (SQL editor). Aman diulang.
   Alternatif: `DB_SYNC_ALTER=true` sekali saat start akan menambah kolom lewat model, tetapi indeks `idx_events_kota`
   tetap perlu dari file SQL.
3. `node scripts/backfillKotaEvent.js` (dry-run). Tinjau daftar: `+` pasti, `~` kurang pasti, `?` isi manual di admin.
4. `node scripts/backfillKotaEvent.js --apply`. Backup dulu bila ini database production.
5. Restart server.

API: `POST/PUT /api/event` menerima `kota` (kosong = ditebak dari lokasi). `GET /api/event?kota=jakarta` memfilter
(opsional, FE saat ini memfilter di client). `kota` ikut di semua response event.
