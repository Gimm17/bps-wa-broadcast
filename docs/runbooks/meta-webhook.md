# Runbook: Meta WhatsApp Cloud API & Webhook Setup

Panduan integrasi resmi **Meta WhatsApp Business Cloud API** dan konfigurasi webhook untuk **BPS Provinsi Sulawesi Tengah**.

---

## 1. Persiapan Akun Meta for Developers

1. Buka [Meta for Developers](https://developers.facebook.com/) dan login menggunakan akun Meta terverifikasi milik BPS Provinsi Sulawesi Tengah.
2. Buat atau pilih **Aplikasi WhatsApp Business**:
   - Tipe Aplikasi: **Business**
   - Tambahkan produk: **WhatsApp**
3. Masuk ke menu **WhatsApp > API Setup**:
   - Catat **Phone number ID**: `PN_...`
   - Catat **WhatsApp Business Account ID (WABA ID)**: `WABA_...`
   - Buat Permanent System User Access Token pada Business Manager dengan izin:
     `whatsapp_business_messaging`, `whatsapp_business_management`.

---

## 2. Konfigurasi Webhook di Meta Developer Console

1. Pada menu dashboard aplikasi Meta Anda, buka **WhatsApp > Configuration**.
2. Di bagian **Webhook**, klik **Edit**:
   - **Callback URL**:  
     `https://whatsapp.sulteng.bps.go.id/api/meta/webhook`
   - **Verify Token**:  
     Masukkan nilai yang sama persis dengan `META_WEBHOOK_VERIFY_TOKEN` di file `.env` (contoh: `bps_sulteng_waba_verify_2026`).
3. Klik **Verify and Save**.  
   *Meta akan mengirimkan permintaan GET ke endpoint dengan parameter `hub.challenge`. API BPS Sulteng akan langsung merespons dengan nilai challenge tersebut (HTTP 200).*
4. Pada bagian **Webhook fields**, klik **Manage**:
   - Beri centang pada field **`messages`**.
   - Klik **Done**.

---

## 3. Konfigurasi Kredensial di Dashboard BPS Sulteng

1. Login ke Dashboard sebagai **Super Admin**.
2. Masuk ke menu **Integrations** (`/integrations`).
3. Temukan kartu **Meta WhatsApp Cloud API** dan klik **Konfigurasi Kredensial**:
   - Masukkan **WABA ID**
   - Masukkan **Phone Number ID**
   - Masukkan **Permanent Access Token**
   - Masukkan **App Secret**
4. Klik **Simpan (AES-256-GCM Terenkripsi)**.
5. Klik **Uji Koneksi (Ping Meta)** untuk memastikan kredensial valid dan dapat membaca template yang disetujui.

---

## 4. Alur Pemrosesan Webhook

### A. Delivery Status Updates (`sent`, `delivered`, `read`, `failed`)
- Webhook Meta mengirim event pengiriman pesan ke `/api/meta/webhook`.
- Signature `x-hub-signature-256` diverifikasi dengan HMAC-SHA256 menggunakan `META_APP_SECRET`.
- Event dideduplikasi melalui kolom unik `event_id` pada tabel `webhook_events`.
- Status diperbarui secara **monotonik** (`queued < sending < sent < delivered < read`) untuk mencegah regresi jika event diterima tidak berurutan.
- Seluruh riwayat event dicatat secara kronologis pada tabel `message_status_events`.

### B. Inbound WhatsApp Commands (Perintah Masuk Pengguna)
Pesan masuk dari pelanggan diproses otomatis:
- `DAFTAR` / `SUBSCRIBE`: Mengirimkan tautan pendaftaran topik resmi.
- `BERHENTI` / `UNSUBSCRIBE`: Menghentikan langganan pada topik terkait.
- `BERHENTI SEMUA` / `STOP ALL`: Mencatat pembatalan langganan penuh di buku konsen UU PDP dan memasukkan nomor ke tabel `suppression_entries`.
- `BANTUAN` / `HELP`: Menampilkan menu bantuan dan kontak resmi Pelayanan Statistik Terpadu (PST) BPS Sulteng.
- Teks Bebas: Diberi balasan otomatis terarah menuju loket layanan PST BPS Sulteng.

---

## 5. Troubleshooting Webhook

### Kasus: Verifikasi Webhook Gagal ("The URL couldn't be validated")
1. Pastikan domain dapat diakses publik via HTTPS dengan sertifikat SSL valid.
2. Periksa apakah nilai `META_WEBHOOK_VERIFY_TOKEN` di `.env` sama persis dengan yang diketikkan di Meta Developer Console.
3. Cek log server:
   ```bash
   grep "meta/webhook" /home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id/logs/api.log
   ```

### Kasus: Webhook Mengembalikan HTTP 401 ("Signature webhook Meta tidak valid")
1. Pastikan `META_APP_SECRET` di `.env` atau pada menu Integrations sesuai dengan App Secret di **App Settings > Basic** pada dashboard Meta.
2. Pastikan reverse proxy tidak memotong atau memodifikasi raw body request webhook.
