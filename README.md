# DanaKeluarga — Dashboard Keuangan Rumah Tangga

Dashboard React + Vite untuk mencatat dan menganalisis transaksi keuangan keluarga. Data pengguna, rumah tangga, preferensi grafik, dan transaksi disimpan di Convex.

## Fitur

- Daftar dan masuk dengan email serta kata sandi melalui Convex Auth.
- Buat rumah tangga baru atau bergabung memakai kode undangan.
- Akses anggota dan transaksi dibatasi ke rumah tangga yang sama.
- Grafik interaktif, filter transaksi, ringkasan saldo terakhir, dan ekspor.
- Impor CSV dengan pemeriksaan transaksi duplikat. Impor PDF belum tersedia.
- Pengaturan nama profil, rumah tangga, dan rentang grafik.

## Menjalankan secara lokal

Gunakan Node.js 18 atau lebih baru.

```bash
npm install
npm run convex:dev
```

Perintah Convex menghubungkan proyek ke deployment development dan menulis URL Convex ke `.env.local`. Biarkan proses Convex berjalan, lalu buka terminal kedua:

```bash
npm run dev
```

Buka URL lokal yang ditampilkan Vite, biasanya `http://localhost:5173`.

Untuk build lokal:

```bash
npm run build
```

## Menyiapkan Convex

Proyek ini sudah terhubung ke deployment development `danakeluarga-dashboard`. Untuk menyinkronkan perubahan backend, jalankan `npm run convex:dev`. Untuk membuat deployment production Convex, jalankan `npm run convex:deploy` dan ikuti pemilihan deployment production pada CLI.

Jangan commit `.env.local`. File tersebut berisi pilihan deployment lokal. URL publik Convex untuk frontend memakai variabel `VITE_CONVEX_URL`; contoh formatnya ada di `.env.example`.

## Deploy ke Vercel

1. Impor repositori proyek ini ke Vercel atau deploy folder proyek memakai Vercel CLI.
2. Gunakan build command `npm run build` dan output directory `dist` (sudah disiapkan di `vercel.json`).
3. Tambahkan `VITE_CONVEX_URL` di environment Vercel untuk deployment yang sesuai. Untuk production, gunakan URL deployment production Convex, bukan URL development.
4. Deploy ulang setelah menambahkan atau mengubah environment variable.

Convex Auth memakai pengaturan di deployment Convex. Setelah domain Vercel production ditetapkan, atur URL situs yang diizinkan untuk deployment Convex sesuai panduan Convex Auth. Pemulihan kata sandi lewat email belum diaktifkan karena layanan pengiriman email belum dikonfigurasi.

## Impor CSV

CSV wajib memiliki kolom tanggal, keterangan, dan nominal. Kolom saldo, kategori, serta pemilik bersifat opsional. Beberapa nama header yang umum dalam bahasa Indonesia dan Inggris didukung; pastikan tanggal memakai format `DD/MM/YYYY` atau `YYYY-MM-DD`.

