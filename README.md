# RuangKasir Android — Offline POS

Versi Android offline dari RuangKasir. UI berjalan di dalam Android WebView melalui Capacitor. Data Android disimpan di SQLite lokal pada penyimpanan privat aplikasi; tidak memerlukan server atau koneksi internet untuk transaksi harian.

## Yang sudah ada
- Kasir, katalog, pencarian dan kategori.
- Keranjang, diskon, uang diterima, kembalian.
- Produk contoh dan tambah produk.
- Riwayat transaksi dan laporan penjualan harian.
- Pengurangan stok saat checkout.
- Penyimpanan SQLite lokal Android.
- Fallback localStorage untuk preview browser saat development.
- Layout mobile dan desktop.

## Persiapan
- Node.js 20+
- Android Studio versi stabil
- Android SDK + platform tools
- JDK 17 (umumnya disertakan Android Studio)

## Membuat project Android
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
Di Android Studio tunggu Gradle sync, pilih Build > Build Bundle(s) / APK(s) > Build APK(s). Untuk update setelah mengubah kode:
```bash
npm run android:sync
```

## Database & offline
Di Android, plugin `@capacitor-community/sqlite` membuat database `ruangkasir` di sandbox privat aplikasi. Semua transaksi dan stok tersimpan lokal. Data tidak otomatis tersinkron ke HP lain. Jangan uninstall aplikasi atau clear storage sebelum backup; tindakan itu dapat menghapus database lokal.

Mode browser development menggunakan localStorage sebagai fallback, bukan SQLite native.

## Batasan versi awal
Belum tersedia login/PIN, backup-export/import database, edit/hapus produk dari UI, cetak Bluetooth/USB thermal, multi-kasir, sinkronisasi cloud, atau laporan PDF. Tambahkan autentikasi dan backup teruji sebelum dipakai untuk operasional penting. Aplikasi ini tidak membutuhkan izin internet untuk alur transaksi lokal.
