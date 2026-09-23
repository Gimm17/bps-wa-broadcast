# BPS Sulawesi Tengah WhatsApp Broadcast Platform — Design Specification

**Tanggal:** 23 September 2026  
**Status:** Menunggu persetujuan pengguna  
**Pemilik produk:** BPS Provinsi Sulawesi Tengah  
**Jenis sistem:** Single-tenant internal operations platform dengan halaman subscription publik

## 1. Ringkasan

Sistem ini menjadi pusat operasi WhatsApp Broadcast BPS Provinsi Sulawesi Tengah untuk monitoring, scheduling, dan triggering pesan melalui Meta WhatsApp Cloud API. Sistem melayani dua kelompok utama:

1. Pegawai internal, terutama untuk reminder absensi, deadline publikasi, dan transaksi layanan yang perlu ditindaklanjuti.
2. Masyarakat yang secara eksplisit berlangganan notifikasi Berita Resmi Statistik (BRS) atau publikasi BPS Sulawesi Tengah.

Sistem bukan inbox layanan pelanggan dan tidak menyediakan percakapan dua arah. Pesan masuk hanya dipakai untuk perintah subscription seperti `DAFTAR`, `BERHENTI`, `BANTUAN`, dan pemilihan topik.

## 2. Sasaran dan indikator keberhasilan

### Sasaran

- Mengurangi kelalaian absensi dan keterlambatan tindak lanjut pegawai.
- Mengotomatisasi reminder publikasi dan transaksi Silastik secara aman.
- Menyalurkan informasi BRS dan publikasi kepada pelanggan yang sudah memberikan consent.
- Memberikan visibilitas operasional atas antrean, delivery, read, failure, dan kesehatan integrasi.
- Menyediakan audit trail untuk setiap perubahan penting dan tindakan pengiriman.

### Indikator keberhasilan MVP

- Pegawai yang sudah absen tidak menerima reminder absensi pada periode yang sama.
- Hari libur, cuti bersama, dan pengecualian lokal otomatis dilewati.
- Tidak ada pesan ganda ketika cron atau webhook berjalan berulang.
- Operator dapat melihat progres campaign dan alasan kegagalan pesan.
- Unsubscribe berlaku sebelum campaign berikutnya diproses.
- Data 5.000 subscriber dapat diproses bertahap tanpa membuat dashboard tidak responsif.
- Gangguan API absensi, Silastik, Meta, atau cron terlihat pada dashboard.

## 3. Ruang lingkup

### Termasuk dalam MVP

- Dashboard monitoring operasional.
- Campaign manual dan terjadwal.
- Automation reminder absensi, deadline publikasi, transaksi Silastik, rilis BRS, dan rilis publikasi.
- Sinkronisasi dan penggunaan template Meta yang sudah disetujui.
- Kontak pegawai dan masyarakat, segmentasi, serta impor/ekspor.
- Subscription publik per topik dan consent ledger.
- Kalender hari kerja dan hari libur.
- Message log dan status `queued`, `sending`, `sent`, `delivered`, `read`, `failed`, `cancelled`, dan `suppressed`.
- Konektor API/database, impor Excel/CSV, dan input manual.
- Autentikasi email/password serta empat role.
- Audit log, health monitoring, dan laporan.
- Halaman publik untuk subscribe, konfirmasi, pengelolaan topik, unsubscribe, dan kebijakan privasi.

### Tidak termasuk dalam MVP

- Inbox percakapan dua arah.
- Chatbot layanan masyarakat.
- Multi-tenant atau billing.
- Approval formal sebelum campaign dikirim.
- Mobile app native.
- WhatsApp Web automation.

Struktur status campaign tetap memungkinkan approval ditambahkan kemudian tanpa mengubah model inti.

## 4. Pengguna dan hak akses

### Super Admin

- Mengelola pengguna, role, kredensial integrasi, pengaturan keamanan, dan konfigurasi sistem.
- Melihat seluruh data, audit, dan health status.

### Admin Diseminasi

- Mengelola template, kontak publik, topik, subscription, campaign, kalender, serta konten BRS/publikasi.
- Menjalankan test-send dan campaign.

### Operator

- Membuat atau menjalankan campaign sesuai izin.
- Memantau antrean, kegagalan, retry, impor, dan konektor.
- Tidak dapat melihat atau mengganti secret integrasi.

### Viewer/Pimpinan

- Melihat dashboard, campaign, metrik, dan laporan tanpa hak perubahan.

Hak akses ditegakkan di API, bukan hanya disembunyikan di frontend.

## 5. Arsitektur sistem

### Bentuk aplikasi

