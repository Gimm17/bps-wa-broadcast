# Runbook: Backup & Disaster Recovery (PostgreSQL 17)

Panduan pencadangan (backup), verifikasi integritas, dan pemulihan bencana (disaster recovery) untuk basis data **BPS Provinsi Sulawesi Tengah WhatsApp Broadcast Platform**.

---

## 1. Strategi Pencadangan

| Tipe Backup | Frekuensi | Retensi | Tool / Skrip |
| :--- | :--- | :--- | :--- |
| **Full Compressed Dump** | Harian (01:00 WITA) | 30 Hari | `scripts/backup-postgres.js` / `sh` |
| **Pre-Deployment Snapshot** | Sebelum setiap rilis baru | Manual simpan | `node scripts/backup-postgres.js` |
| **Off-Site Sync** | Harian (02:00 WITA) | 90 Hari | `rsync` / S3 kompatibel / SFTP |

Format yang digunakan adalah **Custom Compressed Archive (`-Fc`)** dari `pg_dump`. Format ini memiliki keunggulan:
- Terkompresi secara efisien (mengurangi ukuran file hingga 70–80%).
- Mendukung pemulihan paralel (`pg_restore -j`).
- Memungkinkan pemulihan selektif skema atau tabel tertentu jika diperlukan.

---

## 2. Menjalankan Backup Manual

### Menggunakan Skrip Node.js (Lintas Platform):
```bash
node scripts/backup-postgres.js
```

### Menggunakan Bash Script (Linux):
```bash
bash scripts/backup-postgres.sh
```

File hasil backup disimpan di folder `backups/`:
`backups/bps_whatsapp_backup_YYYYMMDD_HHMMSS.dump`

---

## 3. Otomasi Backup Harian pada Hosting Panel

Tambahkan jadwal cron harian pada hosting panel:
- **Jadwal**: `0 1 * * *` (Pukul 01:00 WITA setiap malam)
- **Command**:
```bash
cd /home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id && /usr/bin/node scripts/backup-postgres.js >> logs/backup.log 2>&1
```

---

## 4. Prosedur Pemulihan (Restoration Drill)

> [!CAUTION]
> Jangan pernah memulihkan backup langsung ke basis data produksi aktif tanpa melakukan uji coba pada database staging atau database sementara terlebih dahulu!

### Skenario A: Uji Coba Pemulihan ke Database Uji (Rehearsal)
1. Buat database sementara pada PostgreSQL:
   ```sql
   CREATE DATABASE bps_whatsapp_restore_drill;
   ```
2. Jalankan `pg_restore`:
   ```bash
   pg_restore \
     --dbname="postgresql://user:pass@localhost:5432/bps_whatsapp_restore_drill" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --verbose \
     backups/bps_whatsapp_backup_YYYYMMDD_HHMMSS.dump
   ```
3. Verifikasi jumlah baris dan integritas skema:
   ```sql
   \c bps_whatsapp_restore_drill
   SELECT count(*) FROM contacts;
   SELECT count(*) FROM campaigns;
   SELECT count(*) FROM messages;
   SELECT count(*) FROM consent_events;
   ```

### Skenario B: Pemulihan Bencana Penuh (Full Disaster Recovery)
1. Aktifkan mode pemeliharaan pada aplikasi web:
   ```bash
   touch .maintenance
   ```
2. Hentikan aplikasi Node.js dari panel hosting untuk mencegah penulisan data baru.
3. Lakukan pemulihan database utama:
   ```bash
   pg_restore \
     --dbname="$DATABASE_URL" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     backups/bps_whatsapp_backup_TARGET.dump
   ```
4. Jalankan pemeriksaan kesehatan sistem:
   ```bash
   node scripts/health-check.js
   ```
5. Mulai kembali aplikasi Node.js dan nonaktifkan mode pemeliharaan:
   ```bash
   rm -f .maintenance
   ```

---

## 5. Salinan Cadangan di Luar Server (Off-Site Backup)

Untuk memenuhi standar keamanan data BPS:
1. Sinkronisasikan isi folder `backups/` ke penyimpanan cloud aman (misal server backup BPS RI / object storage terenkripsi):
   ```bash
   # Contoh sinkronisasi via rsync terenkripsi
   rsync -avz -e "ssh -p 22" backups/ backup-user@backup.sulteng.bps.go.id:/secure/backups/whatsapp/
   ```
2. Pastikan file backup di remote storage dienkripsi menggunakan kunci GPG BPS Sulteng.
