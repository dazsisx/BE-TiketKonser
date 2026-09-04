# BE-TiketKonser — Backend REST API

Backend REST API untuk Aplikasi Pemesanan Tiket Konser berbasis Node.js + Express + PostgreSQL (Supabase).

## Tech Stack

- **Node.js** + **Express**
- **PostgreSQL (Supabase)** + **Sequelize ORM**
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

### 2. Setup database Supabase
1. Buat project di Supabase.
2. Ambil kredensial PostgreSQL dari **Connect > Connection pooling**.
3. Gunakan pooler port `6543` untuk aplikasi, dan jangan commit password database.
4. Tabel akan dibuat otomatis oleh Sequelize saat server pertama kali dijalankan.

### 3. Konfigurasi .env
Buat file `.env`, lalu isi dengan kredensial Supabase:
```
PORT=3000
DB_HOST=aws-0-region.pooler.supabase.com
DB_PORT=6543
DB_USER=postgres.project-ref
DB_PASSWORD=password_database_supabase
DB_NAME=postgres
DB_SSL=true
JWT_SECRET=ganti_dengan_secret_random_yang_panjang
JWT_EXPIRES_IN=7d
NODE_ENV=development
DB_SYNC_ALTER=false
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=DRStar <no-reply@domain-terverifikasi.com>
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_key_backend
SUPABASE_SERVICE_ROLE_KEY=service_role_key_backend
```

`RESEND_API_KEY` dan `RESEND_FROM_EMAIL` diperlukan untuk fitur lupa password.
Buat API key di Resend dan gunakan alamat pengirim dari domain yang sudah diverifikasi.
Gunakan `SUPABASE_SECRET_KEY` dari menu API Keys terbaru. `SUPABASE_SERVICE_ROLE_KEY`
adalah nama lama yang masih didukung. Keduanya hanya boleh disimpan di backend. Buat bucket Storage
bernama `avatars`, jadikan bucket publik, dan jalankan server dengan
`DB_SYNC_ALTER=true` sekali untuk menambahkan kolom avatar ke tabel users.

Nilai `DB_HOST` pooler berbentuk `aws-0-<region>.pooler.supabase.com`, sedangkan
`DB_USER` biasanya berbentuk `postgres.<project-ref>`. Salin nilai asli dari
Supabase, bukan nilai contoh di atas. Jika memakai koneksi direct, gunakan host
`db.<project-ref>.supabase.co`, port `5432`, dan user `postgres`.

### 4. Jalankan server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

`DB_SYNC_ALTER=true` hanya diperlukan jika ingin Sequelize menyesuaikan struktur tabel lama. Untuk penggunaan normal, biarkan `false`.

## Testing dengan Postman

1. Jalankan backend dengan `npm run dev`.
2. Buat request `GET http://localhost:3000` untuk memastikan server aktif.
3. Register melalui `POST http://localhost:3000/api/auth/register` dengan Body
    **raw > JSON**:
    ```json
    {
      "nama": "Budi",
      "email": "budi@example.com",
      "password": "password123",
      "no_telepon": "08123456789"
    }
    ```
4. Login melalui `POST http://localhost:3000/api/auth/login`, lalu simpan token
    dari response.
5. Untuk endpoint private, buka tab **Authorization**, pilih **Bearer Token**,
    dan masukkan token tersebut. Contoh: `GET /api/auth/profile`.

Endpoint public seperti `GET /api/artis` dan `GET /api/event` tidak memerlukan token.

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