Satu repository JavaScript berbasis npm workspaces:

```text
apps/
  web/       Svelte + Vite SPA
  api/       Express REST API dan webhook
  worker/    Scheduler dan batch worker yang dipanggil cron
packages/
  shared/    Schema validasi, konstanta, formatter, dan kontrak data
```

PostgreSQL menjadi sumber data tunggal sekaligus persistent job queue. MVP tidak bergantung pada Redis.

### Deployment pada webserver berpanel

- Svelte dibangun menjadi static assets dan dipublikasikan melalui document root/subdomain panel.
- Express dijalankan melalui fitur Node.js Application pada panel.
- PostgreSQL disediakan melalui panel.
- Cron panel memanggil scheduler/worker setiap menit.
- Domain dan sertifikat HTTPS dikelola panel.
- Tidak memakai Docker, PM2, Nginx tambahan, `systemd`, atau sesi `screen`.

Worker harus dapat berhenti bersih pada batas waktu eksekusi hosting. Sisa pekerjaan tetap tersimpan dan dilanjutkan pada cron berikutnya.

### Aliran data

1. Data masuk dari API/database eksternal, Excel/CSV, input admin, form publik, QR, atau webhook WhatsApp.
2. Adapter sumber menormalisasi data menjadi contact, subscription, trigger event, atau campaign.
3. Trigger engine mengevaluasi aturan, jadwal, kalender hari kerja, freshness data, dan idempotency.
4. Template renderer memvalidasi seluruh variabel terhadap mapping template Meta.
5. Recipient resolver menerapkan segmentasi, consent, suppression, dan validitas nomor.
6. Pesan dimasukkan ke antrean PostgreSQL.
7. Cron worker mengklaim batch dengan database lock dan mengirim melalui Meta Cloud API.
8. Webhook Meta mencatat status pesan secara idempotent.
9. Dashboard membaca agregat dan log operasional dari PostgreSQL.

## 6. Modul produk

### Overview

- KPI pesan hari ini, delivery/read/failure rate, backlog, dan jadwal berikutnya.
- Status strip untuk Meta, cron, API absensi, Silastik, dan sumber publikasi.
- Daftar aktivitas serta kegagalan yang membutuhkan tindakan.

### Campaigns

- Draft, audience/segment, template, variable mapping, preview, test-send, schedule, cancel, duplicate, dan detail progres.
- Campaign yang sudah mulai tidak dapat diedit. Operator membatalkan sisa antrean dan menduplikasi campaign untuk perubahan.

### Automations

- Rule builder terbatas dan terstruktur, bukan arbitrary code.
- Rule reminder absensi, deadline publikasi, transaksi Silastik baru, rilis BRS, dan rilis publikasi.
- Setiap rule memiliki source, condition, schedule, template, recipients, status, dan last run.

### Templates

- Sinkronisasi template dari WABA.
- Penyimpanan Meta template ID/name, category, language, status, components, variable mapping, dan sample data.
- Struktur template lokal mengikuti template Meta; pengguna hanya mengisi variabel yang telah dipetakan.

### Contacts dan subscriptions

- Satu contact dapat memiliki employee profile, public profile, atau keduanya.
- Segmentasi berdasarkan tipe, unit kerja, tag, dan subscription topic.
- Consent dicatat per topik, sumber, waktu, bukti, dan status.
- Unsubscribe topik hanya menghentikan topik tersebut; `BERHENTI SEMUA` menghentikan seluruh broadcast publik.
- Reminder pegawai mengikuti kebijakan komunikasi internal, terpisah dari subscription publik.

### Schedules dan calendar

- Timezone baku `Asia/Makassar`.
- Waktu dan hari reminder dapat dikustomisasi dari dashboard.
- Kalender menyimpan hari libur nasional, cuti bersama, dan pengecualian lokal.

### Logs, integrations, users, audit, settings

- Filter message log berdasarkan campaign, automation, contact, status, waktu, dan error code.
- Health status menunjukkan last successful run dan usia data terakhir.
- Perubahan integrasi, ekspor data, campaign send/cancel, retry, dan perubahan akses masuk audit log.

## 7. Aturan use case utama

### Reminder absensi

1. Scheduler memastikan tanggal adalah hari kerja.
2. Sistem mengambil status terbaru dari API absensi.
3. Employee ID menjadi kunci pencocokan; nomor telepon bukan identifier integrasi.
4. Hanya pegawai yang belum absen yang masuk antrean.
5. Idempotency key menggabungkan rule, employee, tanggal, dan tipe reminder.
6. Jika API gagal atau data melewati freshness threshold, sistem tidak mengirim otomatis dan membuat operational alert.

