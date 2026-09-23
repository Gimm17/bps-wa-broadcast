# Google Stitch Prompt — BPS Sulteng WhatsApp Operations

Gunakan prompt ini sebagai arahan utama saat membuat desain di Google Stitch.

---

Design a complete responsive web application UI named **"BPS Sulteng WhatsApp Operations"** for BPS Provinsi Sulawesi Tengah. This is an internal, single-organization operations dashboard for monitoring, scheduling, and triggering WhatsApp broadcasts through the official Meta WhatsApp Cloud API. It is not a chat inbox and not a marketing landing page.

## Product context

The users are Super Admin, Admin Diseminasi, Operator, and Viewer/Pimpinan. The system sends internal reminders to employees and publication/BRS notifications to opted-in members of the public. It monitors scheduled jobs, queue progress, delivery status, read status, failures, integrations, consent, and audit activity. The initial scale is 84 employees and 5,000 public subscribers.

Use realistic Indonesian UI copy and realistic BPS Sulawesi Tengah data. Never use generic names such as John Doe, Acme, Nexus, or fake metrics such as 99.99%. Use names and content from the examples below when sample data is required:

- Ainun — Tim Statistik Harga BPS Provinsi Sulawesi Tengah
- Yayan — operator layanan Silastik
- Anwar Hafid — subscriber BRS
- Ince Mariyani — subscriber publikasi
- "Statistik Harga Konsumen Provinsi Sulawesi Tengah 2026"
- "Perkembangan Indeks Harga Konsumen September 2026"
- Transaction `#51193`

## Visual atmosphere

Create a calm, trustworthy, high-clarity operational command center suitable for an Indonesian government statistics institution. Density is 7/10: information-rich but never cramped. Variance is 4/10: mostly predictable and systematic with selective asymmetric emphasis for urgent operational information. Motion is 3/10: restrained, purposeful, and never distracting.

The interface should feel authoritative, humane, and contemporary. Avoid the look of a generic admin template. Prefer structural lines, carefully grouped tables, status strips, and purposeful whitespace over excessive floating cards.

## Color system

Use this palette consistently:

- **Action Orange — #E37434:** the only primary action accent. Use for primary buttons, current focus, selected high-priority actions, and attention indicators.
- **Warm Sand — #FFE2AF:** soft warnings, selected rows, deadline highlights, and gentle attention surfaces.
- **Operational Teal — #24B1B1:** delivery/read charts, healthy informational states, and secondary data visualization. Do not use it as a competing primary CTA.
- **Authority Teal — #007979:** sidebar, active navigation, strong section labels, and institutional structure.
- **Canvas — #F7F7F3:** application background.
- **Surface — #FFFFFF:** table and controlled elevated surfaces.
- **Charcoal Ink — #172020:** primary text; never use pure black.
- **Muted Slate — #66706F:** secondary text and metadata.
- **Structural Border — #DCE2DF:** dividers and table boundaries.
- **Error Red — #B42318:** error/destructive states only, always paired with an icon and text label.

Do not use purple, neon blue, outer glows, oversaturated gradients, glassmorphism, or gradient text.

## Typography

- Use **Geist** for headings, navigation, body text, buttons, and forms.
- Use **Geist Mono** for KPI values, timestamps, phone masks, message IDs, transaction numbers, and queue metrics.
- Use a compact but accessible type scale. Page titles should be 28–32px, section titles 18–22px, body 14–16px, and metadata no smaller than 12px.
- Keep body copy relaxed and concise. Use Indonesian labels.
- Never use Inter or serif fonts.

## Application shell

Create a desktop-first dashboard with a compact left sidebar, a top bar, and a centered content region with a maximum width of 1440px. The sidebar uses Authority Teal and contains grouped navigation:

1. Overview
2. Campaigns
3. Automations
4. Templates
5. Contacts
6. Subscriptions
7. Schedules & Calendar
8. Message Logs
9. Integrations
10. Users & Roles
11. Audit & Settings

The top bar contains the page title, environment label, concise system health indicator, notifications, and the signed-in user menu. Do not place a marketing hero in the application.

Below 768px, collapse the sidebar into an accessible navigation drawer. All layouts must become a single column. Never allow page-level horizontal scrolling. Tables may transform into stacked record summaries on small screens. All interactive targets must be at least 44px.

## Core components

- **Buttons:** 10–12px radius, confident label, no glow. Primary uses Action Orange. Secondary uses outline or neutral fill. On press, translate down by 1px.
- **Status chips:** compact, icon plus text, never color-only. Use labels such as Terjadwal, Antrean, Mengirim, Terkirim, Dibaca, Gagal, Dibatalkan, and Dihentikan.
- **Tables:** sticky header, clear density, row selection, sortable columns, filters, pagination, and contextual row actions. Prioritize tables over collections of cards.
- **Cards:** only where elevation communicates hierarchy. Use 16px radius, 1px border, and a very subtle shadow tinted toward teal. Never create a row of three identical promotional cards.
- **Forms:** visible label above each input, helper text below when needed, inline validation, clear required markers, and a strong keyboard focus state.
- **Date/time controls:** always show timezone `WITA (Asia/Makassar)`.
- **Loading:** use skeletons matching the final content dimensions; no generic circular spinner.
- **Empty states:** explain why the area is empty and show one relevant action.
- **Errors:** show a plain-language cause, affected scope, last successful time, and recommended action.
- **Charts:** simple line, bar, or stacked status charts. Avoid decorative pie charts. Always include values and accessible legends.

