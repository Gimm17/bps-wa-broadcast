# BPS Sulteng WhatsApp Broadcast Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready single-tenant dashboard for monitoring, scheduling, and triggering BPS Sulawesi Tengah WhatsApp broadcasts through Meta WhatsApp Cloud API.

**Architecture:** Use a JavaScript ESM npm-workspace monorepo with a Svelte 5 SPA, an Express 5 API, a time-bounded cron worker, and shared validation contracts. PostgreSQL is the source of truth and persistent queue; panel-managed Node.js, HTTPS, static hosting, PostgreSQL, and one-minute cron provide production runtime without Docker, PM2, Redis, Nginx, `systemd`, or `screen`.

**Tech Stack:** Node.js 24 LTS preferred (22 LTS minimum), npm workspaces, Svelte 5, Vite, Express 5, PostgreSQL 16+, `pg`, `node-pg-migrate`, Zod, Argon2id, Pino, Luxon, ExcelJS, csv-parse, Vitest, Supertest, Testing Library, Playwright, Axe, and Apache ECharts.

**Spec:** `docs/superpowers/specs/2026-09-23-whatsapp-broadcast-platform-design.md`

## Global Constraints

- Use JavaScript ESM throughout; do not convert the project to TypeScript.
- Use `Asia/Makassar` for display and schedule evaluation; persist timestamps in UTC.
- Keep Meta, attendance, Silastik, and publication adapters behind stable interfaces.
- Do not add Docker, Redis, PM2, Nginx, `systemd`, `screen`, a chat inbox, multi-tenancy, billing, or campaign approval to MVP.
- Use PostgreSQL row locks and idempotency constraints for queue safety.
- Never log access tokens, passwords, full webhook secrets, or unmasked contact numbers.
- Every mutating API route requires authentication, permission checks, schema validation, CSRF protection, and audit coverage where applicable.
- Public subscription and Meta webhook routes are the only intentional unauthenticated mutations; they require dedicated verification and rate limits.
- UI must follow `docs/design/GOOGLE-STITCH-PROMPT.md` and meet WCAG AA.
- The hosting-panel preflight must confirm Node.js 22/24, PostgreSQL 16+, static document root, HTTPS, Node.js Application, environment variables, and one-minute cron before production release.

## Review Focus

- **Stale attendance data:** an unavailable or stale attendance response must create an alert and enqueue zero reminders; pin this in Task 10.
- **Duplicate delivery signals:** repeated cron invocations and duplicate/out-of-order Meta webhooks must not duplicate sends or regress message status; pin this in Tasks 7 and 9.
- **Unsubscribe race:** a contact opting out after campaign expansion but before send must be suppressed at claim/send time; pin this in Tasks 6 and 8.
- **WITA and holiday boundaries:** schedules around midnight UTC, Indonesian holidays, and local exceptions must resolve to the intended WITA workday; pin this in Task 9.
- **5,000-recipient workload:** campaign expansion and bounded worker batches must complete without blocking dashboard requests or exceeding the cron budget; pin this in Task 12.

---

## Target File Map

```text
package.json                         workspace scripts and runtime floor
.env.example                         documented environment contract
apps/web/                            Svelte SPA and public subscription UI
apps/api/                            Express routes, services, repositories, adapters
apps/worker/                         one-shot scheduler and sender commands
packages/shared/                     Zod schemas, constants, permissions, formatters
db/migrations/                       ordered PostgreSQL schema migrations
db/seeds/                            roles, permissions, local development fixtures
tests/contract/                      Meta and source-system fixtures
tests/load/                          5,000-recipient performance harness
scripts/                             deploy, migrate, cron, backup, and health scripts
docs/runbooks/                       panel deployment and operational recovery
```

Each API feature uses `routes.js` for HTTP concerns, `service.js` for business rules, and `repository.js` for SQL. Adapters implement an explicit interface and never call another feature's repository directly.

---