### Reminder publikasi internal

- Deadline dan milestone dapat dimasukkan manual, impor, atau konektor.
- Rule mendukung offset, misalnya H-30, H-14, H-7, dan H-1.
- Pesan memuat PIC, unit kerja, judul publikasi, tanggal rilis, dan batas penyerahan draft.

### Transaksi Silastik

- Transaksi baru dinormalisasi sebagai event.
- Routing memakai PIC atau unit layanan.
- Nomor transaksi menjadi bagian idempotency key.

### Subscription BRS/publikasi

- Masyarakat dapat subscribe melalui form/QR, keyword WhatsApp, atau impor admin dengan bukti consent.
- Topik menentukan segmentasi pesan.
- Link publikasi/BRS divalidasi sebelum campaign dijadwalkan.
- Pesan memiliki opsi berhenti berlangganan yang jelas.

## 8. Model data konseptual

- Identity: `users`, `roles`, `permissions`, `user_roles`, `sessions`, `password_reset_tokens`.
- Audience: `contacts`, `employee_profiles`, `public_profiles`, `tags`, `contact_tags`.
- Consent: `topics`, `subscriptions`, `consent_events`, `suppression_entries`.
- Messaging: `meta_templates`, `template_variables`, `campaigns`, `campaign_recipients`, `messages`, `message_status_events`.
- Automation: `automation_rules`, `trigger_events`, `schedules`, `holiday_dates`.
- Integration: `integrations`, `integration_runs`, `import_jobs`, `import_rows`, `webhook_events`.
- Governance: `audit_logs`, `system_alerts`, `app_settings`.

Nomor WhatsApp dinormalisasi ke E.164. Timestamp disimpan dalam UTC dan ditampilkan dalam `Asia/Makassar`.

## 9. Integrasi Meta WhatsApp Cloud API

- Kredensial berasal dari WABA BPS melalui mitra resmi Meta.
- Secret, access token, WABA ID, dan phone number ID disimpan terenkripsi; token tidak pernah ditampilkan kembali secara penuh.
- Template disinkronkan dari WABA dan hanya template berstatus layak kirim yang dapat dipilih.
- Webhook publik harus memakai HTTPS valid dan berlangganan pada WABA.
- Status webhook dapat datang tidak berurutan; timestamp event menentukan timeline.
- Event duplikat harus aman diproses berulang.
- Tombol URL atau quick reply diprioritaskan untuk tautan publikasi dan unsubscribe bila bentuk template yang disetujui memungkinkan.
- Permintaan "sticker love" pada contoh copy tidak diasumsikan sebagai variabel template. Konten akhir harus mengikuti komponen template yang disetujui Meta; media atau pesan tambahan diuji terpisah sebelum masuk scope produksi.

Referensi implementasi utama:

