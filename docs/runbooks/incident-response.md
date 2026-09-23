# Runbook: Operational Incident Response & Troubleshooting

Panduan tanggap insiden operasional untuk Operator, Admin Diseminasi, dan Super Admin **BPS Provinsi Sulawesi Tengah WhatsApp Broadcast Platform**.

---

## 1. Klasifikasi Tingkat Keparahan (Severity Levels)

| Level | Kategori | Kriteria | Target Respon |
| :--- | :--- | :--- | :--- |
| **P1 - Critical** | Sistem Berhenti / Ancaman Regulasi | Basis data tidak dapat diakses, kebocoran data kontak unmasked, pesan terkirim ke kontak opt-out | $< 15\text{ menit}$ |
| **P2 - Major** | Gangguan Pengiriman | Circuit breaker TRIP (`OPEN`), Meta API mengembalikan HTTP 429 berulang, worker macet | $< 1\text{ jam}$ |
| **P3 - Minor** | Peringatan Operasional | Sinkronisasi presensi SIMPEG usang (`ATTENDANCE_DATA_STALE`), kegagalan impor batch sebagian baris | $< 4\text{ jam}$ |

---

## 2. Playbook 1: Circuit Breaker Terbuka (`CIRCUIT_BREAKER_OPEN`)

### Gejala:
- Muncul banner peringatan merah pada `HealthStrip` di dashboard.
- Pengiriman pesan tertunda dan tidak ada pesan baru yang berstatus `sent`.
- Di database terdapat alert aktif:
  ```sql
  SELECT * FROM system_alerts WHERE code = 'CIRCUIT_BREAKER_OPEN' AND is_resolved = false;
  ```

### Penyebab Umum:
- Kuota atau rate limit Meta WABA terlampaui (HTTP 429).
- Saldo Meta Cloud API habis atau payment method Meta terblokir.
- Meta Cloud API mengalami pemadaman (outage).

### Langkah Penanganan:
1. Periksa alasan kegagalan pada log pesan terakhir:
   ```sql
   SELECT last_error_code, last_error_message, count(*) 
   FROM messages 
   WHERE status = 'failed' OR status = 'queued'
   GROUP BY last_error_code, last_error_message 
   ORDER BY count(*) DESC;
   ```
2. Cek status platform Meta di [Meta Status Page](https://metastatus.com/).
3. Buka menu **Integrations** di dashboard dan lakukan **Uji Koneksi (Ping Meta)**.
4. Jika masalah di sisi Meta/Payment telah teratasi, reset circuit breaker dengan meresolusi alert terkait di database:
   ```sql
   UPDATE system_alerts 
   SET is_resolved = true, resolved_at = now() 
   WHERE code = 'CIRCUIT_BREAKER_OPEN';
   ```
5. Picu worker untuk mulai kembali mengirimkan antrean secara bertahap:
   ```bash
   node scripts/cron-worker.js
   ```

---

## 3. Playbook 2: Data Presensi SIMPEG Usang (`ATTENDANCE_DATA_STALE`)

### Gejala:
- Pengingat presensi pagi pukul 07:15 WITA tidak terkirim ke pegawai.
- Muncul alert peringatan: *"Data presensi SIMPEG usang (X menit yang lalu). Ambang batas maksimal 30 menit."*

### Penjelasan Desain Keamanan:
Ini adalah **mekanisme keamanan bawaan** (Safety Gate). Platform sengaja menahan dan tidak mengirimkan pengingat jika data presensi lebih lama dari 30 menit, demi mencegah kesalahan fatal: mengirim tegangan "belum presensi" kepada pegawai yang sebenarnya sudah presensi tepat waktu.

### Langkah Penanganan:
1. Hubungi administrator SIMPEG BPS Sulawesi Tengah untuk memastikan cron sinkronisasi presensi server SIMPEG berjalan normal.
2. Periksa response endpoint SIMPEG Presensi:
   ```bash
   curl -I https://simpeg.sulteng.bps.go.id/api/presensi/today
   ```
3. Setelah data SIMPEG diperbarui dan segar kembali, jalankan pemicu manual automasi presensi melalui menu **Automations** di dashboard.

---

## 4. Playbook 3: Worker Cron Mengalami Deadlock atau Lock Menggantung

### Gejala:
- Log worker berulang kali memunculkan:
  `{"event":"worker_skipped","status":"locked_by_other_instance"}`
  selama lebih dari 10 menit berturut-turut padahal tidak ada aktivitas broadcast besar.

### Langkah Penanganan:
1. Periksa proses PostgreSQL yang sedang memegang advisory lock:
   ```sql
   SELECT a.pid, a.usename, a.client_addr, a.query, a.state, a.query_start
   FROM pg_stat_activity a
   JOIN pg_locks l ON a.pid = l.pid
   WHERE l.locktype = 'advisory' AND l.objid = 987654321;
   ```
2. Jika proses tersebut sudah `idle in transaction` atau koneksinya putus di sisi OS:
   ```sql
   SELECT pg_terminate_backend(<pid_dari_query_diatas>);
   ```
3. Pulihkan pesan yang sempat tertahan dengan status `sending`:
   ```sql
   UPDATE messages
   SET status = 'queued', lease_owner = null, lease_expires_at = null
   WHERE status = 'sending' AND (lease_expires_at IS NULL OR lease_expires_at <= now());
   ```
4. Uji eksekusi worker:
   ```bash
   node scripts/cron-worker.js
   ```

---

## 5. Playbook 4: Investigasi Pelanggaran Privasi UU PDP No. 27/2022

### Skenario:
Laporan adanya pengguna yang telah menyatakan `BERHENTI` / opt-out namun masih menerima pesan siaran.

### Langkah Investigasi:
1. Cek riwayat persetujuan nomor terkait:
   ```sql
   SELECT ce.*, c.name, c.status
   FROM consent_events ce
   JOIN contacts c ON ce.contact_id = c.id
   WHERE c.phone_e164 = '+628XXXXXXXXXX'
   ORDER BY ce.created_at DESC;
   ```
2. Cek apakah nomor ada di daftar supresi:
   ```sql
   SELECT * FROM suppression_entries WHERE phone_e164 = '+628XXXXXXXXXX';
   ```
3. Cek riwayat pesan yang terkirim:
   ```sql
   SELECT m.id, m.status, m.created_at, c.title as campaign_title
   FROM messages m
   LEFT JOIN campaigns c ON m.campaign_id = c.id
   WHERE m.payload->>'to' = '+628XXXXXXXXXX'
   ORDER BY m.created_at DESC;
   ```
4. Jika nomor belum tercatat di daftar supresi karena kegagalan jaringan saat pesan `BERHENTI` masuk, masukkan secara manual dengan alasan audit:
   ```sql
   INSERT INTO suppression_entries (phone_e164, reason)
   VALUES ('+628XXXXXXXXXX', 'Manual suppression by Admin following PDP audit')
   ON CONFLICT (phone_e164) DO NOTHING;
   ```
5. Buat laporan insiden tertulis untuk Pejabat Pengelola Informasi dan Dokumentasi (PPID) BPS Sulteng.
