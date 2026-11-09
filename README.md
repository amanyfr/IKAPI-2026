# Sistem Pendaftaran & Pendataan Anggota IKAPI Jawa Barat
**Ikatan Penerbit Indonesia (IKAPI) Pengurus Daerah Jawa Barat**

Aplikasi web sistem pendaftaran dan pendataan anggota IKAPI Jawa Barat dengan halaman autentikasi mandiri (Login & Register bertema latar belakang putih dan aksen warna biru cerah / bukan navy) serta **pemisahan halaman penuh (portal mandiri) per peran pengguna**:
1. **Portal Anggota (Pemohon Keanggotaan)**
2. **Portal Sekretaris (Screening & Verifikasi Berkas)**
3. **Portal Ketua (Ketua & Sekretaris / Approval Pimpinan)**

---

## 🎨 Pembaruan Desain Halaman Login & Register
- **Latar Belakang:** Putih bersih (`bg-white` & border halus slate).
- **Tema Aksen Tombol & Elemen:** **Biru Cerah / Biru-Biru (`bg-blue-600` / `#2563eb`)**, bukan navy gelap.
- **Tab Masuk (Login):**
  - Pemilihan peran cepat: **Anggota**, **Sekretaris**, **Ketua** (dengan pengisian otomatis kredensial demo untuk kemudahan pengujian).
  - Form input email & kata sandi dengan deteksi otomatis role pengguna.
  - Tombol masuk berwarna biru cerah dengan animasi loading responsif.
  - Opsi login langsung 1-klik untuk setiap peran.
- **Tab Daftar (Register):**
  - Form pendaftaran pemohon baru: Nama lengkap pimpinan, email, kata sandi, nomor WhatsApp, nama penerbit, kategori (Anggota Biasa vs Luar Biasa), dan bentuk badan hukum (PT, CV, Perguruan Tinggi, Yayasan).
  - Verifikasi email langsung tersimulasi aktif.

---

## 🏢 Pemisahan Halaman (Portal) per Role

### 1. Portal Anggota (Pemohon)
- **Status & Pengajuan Saya:**
  - Stepper visual 8 tahap alur transparan: Isi Formulir → Screening Dokumen (Tahap 1, Admin) → Pembayaran (Tahap 2) → TTD Sekretaris → TTD Ketua → Berkas Fisik (pemohon cetak sendiri & kirim ke IKAPI Jabar) → Proses di Pusat (berkas diterima, dikirim Admin ke IKAPI Pusat) → Anggota Aktif (No. KTA dari Pusat diinput Sekretaris).
  - Rincian tagihan resmi & informasi rekening tujuan (**Bank BNI 2089992087 a.n. Abdul Rasyid**).
  - Form unggah bukti transfer pembayaran.
  - Berkas persyaratan dinamis (Akta notaris, NIB/NPWP, Formulir pendaftaran, Sertifikat BNSP Editor, dll.).
  - Status *screening* berkas per item (*Sesuai* / *Perlu Revisi* disertai catatan perbaikan dari verifikator).
  - Pemohon dapat memperbaiki dokumen berstatus *Perlu Revisi* **tanpa harus mengulang pembayaran**.
  - Tampilan Kartu Tanda Anggota (KTA) digital resmi saat status telah **Aktif**.
- **Formulir Pendaftaran & Heregistrasi 2026:**
  - Formulir digital resmi 4 tahap interaktif dengan opsi **Simpan sebagai Draf** dan **Submit Pengajuan**.
- **Header & Navigasi Mandiri:** Menampilkan nama penerbit yang login dan tombol keluar (*Logout*) yang jelas.

---

### 2. Portal Sekretaris (Screening & Verifikasi Berkas)
- **Screening Berkas & Pembayaran:**
  - Tabel pengajuan masuk dengan filter 9 status, jenis pengajuan (*Baru* / *Heregistrasi*), kategori (*Biasa* / *Luar Biasa*), dan pencarian instan.
  - Modal *screening* berkas: memeriksa dokumen satu per satu dan menandai **Sesuai** atau **Perlu Revisi** disertai catatan perbaikan spesifik.
  - Verifikasi pembayaran mencocokkan nominal dan bukti mutasi rekening.
  - Tindakan: **Kembalikan ke Pemohon untuk Revisi** atau **Loloskan & Teruskan ke Ketua** (otomatis men-generate nomor surat resmi `{urut}/PD-Ikapi Jabar/{bulan romawi}/{tahun}`).
