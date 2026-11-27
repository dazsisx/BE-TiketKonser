# Sinkronisasi Admin & Admin Offline dengan halaman User

## Urutan pemasangan
1. Jalankan `migrations/20261126_ticket_area_venue_layout.sql` di Supabase (SQL editor). Hanya menambah kolom
   `kategori_tiket.area` dan `events.venue_layout` (bila belum ada); data lama tidak diubah. Aman diulang.
   **Wajib sebelum backend baru dijalankan**: tanpa kolom `area`, `GET /api/event` akan error.
2. Restart backend. Tidak ada tabel baru.

## Perubahan API
- `POST/PUT /api/event`: menerima `venue_layout` (`arena|stadium|theater|club`, kosong = otomatis) dan `status`
  (`draft|aktif|ditutup|selesai`). Sebelumnya `venue_layout` diam-diam diabaikan. `tanggal` tanpa zona waktu
  (mis. `2026-12-20T19:00`) kini dibaca sebagai WIB, bukan zona waktu server.
- `POST/PUT /api/kategori-tiket`: menerima `area` (`lounge|pit|balkon|sayap|festival`, kosong = otomatis).
  Satu area hanya untuk satu kategori per event (409 bila bentrok). Update kuota kini dalam transaksi + row lock.
- `POST /api/pesanan` (online): memakai aturan penjualan yang sama dengan offline (`assertEventOpenForSale`),
  sehingga event yang sudah lewat tidak bisa dibeli online.
- `GET /api/pesanan` (admin): menyertakan `petugas`, `event.lokasi`, `kategori_tiket.area`.
- `GET /api/dashboard`: `top_event` berisi acara mendatang saja dan membawa `poster`.
