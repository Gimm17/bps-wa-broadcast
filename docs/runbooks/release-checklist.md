# Runbook: Production Release & Rollback Checklist

Daftar periksa terstruktur (checklist) untuk persiapan rilis versi baru, proses migrasi, dan rencana mitigasi kembalikan versi (rollback) untuk **BPS Provinsi Sulawesi Tengah WhatsApp Broadcast Platform**.

---

## 1. Daftar Periksa Pra-Rilis (Pre-Release Checklist)

Lakukan tahapan ini sebelum memperbarui server produksi:

- [ ] **1.1. Kode Bersih & Teruji**:
  - Semua unit, integrasi, dan acceptance test lulus 100%:
    ```bash
    npm run test:all
    ```
- [ ] **1.2. Build Produksi Lolos Validasi**:
  - Build Svelte SPA tidak menghasilkan peringatan lint atau error:
    ```bash
    npm run build
    ```
- [ ] **1.3. Uji Skala 5.000 Penerima Lolos**:
  - Benchmark beban 5.000 penerima berhasil di staging dengan respon API p95 $\le 500\text{ ms}$:
    ```bash
    npx vitest run tests/load
    ```
- [ ] **1.4. Validasi Keamanan**:
  - Matriks otorisasi 5 peran dan penolakan webhook tanpa signature lolos:
    ```bash
    npx vitest run tests/security
    ```
- [ ] **1.5. Verifikasi Jadwal WITA**:
  - Pengujian batas midnight WITA (`Asia/Makassar`) dan kalender libur SKB 3 Menteri lolos.

---

## 2. Prosedur Deployment Produksi

Lakukan langkah berurutan pada server produksi:

### Tahap 1: Pencadangan Database (Snapshot)
```bash
cd /home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id
node scripts/backup-postgres.js
```
*Catat nama file dump cadangan yang dibuat.*

### Tahap 2: Aktifkan Pemeliharaan Sementara (Opsional untuk Rilis Mayor)
Tampilkan halaman informasi pemeliharaan bagi pengguna web jika terjadi perubahan skema besar.

### Tahap 3: Update Kode Sumber & Dependensi
```bash
git fetch origin main
git checkout tags/vX.Y.Z # atau git pull origin main
npm ci --omit=dev
```

### Tahap 4: Preflight, Migrasi, dan Build
Jalankan skrip otomasi satu-pintu:
```bash
node scripts/deploy-build.js
```
*Pastikan output diakhiri dengan `✅ PREFLIGHT & BUILD COMPLETED SUCCESSFULLY`.*

### Tahap 5: Restart Node.js Application
Buka panel hosting Anda (CloudPanel / cPanel / DirectAdmin) dan klik tombol **Restart** pada aplikasi Node.js Anda.

### Tahap 6: Uji Asap Produksi (Smoke Test)
```bash
node scripts/health-check.js
```
*Pastikan semua cek menampilkan `[✓]` hijau.*

### Tahap 7: Uji Coba Pengiriman Internal
Kirimkan satu pesan uji coba (`queueTestSend`) ke nomor WhatsApp internal tim TI/Diseminasi BPS Sulteng dan verifikasi pesan diterima dengan baik di gawai.

---

## 3. Prosedur Rollback (Mitigasi Mundur Versi)

Jika terjadi kendala kritis pasca-deployment yang tidak dapat diselesaikan dalam 15 menit:

### Langkah 1: Kembalikan Kode Sumber ke Tag / Commit Sebelumnya
```bash
git checkout <commit_sha_atau_tag_sebelumnya>
npm ci --omit=dev
npm run build
```

### Langkah 2: Evaluasi Status Database
Karena sistem menggunakan **Forward Migration Philosophy**:
- Jika migrasi baru bersifat aditif (menambahkan kolom atau tabel baru), **tidak perlu rollback database** karena kolom baru tidak mengganggu kode lama.
- Jika skema mengalami kerusakan parah, pulihkan database dari snapshot pra-rilis:
  ```bash
  pg_restore \
    --dbname="$DATABASE_URL" \
    --clean \
    --if-exists \
    --no-owner \
    backups/bps_whatsapp_backup_PRE_DEPLOYMENT.dump
  ```

### Langkah 3: Restart Aplikasi & Jalankan Pemeriksaan Kesehatan
```bash
node scripts/health-check.js
# Lalu restart Node.js dari tombol panel hosting
```
