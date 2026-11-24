# Batch 01 — Event musik November–Desember 2026

Paket ini menyiapkan 15 event kandidat untuk ditambahkan ke database. Semua data lama tetap dipertahankan.

## Isi paket
- `verified-events-nov-dec-2026.json`: 15 event, 68 kategori tiket.
- `../scripts/seedVerifiedEvents.js`: seeder idempotent, default DRY RUN.

## Batas data
- Periode: 23 November–31 Desember 2026.
- Nama kategori dan harga tiket diambil dari halaman sumber yang dicantumkan pada `event.source_url`.
- Kuota resmi tidak tersedia secara konsisten. Script menggunakan kuota simulasi 100 per kategori. Ini bukan jumlah seat resmi dan wajib disesuaikan sebelum penjualan nyata.
- Seat map fisik tidak dibuat dari asumsi. Kategori seperti CAT, Festival, VIP, Standing, dan Seating disimpan sebagai kategori tiket; layout seat harus diverifikasi terhadap denah resmi venue/promotor.
- Event yang sudah ada dicocokkan dengan nama event, tanggal, dan lokasi. Jika ditemukan, seluruh item dilewati; tidak mengubah poster, harga, kuota, kategori, artis, atau event lama.
- Script tidak menghapus data, tidak menjalankan `sequelize.sync()`, dan seluruh penulisan menggunakan satu transaksi.

## Menjalankan
Dari folder backend:

```bash
node scripts/seedVerifiedEvents.js
```

Perintah di atas hanya DRY RUN dan tidak menyimpan perubahan.

Setelah meninjau output dan memastikan migration `20261123_add_event_category.sql` sudah diterapkan:

```bash
node scripts/seedVerifiedEvents.js --apply
```

Jangan jalankan `--apply` ke database production tanpa backup dan persetujuan eksplisit pemilik database.

## Pemeriksaan
- JSON valid.
- Semua 15 event memiliki tanggal dalam periode target, sumber, poster URL HTTPS, dan minimal satu kategori tiket dengan harga.
- Semua kategori tiket memakai kuota simulasi 100 ketika di-seed.
- File `.env`, kredensial, dan folder `node_modules` tidak disertakan dalam patch.