## Required screens

### 1. Login

A restrained sign-in screen with BPS Provinsi Sulawesi Tengah identity, email, password, show-password control, validation, and a small security notice. No illustration collage and no social login.

### 2. Overview dashboard

Lead with a horizontal operational status strip for Meta WABA, cron worker, API Absensi, Silastik, and Publication Source. Each item shows status, last successful sync, and a direct action when unhealthy.

Show compact KPI summaries for Pesan Hari Ini, Antrean Aktif, Delivery Rate, Read Rate, and Gagal. Use real-looking non-round sample values. Add a 14-day delivery trend, queue status distribution, upcoming schedules, and an actionable issue list. Avoid a generic equal-card grid; use an asymmetric 8/4 layout with the operational timeline taking visual priority.

### 3. Campaign list

Provide search, date range, status, type, and creator filters. Columns: campaign name, audience, template, scheduled time, progress, delivery rate, status, and owner. Include a clear primary button "Buat Campaign".

### 4. Campaign creation wizard

Use a four-step flow: Audience, Template, Schedule, Review. Show a persistent summary panel with recipient count, exclusions, template preview, timezone, and estimated batch behavior. Include test-send before final scheduling. Show inline warnings for missing consent, invalid numbers, unsynced templates, and duplicate recipients.

### 5. Campaign detail

Show immutable campaign metadata, delivery funnel, progress timeline, status breakdown, recipient table, failure reasons, cancel remaining queue action, and duplicate campaign action. Do not allow editing after sending begins.

### 6. Automations

Show structured automation rows for Reminder Absensi, Deadline Publikasi, Transaksi Silastik, Rilis BRS, and Rilis Publikasi. Each row displays trigger, schedule, data source, template, active state, last run, next run, and health. Include an automation editor with rule-specific fields rather than a free-form code editor.

### 7. Templates

Display synchronized Meta templates with category, language, Meta status, last sync, variable count, and usage. Template detail includes a WhatsApp-style message preview, variable mapping table, sample values, and sync history. Do not imply that users can freely alter an approved Meta template.

### 8. Contacts

Create segmented tabs for Pegawai and Masyarakat. Provide import, export, tag, validation status, masked phone number, unit or subscription count, consent state, and last message. Include an import review screen with accepted rows, warnings, rejected rows, and downloadable error report.

### 9. Subscriptions

Show topics, active subscriber count, opt-in source, unsubscribe trend, and recent consent events. Contact detail includes a chronological consent ledger and clear per-topic controls.

### 10. Schedules and calendar

Create a month calendar with Indonesian national holidays, collective leave, and local exceptions. Pair it with reminder rule summaries. Use Warm Sand for exceptions and clear labels instead of color alone.

### 11. Message logs

Build a high-density searchable table with message ID, masked recipient, source campaign/automation, template, queued time, latest status, latency, retry count, and error. A right-side detail drawer shows the chronological Meta webhook timeline, request correlation ID, and safe payload summary.

### 12. Integrations and health

Show Meta WABA, API Absensi, Silastik, and Publication Source as structured integration panels with connection status, last success, data freshness, recent errors, test connection, and edit settings. Secret values must always be masked. Include cron heartbeat and queue age.

### 13. Users and roles

Provide user table, active status, role, last login, and account actions. Include a role capability matrix for Super Admin, Admin Diseminasi, Operator, and Viewer.

### 14. Audit log

Create a filterable immutable timeline/table for actor, action, object, time, IP, and safe change summary. Emphasize traceability without exposing secrets.

### 15. Public subscription flow

Create a minimal public page with BPS Sulteng identity, phone number, topic selection, explicit WhatsApp consent statement, privacy link, and subscribe button. Also design confirmation, manage-topics, successful unsubscribe, and invalid/expired-link states. Keep this page simple, trustworthy, and mobile-first.

## Interaction and motion

Use 150–220ms transitions with restrained ease-out or gentle spring behavior. Animate only transform and opacity. Use stagger only for initial table or metric reveal, under 250ms total. Do not use perpetual pulsing, floating objects, autoplay illustration, parallax, custom cursors, or attention-seeking motion. Monitoring information must remain visually stable.

## Accessibility and content rules

- Meet WCAG AA contrast.
- Provide visible keyboard focus and logical tab order.
- Pair every status color with icon and label.
- Do not rely on placeholder text as a label.
- Use sentence case Indonesian copy.
- Avoid emojis in the dashboard UI.
- Avoid AI copywriting clichés such as "Elevate", "Seamless", "Unleash", or "Next-Gen".
- Never overlap text, charts, or controls.
- Never hide critical actions only on hover.

## Output expectation

Generate a cohesive design system and the complete set of required desktop and mobile screens. Maintain the same navigation, color roles, typography, table density, status language, form behavior, and spacing logic across every screen. Prioritize operational clarity, traceability, safe sending, and fast issue recognition over visual decoration.