- **Kelola Data Anggota (Input No. KTA):**
  - Direktori seluruh anggota penerbit terdaftar.
  - Tombol **Ekspor Data ke Format Excel (.xlsx)**.
  - Tab **Menunggu KTA** dan tombol **Input KTA**: Nomor KTA dari IKAPI Pusat diinput untuk pengajuan berstatus *Dikirim ke Pusat*; pengajuan otomatis menjadi **Aktif** dan pemohon menerima email.
- **TTD Sekretaris:** tombol tanda tangan baru aktif setelah keempat dokumen surat serta semua berkas pemohon dan bukti transfer dibuka.

---

### 3. Portal Ketua (Ketua & Sekretaris / Approval Pimpinan)
- **Monitoring & Dashboard Eksekutif:**
  - Kartu KPI ringkasan: antrian approval, siap kirim ke Pusat, anggota aktif, dan total iuran kas masuk.
  - Alur *funnel* visual posisi seluruh pengajuan dalam 9 tahapan sistem.
- **Antrian Approval & Tanda Tangan Digital:**
  - Review pengajuan yang telah lolos verifikasi berkas & pembayaran dari Sekretaris (*Menunggu Approval*).
  - Pembubuhan tanda tangan digital resmi (Ketua: *Dr. H. Mahpudi, M.T.* & Sekretaris: *Drs. H. Anwar Rosyid, M.Si.*) serta stempel resmi PD IKAPI Jawa Barat.
  - Keputusan: **Setujui** (menerbitkan surat pengantar resmi & paket 3 dokumen) atau **Tolak** (disertai alasan penolakan tertulis wajib).
- **Monitoring ke IKAPI Pusat (Portal Admin → Monitoring & Berkas Fisik):**
  - Admin mengonfirmasi berkas fisik diterima (hanya setelah pemohon menandai berkas sudah dikirim).
  - Admin mencatat pengiriman paket ke IKAPI Pusat (jasa kirim, No. resi, catatan); daftar "Menunggu KTA dari Pusat" menampilkan lama menunggu (merah bila lebih dari 30 hari).
  - Generator Paket Lengkap 3 Dokumen (1. Surat Pengantar Rekomendasi Resmi, 2. Formulir PDF Isian Anggota 2026, 3. Berkas Persyaratan Terverifikasi) dan PDF gabungan berkas.
- **TTD Ketua:** tombol tanda tangan baru aktif setelah keempat dokumen surat serta semua berkas pemohon dan bukti transfer dibuka.
- **Pengaturan Sistem, Biaya & Rekening:**
  - Konfigurasi rekening bank (Bank BNI 2089992087 a.n. Abdul Rasyid).
  - Konfigurasi struktur biaya: Uang pangkal (Rp 250rb), iuran bulanan (Rp 50rb/bln selama 24 bulan = Rp 1,2jt), biaya administrasi & verifikasi (Rp 250rb), total Baru Rp 1.700.000, total Heregistrasi Rp 1.200.000.
  - Konfigurasi nama pejabat pengurus dan *counter* penomoran surat otomatis.

---

## 🔑 Akun Demo Siap Uji

| Peran Pengguna | Email | Kata Sandi | Halaman / Portal |
|---|---|---|---|
| **Admin** | `admin@ikapi-jabar.or.id` | `password123` | Portal Admin (Kelola Akun & Pengaturan Sistem) |
| **Anggota Biasa** | `mizan@penerbit.id` | `password123` | Portal Anggota (PT Mizan Pustaka) |
| **Anggota Luar Biasa** | `press@unpad.ac.id` | `password123` | Portal Anggota (Unpad Press) |
| **Sekretaris** | `sekretaris@ikapi-jabar.or.id` | `password123` | Portal Sekretaris (Screening & Verifikasi) |
| **Ketua** | `ketua@ikapi-jabar.or.id` | `password123` | Portal Ketua (Approval & Tanda Tangan Surat) |

---

## 🚀 Cara Menjalankan Aplikasi

### Database (MySQL / Laragon)
Aplikasi memakai **MySQL**. Default koneksi: `root` tanpa password di `localhost:3306`, database `ikapi_jabar` (dibuat otomatis saat server start). Untuk mengubahnya, salin `.env.example` ke `.env` lalu sesuaikan `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

- Database kosong akan diisi data demo otomatis saat server pertama kali jalan.
- Production: wajib isi `JWT_SECRET` di `.env`.

```bash
# 1. Jalankan server aplikasi (Port 5000)
node server/index.js

# 2. Atau jalankan mode development (Port 3000 & 5000)
npm run dev
```

Buka peramban di: **`http://localhost:5000`** (atau `http://localhost:3000` pada mode dev).
