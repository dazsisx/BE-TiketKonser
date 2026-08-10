# BE-TiketKonser — Backend REST API

Backend REST API untuk Aplikasi Pemesanan Tiket Konser berbasis Node.js + Express + MySQL.

## Tech Stack

- **Node.js** + **Express**
- **MySQL** + **Sequelize ORM**
- **JWT** untuk autentikasi
- **bcryptjs** untuk enkripsi password
- **Multer** untuk upload file
- **QRCode** untuk generate QR tiket

---

## Cara Menjalankan

### 1. Install dependencies
```bash
npm install
```

### 2. Setup database
Buat database MySQL:
```sql
CREATE DATABASE tiket_konser;
```

### 3. Konfigurasi .env
Edit file `.env` sesuaikan dengan konfigurasi MySQL kamu:
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_kamu
DB_NAME=tiket_konser
JWT_SECRET=tiketkonser_secret_key_2024
JWT_EXPIRES_IN=7d
```

### 4. Jalankan server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Tabel akan otomatis dibuat oleh Sequelize saat server pertama kali dijalankan.

---

## Struktur Folder

```
BE-TiketKonser/
├── app.js                        # Entry point
├── .env                          # Konfigurasi environment
├── config/
│   └── database.js               # Koneksi Sequelize
├── models/
│   ├── index.js                  # Relasi antar model
│   ├── User.js
│   ├── Artis.js
│   ├── Event.js
│   ├── KategoriTiket.js
│   └── Pesanan.js
├── controllers/
│   ├── authController.js
│   ├── artisController.js
│   ├── eventController.js
│   ├── kategoriTiketController.js
│   ├── pesananController.js
│   └── dashboardController.js
├── routes/
│   ├── authRoutes.js
│   ├── artisRoutes.js
│   ├── eventRoutes.js
│   ├── kategoriTiketRoutes.js
│   ├── pesananRoutes.js
│   └── dashboardRoutes.js
├── middleware/
│   ├── authMiddleware.js         # JWT protect, adminOnly, pelangganOnly
│   └── uploadMiddleware.js       # Multer upload
└── uploads/
    ├── artis/
    ├── event/
    └── bukti_bayar/
```

---

## ERD Relasi Database

```
users          → id, nama, email, password, no_telepon, role
artis          → id, nama, bio, foto, genre
events         → id, nama_event, deskripsi, tanggal, lokasi, poster, artis_id (FK), status
kategori_tiket → id, event_id (FK), nama_kelas, harga, kuota, terjual
pesanan        → id, user_id (FK), event_id (FK), kategori_tiket_id (FK), jumlah,
                  total_harga, status_bayar, bukti_bayar, kode_tiket, qr_code
```

---

## Daftar Endpoint API

### Auth
| Method | Endpoint             | Akses   | Keterangan            |
|--------|----------------------|---------|-----------------------|
| POST   | /api/auth/register   | Public  | Registrasi pelanggan  |
| POST   | /api/auth/login      | Public  | Login semua role      |
| GET    | /api/auth/profile    | Private | Lihat profil sendiri  |
| PUT    | /api/auth/profile    | Private | Update profil sendiri |

### Artis
| Method | Endpoint         | Akses  | Keterangan       |
|--------|------------------|--------|------------------|
| GET    | /api/artis       | Public | Semua artis      |
| GET    | /api/artis/:id   | Public | Detail artis     |
| POST   | /api/artis       | Admin  | Tambah artis     |
| PUT    | /api/artis/:id   | Admin  | Update artis     |
| DELETE | /api/artis/:id   | Admin  | Hapus artis      |

### Event
| Method | Endpoint              | Akses  | Keterangan                    |
|--------|-----------------------|--------|-------------------------------|
| GET    | /api/event            | Public | Semua event                   |
| GET    | /api/event/:id        | Public | Detail event + kategori tiket |
| POST   | /api/event            | Admin  | Tambah event                  |
| PUT    | /api/event/:id        | Admin  | Update event                  |
| DELETE | /api/event/:id        | Admin  | Hapus event                   |
| PATCH  | /api/event/:id/tutup  | Admin  | Tutup penjualan tiket         |
| PATCH  | /api/event/:id/buka   | Admin  | Buka kembali penjualan tiket  |

### Kategori Tiket
| Method | Endpoint                           | Akses  | Keterangan                    |
|--------|------------------------------------|--------|-------------------------------|
| GET    | /api/kategori-tiket/event/:eventId | Public | Kategori tiket per event      |
| POST   | /api/kategori-tiket                | Admin  | Tambah kategori tiket         |
| PUT    | /api/kategori-tiket/:id            | Admin  | Update kategori tiket         |
| DELETE | /api/kategori-tiket/:id            | Admin  | Hapus kategori tiket          |

### Pesanan
| Method | Endpoint                        | Akses     | Keterangan                  |
|--------|---------------------------------|-----------|-----------------------------|
| GET    | /api/pesanan                    | Admin     | Semua pesanan               |
| GET    | /api/pesanan/riwayat            | Pelanggan | Riwayat pesanan sendiri     |
| GET    | /api/pesanan/:id                | Pelanggan | Detail pesanan              |
| POST   | /api/pesanan                    | Pelanggan | Buat pesanan baru           |
| POST   | /api/pesanan/:id/bayar          | Pelanggan | Upload bukti pembayaran     |
| PATCH  | /api/pesanan/:id/verifikasi     | Admin     | Verifikasi pembayaran       |

### Dashboard
| Method | Endpoint       | Akses | Keterangan           |
|--------|----------------|-------|----------------------|
| GET    | /api/dashboard | Admin | Statistik & ringkasan |

---

## Cara Pakai JWT

Setelah login, kamu akan mendapat `token`. Gunakan token tersebut di header request:
```
Authorization: Bearer <token>
```

---

## Role

- **admin** — akses penuh ke CRUD dan dashboard
- **pelanggan** — bisa register, pesan tiket, lihat riwayat, upload bukti bayar