### Task 1: Workspace, configuration, and test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/api/package.json`
- Create: `apps/api/src/config.js`
- Create: `apps/api/src/app.js`
- Create: `apps/api/src/server.js`
- Create: `apps/api/test/health.test.js`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.js`
- Create: `apps/web/src/main.js`
- Create: `apps/web/src/App.svelte`
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/index.js`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.js`

**Interfaces:**
- Consumes: Node.js runtime and npm supplied by the hosting panel.
- Produces: `createApp({ config, db, logger })`, validated `config`, workspace scripts `dev`, `test`, `lint`, `build`, `migrate`, and `worker:once`.

- [ ] **Step 1: Initialize version control because the workspace is not yet a Git repository**

Run: `git init -b main`  
Expected: Git creates a new repository on branch `main`; no application file is changed or deleted.

- [ ] **Step 2: Create the root workspace manifest**

```json
{
  "name": "bps-sulteng-whatsapp-operations",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22 <25" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently -n api,web \"npm run dev --workspace @bps/api\" \"npm run dev --workspace @bps/web\"",
    "build": "npm run build --workspace @bps/web",
    "test": "npm run test --workspaces --if-present",
    "test:coverage": "npm run test:coverage --workspaces --if-present",
    "migrate": "node scripts/migrate.js",
    "worker:once": "npm run worker:once --workspace @bps/worker"
  }
}
```

- [ ] **Step 3: Scaffold the three applications and shared package**

Use Svelte 5 with Vite in `apps/web`, Express 5 in `apps/api`, and a plain one-shot Node command in `apps/worker`. Install runtime dependencies only in the workspace that owns them; install Vitest and shared lint tooling at the root.

```bash
npm install
npm install -w @bps/api express@5 zod pg pino pino-http helmet cookie-parser argon2 luxon
npm install -w @bps/web svelte @sveltejs/vite-plugin-svelte vite svelte-spa-router lucide-svelte echarts
npm install -D vitest supertest eslint @eslint/js globals concurrently
```

- [ ] **Step 4: Write the failing health test**

```js
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health/live', () => {
  it('returns a correlation id and live status', async () => {
    const response = await request(createApp({ config: {}, db: null, logger: false }))
      .get('/api/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(response.headers['x-correlation-id']).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run the test and confirm the initial failure**

Run: `npm test --workspace @bps/api -- health.test.js`  
Expected: FAIL because `createApp` and the route do not exist.

- [ ] **Step 6: Implement config validation and the Express application factory**

```js
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';

export function createApp({ config, db, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const id = req.get('x-correlation-id') || crypto.randomUUID();
    req.correlationId = id;
    res.set('x-correlation-id', id);
    next();
  });
  app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));
  return app;
}
```

- [ ] **Step 7: Run baseline verification**

Run: `npm test && npm run build`  
Expected: health test PASS and Svelte production build completes.

- [ ] **Step 8: Commit the workspace baseline**

```bash
git add package.json package-lock.json .gitignore .env.example apps packages
git commit -m "chore: scaffold WhatsApp operations workspace"
```

---

### Task 2: PostgreSQL foundation, migrations, and queue primitives

**Files:**
- Create: `apps/api/src/db/pool.js`
- Create: `apps/api/src/db/transaction.js`
- Create: `db/migrations/001_extensions_and_identity.js`
- Create: `db/migrations/002_contacts_and_consent.js`
- Create: `db/migrations/003_messaging_and_queue.js`
- Create: `db/migrations/004_automation_integrations_audit.js`
- Create: `db/seeds/001_roles_permissions.js`
- Create: `scripts/migrate.js`
- Create: `apps/api/test/db/schema.test.js`
- Create: `apps/api/test/db/queue.test.js`

**Interfaces:**
- Consumes: `config.DATABASE_URL`.
- Produces: `pool`, `withTransaction(callback)`, `enqueueMessage(input)`, `claimMessageBatch({ workerId, limit, leaseSeconds })`, and schema enums/constants exported from `@bps/shared`.

- [ ] **Step 1: Write schema and queue tests against an isolated test database**

```js
it('prevents duplicate idempotency keys', async () => {
  const input = messageFixture({ idempotencyKey: 'attendance:2026-09-23:employee-42:in' });
  await enqueueMessage(input);
  await expect(enqueueMessage(input)).rejects.toMatchObject({ code: '23505' });
});

it('allows only one worker to claim a queued message', async () => {
  await enqueueMessage(messageFixture());
  const [a, b] = await Promise.all([
    claimMessageBatch({ workerId: 'a', limit: 1, leaseSeconds: 60 }),
    claimMessageBatch({ workerId: 'b', limit: 1, leaseSeconds: 60 })
  ]);
  expect([...a, ...b]).toHaveLength(1);
});
```

- [ ] **Step 2: Run the database tests and confirm failure**

Run: `npm test --workspace @bps/api -- test/db`  
Expected: FAIL because migrations and queue repository do not exist.

- [ ] **Step 3: Create normalized tables and constraints**

Create UUID primary keys, UTC `timestamptz` columns, foreign keys, check constraints, and indexes for the conceptual model in the spec. The `messages` queue must include:

```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  template_id uuid NOT NULL REFERENCES meta_templates(id),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN
    ('queued','sending','sent','delivered','read','failed','cancelled','suppressed')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  meta_message_id text UNIQUE,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_claim_idx
  ON messages (status, available_at, created_at)
  WHERE status = 'queued';
```

- [ ] **Step 4: Implement transaction and queue claiming**

```js
export async function claimMessageBatch(db, { workerId, limit, leaseSeconds }) {
  const { rows } = await db.query(`
    WITH candidates AS (
      SELECT id FROM messages
      WHERE status = 'queued' AND available_at <= now()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    UPDATE messages m
    SET status = 'sending', lease_owner = $2,
        lease_expires_at = now() + make_interval(secs => $3), updated_at = now()
    FROM candidates c WHERE m.id = c.id
    RETURNING m.*`, [limit, workerId, leaseSeconds]);
  return rows;
}
```

- [ ] **Step 5: Seed roles and explicit permissions**

Seed `super_admin`, `admin_diseminasi`, `operator`, and `viewer`, with permissions such as `campaign.read`, `campaign.write`, `campaign.send`, `contact.export`, `integration.manage`, `user.manage`, and `audit.read`.

- [ ] **Step 6: Verify migrations and concurrent claiming**

Run: `npm run migrate && npm test --workspace @bps/api -- test/db`  
Expected: all schema, uniqueness, foreign-key, and concurrency tests PASS.

- [ ] **Step 7: Commit the database foundation**

```bash
git add db apps/api/src/db apps/api/test/db scripts/migrate.js packages/shared
git commit -m "feat: add PostgreSQL schema and persistent message queue"
```

---

### Task 3: Authentication, sessions, RBAC, CSRF, and audit

**Files:**
- Create: `apps/api/src/features/auth/routes.js`
- Create: `apps/api/src/features/auth/service.js`
- Create: `apps/api/src/features/auth/repository.js`
- Create: `apps/api/src/middleware/authenticate.js`
- Create: `apps/api/src/middleware/authorize.js`
- Create: `apps/api/src/middleware/csrf.js`
- Create: `apps/api/src/features/audit/service.js`
- Create: `apps/api/test/auth/auth.test.js`
- Create: `apps/api/test/auth/rbac.test.js`
- Create: `apps/api/test/auth/csrf.test.js`

**Interfaces:**
- Consumes: identity/session schema and permission seed from Task 2.
- Produces: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/csrf`, `authenticate`, `authorize(permission)`, and `recordAudit(event)`.

- [ ] **Step 1: Write failing authentication and authorization tests**

```js
it('sets an opaque secure session and never returns a password hash', async () => {
  const response = await request(app).post('/api/auth/login')
    .send({ email: 'admin@bps.go.id', password: 'Valid-Passphrase-42' });
  expect(response.status).toBe(200);
  expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(response.body.user.passwordHash).toBeUndefined();
});

it('denies integration management to an operator', async () => {
  const response = await asRole('operator').patch('/api/integrations/meta').send({});
  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Confirm tests fail**

Run: `npm test --workspace @bps/api -- test/auth`  
Expected: FAIL with missing auth routes and middleware.

- [ ] **Step 3: Implement opaque sessions and Argon2id password verification**

Generate 32 random bytes for the browser session token, store only its SHA-256 hash, rotate on login, and set cookie options from validated config.

```js
const token = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
await sessions.create({ userId: user.id, tokenHash, csrfToken, expiresAt });
res.cookie('bps_session', token, {
  httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge
});
```

- [ ] **Step 4: Implement permission middleware and CSRF validation**

Require `x-csrf-token` for authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests. Compare tokens with `crypto.timingSafeEqual` and return the common error envelope `{ error: { code, message, correlationId } }`.

- [ ] **Step 5: Record security-sensitive audit events**

Record successful/failed login, logout, password reset by Super Admin, user/role changes, integration changes, export, send, cancel, and retry. Store a safe field-level summary, never request bodies containing secrets.

- [ ] **Step 6: Verify auth security**

Run: `npm test --workspace @bps/api -- test/auth`  
Expected: login, session expiry, rate limit, CSRF, role denial, and audit tests PASS.

- [ ] **Step 7: Commit authentication and authorization**

```bash
git add apps/api/src/features/auth apps/api/src/features/audit apps/api/src/middleware apps/api/test/auth
git commit -m "feat: add secure sessions RBAC and audit logging"
```

---

### Task 4: Svelte application shell and accessible design system

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/lib/api/client.js`
- Create: `apps/web/src/lib/stores/session.js`
- Create: `apps/web/src/lib/components/AppShell.svelte`
- Create: `apps/web/src/lib/components/Sidebar.svelte`
- Create: `apps/web/src/lib/components/TopBar.svelte`
- Create: `apps/web/src/lib/components/StatusChip.svelte`
- Create: `apps/web/src/lib/components/DataTable.svelte`
- Create: `apps/web/src/lib/components/FormField.svelte`
- Create: `apps/web/src/routes/Login.svelte`
- Create: `apps/web/src/routes/Overview.svelte`
- Create: `apps/web/test/accessibility.test.js`
- Create: `apps/web/test/login.test.js`

**Interfaces:**
- Consumes: Task 3 auth endpoints and `docs/design/GOOGLE-STITCH-PROMPT.md`.
- Produces: authenticated route guard, application shell, design tokens, reusable table/form/status components, and `apiFetch(path, options)`.

- [ ] **Step 1: Write failing login and accessibility tests**

```js
it('labels login fields and exposes an error summary', async () => {
  render(Login);
  expect(screen.getByLabelText('Email')).toBeVisible();
  expect(screen.getByLabelText('Kata sandi')).toBeVisible();
  await fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Periksa kembali');
});
```

- [ ] **Step 2: Confirm UI tests fail**

Run: `npm test --workspace @bps/web`  
Expected: FAIL because routes and components do not exist.

- [ ] **Step 3: Implement the approved color and typography tokens**

```css
:root {
  --color-action: #e37434;
  --color-sand: #ffe2af;
  --color-teal: #24b1b1;
  --color-authority: #007979;
  --color-canvas: #f7f7f3;
  --color-surface: #ffffff;
  --color-ink: #172020;
  --color-muted: #66706f;
  --color-border: #dce2df;
  --color-error: #b42318;
  --font-ui: "Geist", sans-serif;
  --font-mono: "Geist Mono", monospace;
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-action) 35%, transparent);
}
```

- [ ] **Step 4: Implement routing, session bootstrap, and the responsive shell**

Use `svelte-spa-router`, an `aria-label="Navigasi utama"` sidebar, a keyboard-accessible mobile drawer, a 1440px content container, and 44px minimum interactive targets. Route unauthorized users to `/login` and preserve the intended destination.

- [ ] **Step 5: Implement the shared API client**

```js
export async function apiFetch(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) throw await response.json();
  return response.status === 204 ? null : response.json();
}
```

- [ ] **Step 6: Verify desktop/mobile accessibility behavior**

Run: `npm test --workspace @bps/web && npm run build --workspace @bps/web`  
Expected: component tests PASS, no duplicate labels, keyboard navigation works, and the build contains no horizontal overflow regression fixture.

- [ ] **Step 7: Commit the application shell**

```bash
git add apps/web
git commit -m "feat: add accessible Svelte dashboard shell"
```

---

### Task 5: Contacts, employee profiles, segmentation, and safe import/export

**Files:**
- Create: `apps/api/src/features/contacts/routes.js`
- Create: `apps/api/src/features/contacts/service.js`
- Create: `apps/api/src/features/contacts/repository.js`
- Create: `apps/api/src/features/imports/service.js`
- Create: `apps/api/src/features/imports/parsers/csv.js`
- Create: `apps/api/src/features/imports/parsers/xlsx.js`
- Create: `packages/shared/src/schemas/contact.js`
- Create: `packages/shared/src/phone.js`
- Create: `apps/api/test/contacts/contacts.test.js`
- Create: `apps/api/test/contacts/import.test.js`
- Create: `apps/web/src/routes/Contacts.svelte`
- Create: `apps/web/src/routes/ContactDetail.svelte`
- Create: `apps/web/src/routes/ImportReview.svelte`

**Interfaces:**
- Consumes: auth/RBAC, audit service, PostgreSQL contacts schema.
- Produces: `normalizeIndonesianPhone(value)`, `upsertContact(input)`, paginated `/api/contacts`, `/api/imports/contacts`, `/api/exports/contacts`, and segment filter contract `{ type, unitId, tagIds, topicIds, status }`.

- [ ] **Step 1: Write failing normalization and import tests**

```js
expect(normalizeIndonesianPhone('0812 3456 7890')).toBe('+6281234567890');
expect(() => normalizeIndonesianPhone('123')).toThrow('Nomor WhatsApp tidak valid');

it('escapes spreadsheet formulas on export', () => {
  expect(safeSpreadsheetCell('=HYPERLINK("bad")')).toBe("'=HYPERLINK(\"bad\")");
});
```

- [ ] **Step 2: Confirm contact tests fail**

Run: `npm test --workspace @bps/api -- test/contacts`  
Expected: FAIL because normalization and import services are missing.

- [ ] **Step 3: Implement contact schemas and E.164 normalization**

Accept Indonesian `08...`, `628...`, and `+628...` inputs, strip separators, reject impossible lengths, and keep employee ID as the stable attendance-system key.

- [ ] **Step 4: Implement staged CSV/XLSX import**

Parse into `import_jobs` and `import_rows`; validate every row; show accepted, warning, and rejected counts; apply only explicitly accepted rows in one transaction. Store source filename and checksum, not the file forever.

- [ ] **Step 5: Implement permission-aware masking and export**

Return `+62••••••7890` unless the role has `contact.sensitive.read`. Escape cells beginning with `=`, `+`, `-`, or `@`. Audit every export with filters and row count.

- [ ] **Step 6: Build contacts, detail, and import review screens**

Implement Pegawai/Masyarakat tabs, filters, bulk tag actions, masked numbers, unit/subscription columns, import report, and an accessible mobile record layout.

- [ ] **Step 7: Verify contacts and imports**

Run: `npm test --workspace @bps/api -- test/contacts && npm test --workspace @bps/web -- Contacts`  
Expected: duplicate numbers merge predictably, invalid rows remain isolated, formula injection is neutralized, and role masking works.

- [ ] **Step 8: Commit audience management**

```bash
git add apps/api/src/features/contacts apps/api/src/features/imports packages/shared/src apps/api/test/contacts apps/web/src/routes
git commit -m "feat: add contact management and validated imports"
```

---

### Task 6: Topics, consent ledger, public subscription, and inbound commands

**Files:**
- Create: `apps/api/src/features/subscriptions/routes.js`
- Create: `apps/api/src/features/subscriptions/service.js`
- Create: `apps/api/src/features/subscriptions/repository.js`
- Create: `apps/api/src/features/subscriptions/commands.js`
- Create: `packages/shared/src/schemas/subscription.js`
- Create: `apps/api/test/subscriptions/consent.test.js`
- Create: `apps/api/test/subscriptions/race.test.js`
- Create: `apps/web/src/routes/public/Subscribe.svelte`
- Create: `apps/web/src/routes/public/ManageSubscription.svelte`
- Create: `apps/web/src/routes/public/UnsubscribeResult.svelte`
- Create: `apps/web/src/routes/Subscriptions.svelte`

**Interfaces:**
- Consumes: contacts, audit, authenticated and public rate-limit middleware.
- Produces: `recordConsent({ contactId, topicId, action, source, evidence })`, `isSuppressed(contactId, topicId)`, `handleInboundCommand({ from, text, receivedAt })`, public signed manage-link tokens, and subscription APIs.

- [ ] **Step 1: Write consent and unsubscribe-race tests**

```js
it('suppresses a queued public message after opt-out', async () => {
  const message = await queuePublicMessage({ contactId, topicId });
  await recordConsent({ contactId, topicId, action: 'unsubscribe', source: 'whatsapp' });
  expect(await canSendMessage(message.id)).toEqual({ allowed: false, reason: 'opted_out' });
});

it.each(['BERHENTI', 'berhenti semua', '  Daftar  '])('normalizes command %s', async (text) => {
  expect((await parseInboundCommand(text)).kind).toBeTruthy();
});
```

- [ ] **Step 2: Confirm subscription tests fail**

Run: `npm test --workspace @bps/api -- test/subscriptions`  
Expected: FAIL because consent and suppression services are missing.

- [ ] **Step 3: Implement append-only consent events and derived subscription state**

Every subscribe/unsubscribe creates a `consent_events` row with source, timestamp, and evidence. Update `subscriptions.status` in the same transaction. `BERHENTI SEMUA` also creates a public suppression entry.

- [ ] **Step 4: Implement public forms and signed management links**

Use expiring HMAC-signed tokens that reference contact ID and purpose. The form must include an unchecked explicit consent control, topic selection, privacy link, and generic success response that does not reveal whether a number already exists.

- [ ] **Step 5: Implement inbound command parsing**

Support only `DAFTAR`, `BERHENTI`, `BERHENTI SEMUA`, `BANTUAN`, and structured topic responses. Free text produces one concise redirect to the official service channel; do not create an inbox record for operator handling.

- [ ] **Step 6: Build subscription administration and public responsive screens**

Show topic counts, opt-in source, recent consent events, per-topic status, manage-topics, success, invalid-token, and expired-token states.

- [ ] **Step 7: Verify consent, race handling, and accessibility**

Run: `npm test --workspace @bps/api -- test/subscriptions && npm test --workspace @bps/web -- Subscription`  
Expected: append-only evidence, immediate suppression, idempotent repeated commands, and accessible public forms PASS.

- [ ] **Step 8: Commit subscription flows**

```bash
git add apps/api/src/features/subscriptions packages/shared/src/schemas/subscription.js apps/api/test/subscriptions apps/web/src/routes/public apps/web/src/routes/Subscriptions.svelte
git commit -m "feat: add consent and public subscription flows"
```

---

### Task 7: Meta WABA connection, template synchronization, and idempotent webhooks

**Files:**
- Create: `apps/api/src/features/integrations/crypto.js`
- Create: `apps/api/src/features/integrations/repository.js`
- Create: `apps/api/src/features/meta/client.js`
- Create: `apps/api/src/features/meta/templates.js`
- Create: `apps/api/src/features/meta/webhook.js`
- Create: `apps/api/src/features/meta/routes.js`
- Create: `packages/shared/src/schemas/meta.js`
- Create: `tests/contract/meta/template-list.json`
- Create: `tests/contract/meta/status-delivered.json`
- Create: `tests/contract/meta/inbound-text.json`
- Create: `apps/api/test/meta/webhook.test.js`
- Create: `apps/api/test/meta/templates.test.js`
- Create: `apps/web/src/routes/Templates.svelte`
- Create: `apps/web/src/routes/TemplateDetail.svelte`
- Create: `apps/web/src/routes/Integrations.svelte`

**Interfaces:**
- Consumes: encrypted integration storage, subscription command handler, message tables.
- Produces: `metaClient.sendTemplate(input)`, `syncTemplates()`, `GET /api/meta/webhook`, `POST /api/meta/webhook`, `POST /api/integrations/meta/test`, and normalized status events.

- [ ] **Step 1: Add official contract fixtures and failing webhook tests**

```js
it('does not regress delivered to sent when events arrive out of order', async () => {
  await applyMetaStatus({ messageId: 'wamid.1', status: 'delivered', timestamp: 20 });
  await applyMetaStatus({ messageId: 'wamid.1', status: 'sent', timestamp: 10 });
  expect(await messageStatus('wamid.1')).toBe('delivered');
});

it('stores a duplicate webhook once', async () => {
  await ingestWebhook(fixture);
  await ingestWebhook(fixture);
  expect(await webhookEventCount(fixture)).toBe(1);
});
```

- [ ] **Step 2: Confirm Meta tests fail**

Run: `npm test --workspace @bps/api -- test/meta`  
Expected: FAIL because the Meta adapter and webhook processing do not exist.

- [ ] **Step 3: Implement encrypted secrets and Meta client boundaries**

Encrypt values with AES-256-GCM using `APP_ENCRYPTION_KEY`, store IV/auth tag/ciphertext, and expose secrets only inside adapter methods. Add request timeout, correlation ID, safe error mapping, and no automatic retry inside the HTTP client.

- [ ] **Step 4: Implement template synchronization**

Fetch WABA templates, upsert identity/category/language/status/components, mark absent templates archived, and permit selection only for approved/supported templates. Persist variable positions and sample values without allowing local structural edits.

- [ ] **Step 5: Implement webhook verification and ingestion**

Validate the verification challenge, verify the request signature using the raw body, hash each event for deduplication, persist before processing, and return HTTP 200 quickly. Dispatch message status and inbound subscription commands after persistence.

- [ ] **Step 6: Implement monotonic status application**

Use event timestamps and a status rank map for `queued < sending < sent < delivered < read`; `failed` is terminal only for the corresponding send attempt. Preserve every event in `message_status_events` even when the aggregate status does not advance.

- [ ] **Step 7: Build templates and integrations screens**

Show template status, category, language, mapping, WhatsApp-style preview, last sync, connection test, masked IDs/secrets, last webhook, and safe errors.

- [ ] **Step 8: Verify Meta integration**

Run: `npm test --workspace @bps/api -- test/meta && npm test --workspace @bps/web -- Templates Integrations`  
Expected: signature rejection, duplicate webhook, out-of-order status, template sync, and secret masking tests PASS.

- [ ] **Step 9: Commit Meta integration**

```bash
git add apps/api/src/features/meta apps/api/src/features/integrations packages/shared/src/schemas/meta.js tests/contract/meta apps/api/test/meta apps/web/src/routes
git commit -m "feat: integrate Meta templates and status webhooks"
```

---

### Task 8: Campaign composer, recipient expansion, preview, test-send, and cancellation

**Files:**
- Create: `apps/api/src/features/campaigns/routes.js`
- Create: `apps/api/src/features/campaigns/service.js`
- Create: `apps/api/src/features/campaigns/repository.js`
- Create: `apps/api/src/features/campaigns/renderer.js`
- Create: `packages/shared/src/schemas/campaign.js`
- Create: `apps/api/test/campaigns/campaign.test.js`
- Create: `apps/api/test/campaigns/suppression.test.js`
- Create: `apps/web/src/routes/Campaigns.svelte`
- Create: `apps/web/src/routes/CampaignCreate.svelte`
- Create: `apps/web/src/routes/CampaignDetail.svelte`
- Create: `apps/web/src/lib/components/MessagePreview.svelte`

**Interfaces:**
- Consumes: contact segment filters, template mappings, consent/suppression check, queue enqueue.
- Produces: `createCampaign(input)`, `previewCampaign(id)`, `expandRecipients(id)`, `queueTestSend(id, contactId)`, `scheduleCampaign(id, instant)`, and `cancelRemaining(id)`.

- [ ] **Step 1: Write failing campaign lifecycle tests**

```js
it('freezes content and audience definition when scheduled', async () => {
  const campaign = await createDraft(validDraft);
  await scheduleCampaign(campaign.id, '2026-10-01T01:00:00Z');
  await expect(updateCampaign(campaign.id, { name: 'Changed' }))
    .rejects.toMatchObject({ code: 'CAMPAIGN_IMMUTABLE' });
});

it('rechecks suppression immediately before enqueue and send', async () => {
  await expandRecipients(campaignId);
  await unsubscribe(contactId, topicId);
  expect(await queueCampaign(campaignId)).toMatchObject({ suppressed: 1, queued: 0 });
});
```

- [ ] **Step 2: Confirm campaign tests fail**

Run: `npm test --workspace @bps/api -- test/campaigns`  
Expected: FAIL because campaign services are absent.

- [ ] **Step 3: Implement draft, preview, and variable validation**

Require every approved template variable to have a source or literal value. Render a bounded text preview, detect missing values and unsafe URLs, and show three representative recipients without creating messages.

- [ ] **Step 4: Implement recipient snapshot expansion**

Resolve filters into `campaign_recipients`, de-duplicate contact IDs, record exclusion reasons, and perform work in pages so a 5,000-contact audience never lives entirely in process memory.

- [ ] **Step 5: Implement test-send, schedule, and cancellation**

Test-send targets only an explicitly selected internal/test contact and is labeled in logs. Scheduling freezes the template and audience definition. Cancellation atomically marks remaining `queued` rows cancelled and never claims it can recall messages already accepted by Meta.

- [ ] **Step 6: Build the four-step campaign wizard and detail screen**

Implement Audience, Template, Schedule, Review; persistent recipient/exclusion summary; WITA display; test-send; immutable detail metadata; delivery funnel; failure table; cancel and duplicate actions.

- [ ] **Step 7: Verify campaign behavior**

Run: `npm test --workspace @bps/api -- test/campaigns && npm test --workspace @bps/web -- Campaign`  
Expected: immutability, deduplication, suppression race, preview errors, test-send, and cancellation tests PASS.

- [ ] **Step 8: Commit campaign management**

```bash
git add apps/api/src/features/campaigns packages/shared/src/schemas/campaign.js apps/api/test/campaigns apps/web/src/routes apps/web/src/lib/components/MessagePreview.svelte
git commit -m "feat: add safe campaign composition and scheduling"
```

---

### Task 9: WITA scheduler, holiday calendar, bounded cron worker, retry, and circuit breaker

**Files:**
- Create: `apps/worker/src/run-once.js`
- Create: `apps/worker/src/scheduler.js`
- Create: `apps/worker/src/sender.js`
- Create: `apps/worker/src/retry.js`
- Create: `apps/worker/src/circuit-breaker.js`
- Create: `apps/api/src/features/calendar/routes.js`
- Create: `apps/api/src/features/calendar/service.js`
- Create: `apps/api/test/calendar/schedule.test.js`
- Create: `apps/worker/test/concurrency.test.js`
- Create: `apps/worker/test/retry.test.js`
- Create: `apps/web/src/routes/Schedules.svelte`

**Interfaces:**
- Consumes: campaign queue, Meta send client, automation rule hooks, PostgreSQL advisory/row locks.
- Produces: `isWorkday(date, calendar)`, `evaluateDueSchedules(now)`, `runOnce({ maxRuntimeMs, batchSize })`, `classifyMetaError(error)`, and heartbeat records.

- [ ] **Step 1: Write failing timezone, holiday, concurrency, and retry tests**

```js
it('treats 16:30 UTC as the next WITA calendar day', () => {
  expect(toWitaDate('2026-09-30T16:30:00Z')).toBe('2026-10-01');
});

it('skips a local exception even when Monday is normally active', async () => {
  expect(await isWorkday('2026-10-05')).toBe(false);
});

it('does not double-send when two cron runs overlap', async () => {
  await Promise.all([runOnce(testOptions), runOnce(testOptions)]);
  expect(metaSendSpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Confirm scheduler/worker tests fail**

Run: `npm test --workspace @bps/worker && npm test --workspace @bps/api -- test/calendar`  
Expected: FAIL because calendar and worker logic are absent.

- [ ] **Step 3: Implement calendar evaluation in WITA**

Use Luxon with `Asia/Makassar`, calculate due instants once, and store UTC. Merge weekly rules, national holidays, collective leave, and local exceptions with explicit precedence: local forced-workday, local closure, national closure, weekly rule.

- [ ] **Step 4: Implement bounded one-shot worker**

Acquire a PostgreSQL advisory lock for scheduler expansion, recover expired leases, claim batches using Task 2 primitives, recheck campaign cancellation and suppression, send, persist result, and stop claiming when `maxRuntimeMs - elapsed < safetyMarginMs`.

- [ ] **Step 5: Implement retry and circuit breaker**

Classify timeouts, connection resets, 429, and selected 5xx responses as transient. Compute `min(base * 2 ** attempt + jitter, maxDelay)`. Mark invalid recipient, rejected template, opt-out, and authorization configuration failures as permanent or circuit-opening according to class.

- [ ] **Step 6: Record heartbeats and actionable alerts**

Each run records started/finished time, claimed/sent/retried/failed counts, and duration. Create alerts for late cron, old queue age, open circuit, or repeated failure threshold.

- [ ] **Step 7: Build schedules/calendar UI**

Implement month view, WITA labels, rule summaries, national/collective/local exception forms, and accessible non-color status labels.

- [ ] **Step 8: Verify worker safety**

Run: `npm test --workspace @bps/worker && npm test --workspace @bps/api -- test/calendar`  
Expected: WITA boundary, holiday precedence, overlapping cron, lease recovery, retry delay, and circuit tests PASS.

- [ ] **Step 9: Commit scheduling and worker**

```bash
git add apps/worker apps/api/src/features/calendar apps/api/test/calendar apps/web/src/routes/Schedules.svelte
git commit -m "feat: add WITA scheduler and bounded cron worker"
```

---

### Task 10: Attendance, Silastik, publication adapters, and automation rules

**Files:**
- Create: `apps/api/src/features/automations/routes.js`
- Create: `apps/api/src/features/automations/service.js`
- Create: `apps/api/src/features/automations/repository.js`
- Create: `apps/api/src/adapters/attendance.js`
- Create: `apps/api/src/adapters/silastik.js`
- Create: `apps/api/src/adapters/publications.js`
- Create: `apps/api/src/adapters/manual.js`
- Create: `apps/api/src/adapters/import.js`
- Create: `tests/contract/attendance/not-checked-in.json`
- Create: `tests/contract/silastik/new-transaction.json`
- Create: `tests/contract/publications/release.json`
- Create: `apps/api/test/automations/attendance.test.js`
- Create: `apps/api/test/automations/deduplication.test.js`
- Create: `apps/web/src/routes/Automations.svelte`
- Create: `apps/web/src/routes/AutomationEdit.svelte`

**Interfaces:**
- Consumes: calendar service, templates, contacts, queue, encrypted integrations.
- Produces: adapter interface `fetchEvents({ since, cursor }) -> { events, nextCursor, observedAt }`, `evaluateAutomation(rule, event)`, and automation CRUD/run APIs.

- [ ] **Step 1: Write failing adapter and stale-attendance tests**

```js
it('enqueues only employees not checked in', async () => {
  attendance.fetchStatus.mockResolvedValue(freshStatus(['EMP-002']));
  const result = await runAttendanceRule(rule, now);
  expect(result).toMatchObject({ queued: 1, skippedPresent: 83 });
});

it('enqueues zero reminders when attendance data is stale', async () => {
  attendance.fetchStatus.mockResolvedValue(staleStatus(['EMP-002']));
  const result = await runAttendanceRule(rule, now);
  expect(result.queued).toBe(0);
  expect(result.alertCode).toBe('ATTENDANCE_DATA_STALE');
});
```

- [ ] **Step 2: Confirm automation tests fail**

Run: `npm test --workspace @bps/api -- test/automations`  
Expected: FAIL because adapters and automation engine are absent.

- [ ] **Step 3: Implement stable adapter contracts with mock/manual/import modes**

Every adapter maps source records to a normalized event containing `source`, `externalId`, `type`, `occurredAt`, `observedAt`, and `payload`. Use a unique `(source, external_id, type)` constraint for event ingestion.

- [ ] **Step 4: Implement attendance freshness gate**

Require a configured maximum age and full response validation before evaluating employees. Match by employee ID. On timeout, partial schema, missing roster coverage, or stale observation time, enqueue zero reminders and create an alert.

- [ ] **Step 5: Implement Silastik and publication triggers**

Use transaction number as Silastik external identity. Use publication/BRS source ID plus release date as publication identity. Validate public URLs and map PIC/topic/template variables before enqueue.

- [ ] **Step 6: Implement structured automation editor**

Provide rule-specific fields: source, event, schedule/offsets, freshness threshold, recipient mapping, template, active state, and test evaluation. Do not expose arbitrary JavaScript or SQL.

- [ ] **Step 7: Verify automation safety and deduplication**

Run: `npm test --workspace @bps/api -- test/automations && npm test --workspace @bps/web -- Automation`  
Expected: stale data block, 84-employee selection, repeated event deduplication, offset evaluation, and invalid mapping tests PASS.

- [ ] **Step 8: Commit connectors and automations**

```bash
git add apps/api/src/features/automations apps/api/src/adapters tests/contract apps/api/test/automations apps/web/src/routes
git commit -m "feat: add source adapters and broadcast automations"
```

---

### Task 11: Operational dashboard, message logs, health, alerts, and reports

**Files:**
- Create: `apps/api/src/features/dashboard/routes.js`
- Create: `apps/api/src/features/dashboard/repository.js`
- Create: `apps/api/src/features/messages/routes.js`
- Create: `apps/api/src/features/messages/repository.js`
- Create: `apps/api/src/features/health/routes.js`
- Create: `apps/api/src/features/health/service.js`
- Create: `apps/api/src/features/reports/routes.js`
- Create: `apps/api/test/dashboard/dashboard.test.js`
- Create: `apps/api/test/messages/logs.test.js`
- Modify: `apps/web/src/routes/Overview.svelte`
- Create: `apps/web/src/routes/MessageLogs.svelte`
- Create: `apps/web/src/routes/AuditLog.svelte`
- Create: `apps/web/src/lib/components/HealthStrip.svelte`
- Create: `apps/web/src/lib/components/MessageTimeline.svelte`

**Interfaces:**
- Consumes: messages, status events, integration runs, worker heartbeats, alerts, audits.
- Produces: `/api/dashboard/summary`, `/api/dashboard/trends`, `/api/messages`, `/api/messages/:id`, `/api/health/ready`, and permission-aware report exports.

- [ ] **Step 1: Write failing aggregation and privacy tests**

```js
it('counts each message once at its latest aggregate status', async () => {
  const summary = await getDashboardSummary(range);
  expect(summary.total).toBe(
    summary.queued + summary.sending + summary.sent + summary.delivered +
    summary.read + summary.failed + summary.cancelled + summary.suppressed
  );
});

it('masks recipient numbers for viewers', async () => {
  const row = await getMessageForRole(messageId, 'viewer');
  expect(row.recipient).toMatch(/^\+62•+/);
});
```

- [ ] **Step 2: Confirm dashboard tests fail**

Run: `npm test --workspace @bps/api -- test/dashboard test/messages`  
Expected: FAIL because aggregate repositories and routes are absent.

- [ ] **Step 3: Implement indexed aggregates and health evaluation**

Query summary by bounded date range and pre-aggregate only if measured query latency requires it. Health evaluates last successful integration, last webhook, cron heartbeat age, queue oldest age, open circuit, and active alerts.

- [ ] **Step 4: Implement searchable logs and chronological message detail**

Use cursor pagination for large logs. Expose safe payload summaries, error code/category, attempts, correlation ID, and ordered status events; never expose bearer tokens or full raw webhook bodies.

- [ ] **Step 5: Build the asymmetric operational overview**

Place health strip first, then compact KPIs, 14-day trend, queue distribution, upcoming schedules, and actionable issues in an 8/4 layout. Use Geist Mono for metrics and stable, restrained chart animation.

- [ ] **Step 6: Build message and audit log screens**

Implement server filters, sticky table headers, cursor pagination, masked recipients, export permission, and a right-side accessible detail drawer with timeline.

- [ ] **Step 7: Verify dashboard correctness**

Run: `npm test --workspace @bps/api -- test/dashboard test/messages && npm test --workspace @bps/web -- Overview MessageLogs AuditLog`  
Expected: totals, date boundaries, masking, pagination, error summaries, and keyboard drawer tests PASS.

- [ ] **Step 8: Commit observability UI and APIs**

```bash
git add apps/api/src/features/dashboard apps/api/src/features/messages apps/api/src/features/health apps/api/src/features/reports apps/api/test apps/web/src
git commit -m "feat: add operational dashboard and message observability"
```

---

### Task 12: Full-system security, performance, and end-to-end acceptance

**Files:**
- Create: `tests/e2e/auth.spec.js`
- Create: `tests/e2e/campaign.spec.js`
- Create: `tests/e2e/subscription.spec.js`
- Create: `tests/e2e/automation.spec.js`
- Create: `tests/e2e/accessibility.spec.js`
- Create: `tests/load/campaign-5000.test.js`
- Create: `tests/security/webhook-forgery.test.js`
- Create: `tests/security/authorization-matrix.test.js`
- Create: `playwright.config.js`
- Create: `docs/test-evidence/mvp-acceptance.md`

**Interfaces:**
- Consumes: all application modules.
- Produces: executable acceptance suite and recorded evidence for every MVP acceptance criterion.

- [ ] **Step 1: Write end-to-end happy-path tests**

```js
test('operator schedules a campaign and sees delivered status', async ({ page }) => {
  await loginAs(page, 'operator');
  await createCampaign(page, publicationCampaignFixture);
  await testSend(page);
  await scheduleForNextMinute(page);
  await runWorkerOnce();
  await postMetaWebhook('status-delivered.json');
  await expect(page.getByText('Terkirim')).toBeVisible();
});
```

- [ ] **Step 2: Add the 5,000-recipient performance test**

Seed 5,000 opted-in subscribers, expand one campaign, run bounded batches with a fake Meta adapter, and concurrently request dashboard summary. On the recorded staging test host, assert no duplicate messages, campaign expansion finishes within 60 seconds, dashboard-summary p95 stays at or below 500ms while a worker batch is active, every worker invocation stays below `maxRuntimeMs = 45_000`, and the backlog reaches zero over repeated runs.

- [ ] **Step 3: Add security regression tests**

Test forged Meta signature, missing CSRF, expired session, role escalation, oversized JSON, malicious XLSX/CSV cells, invalid URL, repeated login, secret leakage in logs, and unauthorized export.

- [ ] **Step 4: Add automated accessibility checks**

Run Axe on login, overview, campaign wizard, contacts, logs, integrations, and public subscription at desktop and mobile widths. Fail on serious/critical violations, missing labels, focus traps, or status conveyed only by color.

- [ ] **Step 5: Run the complete quality gate**

Run: `npm test && npm run build && npx playwright test`  
Expected: unit, integration, contract, security, load, E2E, and accessibility suites PASS.

- [ ] **Step 6: Record measured evidence**

In `docs/test-evidence/mvp-acceptance.md`, record test environment, commit SHA, 5,000-recipient duration, API p95, max worker duration, queue drain count, accessibility result, and links to logs/screenshots generated by Playwright.

- [ ] **Step 7: Commit acceptance coverage**

```bash
git add tests playwright.config.js docs/test-evidence
git commit -m "test: add end-to-end security and load acceptance"
```

---

### Task 13: Hosting-panel deployment, cron, backup, and recovery runbooks

**Files:**
- Create: `scripts/deploy-build.js`
- Create: `scripts/cron-worker.js`
- Create: `scripts/health-check.js`
- Create: `scripts/backup-postgres.sh`
- Create: `docs/runbooks/panel-deployment.md`
- Create: `docs/runbooks/cron-and-worker.md`
- Create: `docs/runbooks/meta-webhook.md`
- Create: `docs/runbooks/backup-and-restore.md`
- Create: `docs/runbooks/incident-response.md`
- Create: `docs/runbooks/release-checklist.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: production build, migration command, worker `runOnce`, panel capabilities.
- Produces: repeatable panel deployment procedure, one-minute cron command, backup/restore procedure, health check, rollback instructions, and release checklist.

- [ ] **Step 1: Add a deployment preflight command**

```js
const required = ['DATABASE_URL', 'SESSION_SECRET', 'APP_ENCRYPTION_KEY', 'PUBLIC_APP_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1);
```

- [ ] **Step 2: Document the exact panel layout**

Specify one static subdomain/document root for `apps/web/dist`, one Node.js Application entrypoint for `apps/api/src/server.js`, proxy/base URL behavior supplied by the panel, environment variables, PostgreSQL connection, HTTPS requirement, and webhook URL `/api/meta/webhook`.

- [ ] **Step 3: Add the bounded cron entrypoint**

```js
import { runOnce } from '../apps/worker/src/run-once.js';

const result = await runOnce({ maxRuntimeMs: 45_000, batchSize: 100 });
console.log(JSON.stringify({ event: 'worker_complete', ...result }));
```

Document the panel cron command as `cd /absolute/app/path && /absolute/node/path node scripts/cron-worker.js`, scheduled every minute, with output redirected to the panel-supported rotating log destination.

- [ ] **Step 4: Document safe release and rollback**

Release order: backup, maintenance notice, install locked dependencies with `npm ci`, run migrations, build Svelte, deploy static assets, restart Node.js Application from panel, test live/ready endpoints, run worker once, verify Meta webhook, and remove maintenance notice. Rollback application files to the prior release; use forward database migrations unless the migration explicitly includes and tests a safe down path.

- [ ] **Step 5: Document backup and restore drill**

Use panel-native PostgreSQL backup when available; otherwise call `pg_dump --format=custom`. Encrypt off-server copies, define retention, and rehearse restore into a separate database before calling backup verified.

- [ ] **Step 6: Add production smoke checks**

Check login, `/api/health/live`, `/api/health/ready`, template sync, test contact send, webhook receipt, one cron heartbeat, public subscribe/unsubscribe, masking, and audit entries. Never use the 5,000-recipient campaign as a production smoke test.

- [ ] **Step 7: Verify the release documentation from a clean checkout**

Run: `npm ci && npm run migrate && npm test && npm run build && node scripts/health-check.js`  
Expected: clean installation succeeds, migrations are idempotent, tests/build pass, and the health script exits zero against the staged application.

- [ ] **Step 8: Commit deployment assets and runbooks**

```bash
git add scripts docs/runbooks .env.example
git commit -m "docs: add panel deployment and recovery runbooks"
```

---

## Milestones and release order

1. **Foundation:** Tasks 1–4 provide workspace, database, security, and application shell.
2. **Audience and consent:** Tasks 5–6 provide safe contact intake and public subscription controls.
3. **Messaging core:** Tasks 7–9 provide Meta integration, campaigns, persistent queue, and cron processing.
4. **Automations and visibility:** Tasks 10–11 provide BPS-specific triggers, health, logs, and reporting.
5. **Production readiness:** Tasks 12–13 provide acceptance evidence and hosting-panel operations.

Do not connect production WABA credentials before Tasks 1–9 pass in a staging environment with a test number. Do not import real public subscriber data before Tasks 3, 5, 6, and the security portion of Task 12 pass.

## Definition of done

- Every acceptance criterion in the spec has an automated test or documented production smoke check.
- All migrations apply from an empty supported PostgreSQL database.
- `npm test`, `npm run build`, and `npx playwright test` pass from a clean checkout.
- The 5,000-recipient simulation drains without duplicate sends or dashboard starvation.
- Meta webhook verification, signature validation, status ingestion, and template sync pass against official fixtures and staging.
- All four roles pass the authorization matrix.
- Consent and unsubscribe race tests pass.
- Hosting-panel deployment, cron, backup, restore, and rollback are rehearsed and recorded.
- UI matches the approved Stitch design direction and passes WCAG AA automated checks plus keyboard review.

