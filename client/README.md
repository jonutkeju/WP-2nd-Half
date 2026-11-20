# Antarmuka Manajemen Produk

Antarmuka React, TypeScript, Vite, React Router, dan Tailwind CSS ini menggunakan REST API Express yang berada di repository yang sama.

## Menjalankan aplikasi

1. Konfigurasikan `DATABASE_URL` pada `.env` di folder utama, lalu jalankan migrasi database sesuai petunjuk di [Laporan-Week-10.md](../Laporan-Week-10.md).
2. Dari folder utama, jalankan API:

   ```sh
   npm run dev
   ```

3. Dari folder `client`, instal dependensi dan jalankan Vite:

   ```sh
   npm install
   npm run dev
   ```

4. Buka URL yang ditampilkan Vite (umumnya `http://localhost:5173`). Vite meneruskan request `/products` ke API pada `http://localhost:3000`.

Antarmuka menyediakan daftar produk dengan mode grid/list yang dapat dipilih dari halaman Settings, pencarian nama, penambahan, pengubahan, dan penghapusan dengan konfirmasi. Setiap produk memiliki halaman detail di `/products/:id`; URL yang tidak dikenal dan ID produk yang tidak tersedia menampilkan pesan dengan tautan kembali ke daftar. Aksi perubahan dan detail produk menggunakan API dan database.