- [Meta official WhatsApp Business Platform collection](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [Meta official Cloud API templates collection](https://www.postman.com/meta/whatsapp-business-platform/folder/lczy75a/templates)
- [Meta official webhook payload reference](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference)
- [Meta official message status webhook example](https://www.postman.com/meta/whatsapp-business-platform/request/rgtfq23/message-status-update-notifications)

## 10. Antrean, retry, dan konsistensi

- PostgreSQL queue memakai row locking agar satu pesan hanya diklaim satu worker.
- Setiap pesan memiliki unique idempotency key.
- Worker mengambil batch kecil dengan lease/lock expiry agar job dapat dipulihkan setelah proses berhenti.
- Retry memakai exponential backoff dengan jitter untuk error sementara.
- Invalid number, revoked consent, permanent template error, dan explicit opt-out tidak di-retry.
- Circuit breaker menahan batch baru ketika token invalid, rate limit aktif, atau error eksternal melewati ambang.
- Cancellation mencegah pesan `queued` diklaim, tetapi tidak menjanjikan pembatalan pesan yang sudah dikirim ke Meta.

## 11. Keamanan dan privasi

- Password memakai Argon2id.
- Session disimpan server-side dan dikirim melalui cookie `HttpOnly`, `Secure`, dan `SameSite` yang sesuai.
- Proteksi CSRF berlaku pada endpoint mutasi berbasis session.
- Login diberi rate limit, lockout bertahap, dan audit.
- Semua input API, query, file impor, dan template variable divalidasi dengan schema.
- Query PostgreSQL selalu terparameterisasi melalui query builder/ORM.
- Meta webhook diverifikasi menggunakan mekanisme challenge dan signature yang didukung.
- Nomor telepon dimasking sesuai role; ekspor memerlukan izin eksplisit.
- Audit log tidak menyimpan password, token, atau payload sensitif utuh.
- Retensi message log, webhook mentah, file impor, dan data pribadi dapat dikonfigurasi.
- Backup PostgreSQL dijadwalkan dan prosedur restore diuji.

## 12. Error handling dan observability

- API memakai error envelope konsisten dengan correlation ID.
- Integrasi mencatat outcome, latency, record count, last success, dan error summary.
- Import menghasilkan laporan per baris tanpa menggagalkan seluruh file karena satu record buruk.
- Dashboard menampilkan alert untuk cron terlambat, backlog menua, webhook tidak aktif, kredensial kedaluwarsa, dan data absensi stale.
- Log aplikasi dipisahkan menjadi API, worker, integration, dan audit; file log memakai rotasi yang tersedia pada panel/aplikasi.
- Health endpoint tidak membuka secret atau detail infrastruktur sensitif.

## 13. Strategi pengujian

- Unit: kalender hari kerja, trigger offsets, freshness gate, E.164 normalization, variable rendering, consent, suppression, idempotency, dan retry classification.
- Integration: PostgreSQL queue, locking, auth/session, RBAC, CSV/XLSX import, webhook deduplication, dan encryption boundary.
- Contract: fixture dari Meta dan setiap sumber eksternal.
- End-to-end: login, create campaign, test-send, schedule, cron claim/send, webhook update, cancel, subscribe, dan unsubscribe.
- Load: generate 5.000 recipient/message rows, proses batch tanpa panggilan Meta nyata, dan ukur backlog serta respons dashboard.
- Security: authorization bypass, CSRF, brute force, malicious file, formula injection pada ekspor, dan webhook forgery.

## 14. Arah UI/UX

- Atmosfer: pusat kendali operasional yang tenang, terpercaya, dan cepat dipindai.
- Density 7/10, variance 4/10, motion 3/10.
- Font: Geist untuk UI dan Geist Mono untuk metrik, ID, serta timestamp.
- Sidebar kiri ringkas, top bar dengan page title dan health indicator, content width maksimal 1440px.
- Tabel menjadi struktur utama untuk campaign, contacts, logs, dan integrations.
- Layout menjadi satu kolom di bawah 768px tanpa horizontal scroll halaman.
- Semua target sentuh minimal 44px dan fokus keyboard selalu terlihat.
- Status tidak pernah disampaikan dengan warna saja.

### Palet

- Action Orange `#E37434`: primary action, focus, attention.
- Warm Sand `#FFE2AF`: selected state dan soft warning.
- Operational Teal `#24B1B1`: positive information dan data visualization.
- Authority Teal `#007979`: sidebar, strong structure, active navigation.
- Canvas `#F7F7F3`, Surface `#FFFFFF`, Charcoal `#172020`, Muted `#66706F`, Border `#DCE2DF`.
- Error `#B42318` hanya untuk status destruktif/error.

Tidak memakai emoji pada UI, Inter, pure black, neon glow, glassmorphism, generic three-card row, giant marketing hero, custom cursor, atau gradient text.

## 15. Keputusan yang sengaja ditunda

- Approval campaign formal ditambahkan hanya jika proses organisasi membutuhkannya.
- Redis/BullMQ ditambahkan hanya jika persistent PostgreSQL queue terbukti tidak mencukupi.
- SSO BPS tidak masuk MVP; migrasi dari akun lokal dapat dirancang kemudian.
- Detail adapter API absensi, Silastik, dan sumber publikasi mengikuti dokumentasi yang diberikan saat implementasi. Interface internalnya tetap stabil agar mock, CSV, dan manual input dapat dipakai sebelum konektor produksi siap.

## 16. Acceptance criteria MVP

- Empat role dapat login dan hanya menjalankan aksi yang diizinkan.
- Admin dapat mengimpor pegawai dan subscriber dengan laporan validasi.
- Masyarakat dapat subscribe dan unsubscribe per topik.
- Operator dapat membuat, melakukan test-send, menjadwalkan, memantau, dan membatalkan sisa antrean campaign.
- Reminder absensi hanya menargetkan pegawai belum absen pada hari kerja.
- Trigger Silastik dan publikasi tidak membuat pesan ganda.
- Cron worker dapat dihentikan dan dijalankan kembali tanpa kehilangan job.
- Webhook mengubah status pesan walaupun event duplikat atau datang tidak berurutan.
- Dashboard menampilkan health, backlog, dan error yang dapat ditindaklanjuti.
- Sistem memproses simulasi 5.000 recipient tanpa timeout request dashboard.

