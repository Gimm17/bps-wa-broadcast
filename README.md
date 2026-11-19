# SAPA BPS Sulteng — WhatsApp Operations Platform

> **Sistem Automasi Pesan & Agenda (SAPA)** — Monorepo platform siaran WhatsApp, penjadwalan cron, dan portal langganan publik via **Meta WhatsApp Cloud API** untuk **BPS Provinsi Sulawesi Tengah**.

![Svelte 5](https://img.shields.io/badge/Frontend-Svelte_5-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Meta WABA](https://img.shields.io/badge/Meta-WhatsApp_Cloud_API-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest_+_Supertest-6E9F18?style=flat-square)

![SAPA BPS Sulteng Overview](docs/screenshots/app-overview.webp)

### Fitur & Struktur Workspace

- **Campaign & Anti-Spam Throttling** — Siaran terjadwal dengan rate-limit (`msg/sec`), sinkronisasi template Meta WABA, serta pelacakan status `sent / delivered / read`.
- **Automated Reminders & Opt-In** — Cron pengingat presensi pegawai, jadwal rilis BRS/publikasi, dan manajemen consent UU PDP (`DAFTAR / BERHENTI / BANTUAN`).

```text
apps/       # API server (Node.js) & Dashboard Web SPA (Svelte)
db/         # Migrations & seeders PostgreSQL
scripts/    # Worker cron, health check & backup packagers
tests/      # Vitest + Supertest integration & security tests
```

```bash
npm install && npm run migrate
npm run dev         # jalankan API + Svelte web bersamaan
npm run test:all    # unit, contract, security & E2E suites
```
