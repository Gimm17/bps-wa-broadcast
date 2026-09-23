# Runbook: Hosting Panel Deployment (CloudPanel / cPanel / DirectAdmin)

Panduan deployment produksi untuk **BPS Provinsi Sulawesi Tengah WhatsApp Broadcast Platform** pada hosting panel berbasis web tanpa ketergantungan pada Docker, Redis, PM2, Nginx custom config, atau systemd manual.

---

## 1. Arsitektur Deployment Panel

Platform dirancang untuk berjalan pada runtime panel standar:
1. **Frontend (SPA)**: File statis di `apps/web/dist` dilayani langsung oleh web server panel (Nginx/OpenLiteSpeed/Apache).
2. **Backend API**: Aplikasi Node.js Express 5 dikelola via modul *Node.js Application* panel, mendengarkan pada internal port atau UNIX socket.
3. **Background Worker**: Bounded cron job 1-menit mengeksekusi `scripts/cron-worker.js`.
4. **Database**: PostgreSQL 16+ (disarankan PostgreSQL 17) dengan skema `bps_whatsapp`.

---

## 2. Persyaratan Server & Panel

- **Sistem Operasi**: AlmaLinux 9 / Rocky Linux 9 / Ubuntu 22.04 LTS / Debian 12
- **Node.js**: Versi 22.x LTS atau 24.x LTS (wajib $\ge 22.0.0$)
- **Database**: PostgreSQL 16 atau 17 dengan ekstensi `pgcrypto`
- **SSL/TLS**: Sertifikat HTTPS aktif (Let's Encrypt via panel) — **wajib** untuk Webhook Meta Cloud API.
- **Port/Socket**: Port internal aplikasi (misal `3000`) atau reverse proxy bawaan panel.

---

## 3. Langkah Konfigurasi Panel (Contoh: CloudPanel / cPanel)

### A. Konfigurasi Node.js Application
1. Buka menu **Node.js** pada panel hosting Anda.
2. Buat aplikasi baru:
   - **App Root / Directory**: `/home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id`
   - **Application Startup File**: `apps/api/src/server.js`
   - **Node.js Version**: Pilih `22.x`
   - **Application Mode**: `production`
   - **Port**: `3000` (atau biarkan panel menetapkan port otomatis)

### B. Konfigurasi Dokumen Statis & Reverse Proxy
Atur virtual host / reverse proxy pada panel:
- **Root URL (`/`)**: Arahkan document root ke direktori `apps/web/dist`
- **SPA Fallback**: Pastikan permintaan rute statis yang tidak ditemukan mengarah kembali ke `index.html` (HTML5 History Mode).
- **API Proxy (`/api`)**: Teruskan semua request berawalan `/api` ke backend Node.js (`http://127.0.0.1:3000/api`).

Contoh direktif Nginx pada panel:
```nginx
root /home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id/apps/web/dist;
index index.html;

location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 60s;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 4. Konfigurasi Environment Variables (`.env`)

Buat file `.env` pada root project dengan izin akses `600`:
```bash
chmod 600 .env
```

Isi variabel konfigurasi:
```ini
# Runtime
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
PUBLIC_APP_URL=https://whatsapp.sulteng.bps.go.id

# PostgreSQL Database (Sertakan schema search_path)
DATABASE_URL=postgresql://user_bps:PasswordRahasiaDb2026!@127.0.0.1:5432/bps_broadcast_prod?search_path=bps_whatsapp,public

# Keamanan Sesi & Kriptografi
# Generate dengan: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=a8f9b4c2e6d1a7b9c3d5e7f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1
APP_ENCRYPTION_KEY=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Meta WhatsApp Business Cloud API
META_WEBHOOK_VERIFY_TOKEN=bps_sulteng_waba_verify_2026
META_APP_SECRET=your_meta_app_secret_from_developers_facebook
```

---

## 5. Prosedur Deploy Awal (First-Time Setup)

Jalankan perintah berikut melalui terminal panel atau SSH:

```bash
cd /home/bps-sulteng/htdocs/whatsapp.sulteng.bps.go.id

# 1. Install dependensi produksi terkunci
npm ci --omit=dev

# 2. Jalankan skrip preflight otomatis (validasi runtime, migrasi DB, build frontend)
node scripts/deploy-build.js

# 3. Jalankan pemeriksaan kesehatan sistem
node scripts/health-check.js

# 4. Restart aplikasi Node.js dari tombol panel hosting Anda
```

---

## 6. Verifikasi Pasca-Deployment

1. Buka browser: `https://whatsapp.sulteng.bps.go.id/api/health/live`  
   *Harus mengembalikan HTTP 200 `{ status: "ok" }`.*
2. Buka dashboard: `https://whatsapp.sulteng.bps.go.id`  
   *Tampilan login BPS Sulawesi Tengah harus muncul dengan visual design tokens yang presisi.*
3. Lakukan login akun Super Admin dan periksa `HealthStrip` di dashboard.
