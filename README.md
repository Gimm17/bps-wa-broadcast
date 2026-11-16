<div align="center">

# 💬 SAPA BPS Sulteng — WhatsApp Operations Platform

### Automated WhatsApp Broadcast, Scheduling & Subscription Platform via Meta Cloud API

[![Svelte](https://img.shields.io/badge/Frontend-Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Meta WABA](https://img.shields.io/badge/Meta-WhatsApp%20Cloud%20API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![Vitest](https://img.shields.io/badge/Tests-Vitest%20%2B%20Supertest-6E9F18?style=for-the-badge)](package.json)

*Centralized WhatsApp dissemination and internal operations platform for BPS Provinsi Sulawesi Tengah — managing employee attendance/publication reminders and public BRS statistical subscriptions.*

</div>

---

## ✨ Key Features

- **Manual & Scheduled Campaigns** — Create, queue, throttle (`msg/sec`), and monitor WhatsApp broadcast campaigns with real-time delivery & read progress tracking.
- **Automated Operational Triggers** — Scheduled cron dispatchers for employee attendance reminders, publication deadlines, Silastik service notifications, and BRS/publication releases.
- **Public Opt-In Subscription Portal** — Allows the public to subscribe/unsubscribe (`DAFTAR`, `BERHENTI`, `BANTUAN`, topic selection) with strict consent enforcement before processing campaigns.
- **Meta Template Sync & Anti-Spam Throttling** — Synchronizes approved Meta Business Manager templates and enforces rate limits to protect WABA account quality.
- **Contact Directory, Health & Audit Logs** — Segmented employee & public directories, integration health monitoring (API, Meta, Cron), and full operational audit trails.

---

## 📁 Monorepo Structure

```text
Whatsapp_broadcast/
├── apps/                # Workspace apps (API backend & Svelte web dashboard)
├── packages/            # Shared workspace packages
├── db/                  # Database schemas & migrations
├── scripts/             # Migrate, cron worker, health check, backup & deploy packagers
├── tests/               # Acceptance & API integration tests (Vitest + Supertest)
├── docs/                # Design specs, runbooks (cron, webhook, cPanel) & QA evidence
└── package.json
```

---

## 🚀 Development & Testing

```bash
# Install monorepo dependencies
npm install

# Run database migrations
npm run migrate

# Start API & web dashboard concurrently
npm run dev

# Run workspace & acceptance tests
npm run test:all

# Build production web bundle
npm run build
```
