# TODO-3: SmartIV Ads — Next Phase Roadmap

> **Audit Date**: 3 Maret 2026  
> **Auditor**: Backend Engineering  
> **Current State**: 12 modules · 17 Prisma models · 69 endpoints · 240 unit tests

---

## 🔴 Priority 1 — Security & Auth Hardening

### Phase 16: Authentication Refresh & Session Security

> **Kenapa penting**: JWT saat ini hanya punya `accessToken` tanpa `refreshToken`. Jika token dicuri, attacker punya akses selama 1 hari penuh. Tidak ada cara untuk revoke.

- [ ] **Refresh Token System**
  - [ ] Buat model `RefreshToken` di Prisma (token hash, userId, expiresAt, revoked)
  - [ ] Update `POST /auth/login` → return `{ accessToken (15min), refreshToken (7d) }`
  - [ ] Endpoint `POST /auth/refresh` → generate accessToken baru dari refreshToken valid
  - [ ] Endpoint `POST /auth/logout` → revoke refreshToken (invalidate session)
  - [ ] Cron job / scheduled task untuk bersihkan expired refresh tokens

- [ ] **Password Security Enhancement**
  - [ ] Minimum password strength validation (min 8 chars, uppercase, number, special)
  - [ ] Account lockout setelah 5x gagal login (lock 15 menit)
  - [ ] Rate limiting khusus `/auth/login` dan `/auth/forgot-password` (lebih ketat dari global)

- [ ] **CORS Hardening**
  - [ ] Ganti `app.enableCors()` (allow all) → whitelist domain Frontend production
  - [ ] Set `credentials: true` untuk cookie-based refresh token

---

### Phase 17: API Rate Limiting & Throttling

> **Kenapa penting**: Saat ini tidak ada rate limiter. Endpoint publik bisa di-spam tanpa batas.

- [ ] Install `@nestjs/throttler`
- [ ] Global: 100 req/min per IP
- [ ] Auth endpoints: 10 req/min (anti brute-force)
- [ ] Media upload: 5 req/min (anti flood)
- [ ] Telemetry ingestion: 60 req/min per device (anti fake impressions)

---

## 🟠 Priority 2 — Missing Business Features

### Phase 18: Notification System

> **Kenapa penting**: Frontend dan Operator tidak punya cara tahu kapan campaign di-approve, media di-review, atau withdrawal diproses. Semua harus manual buka dashboard.

- [ ] **Model `Notification`** di Prisma:
  ```
  model Notification {
    id        Int      @id @default(autoincrement())
    userId    Int
    title     String
    message   String
    type      String   // CAMPAIGN_APPROVED, MEDIA_REVIEWED, WITHDRAWAL_PROCESSED, etc.
    isRead    Boolean  @default(false)
    metadata  Json?    // { campaignId: 5, status: 'APPROVED' }
    createdAt DateTime @default(now())
  }
  ```
- [ ] `GET /notifications` — list notifikasi user (paginated)
- [ ] `PATCH /notifications/:id/read` — mark as read
- [ ] `PATCH /notifications/read-all` — mark all as read
- [ ] `GET /notifications/unread-count` — badge count untuk frontend
- [ ] Hook notifikasi ke event:
  - [ ] Campaign approved/rejected → notify Advertiser
  - [ ] Media approved/rejected → notify Advertiser
  - [ ] Withdrawal approved/rejected → notify Advertiser/Operator
  - [ ] New campaign pending review → notify Admin
  - [ ] Screen offline > 30 min → notify Operator

---

### Phase 19: Campaign Scheduling & Auto-Expiry (CRON Jobs)

> **Kenapa penting**: Campaign yang sudah `endDate` lewat tetap berstatus `ACTIVE`. Tidak ada mekanisme otomatis untuk menghentikan campaign expired.

- [ ] **Scheduled Task** (via `@nestjs/schedule`):
  - [ ] `@Cron('0 * * * *')` — setiap jam cek campaign yang `endDate < now()` → ubah status ke `COMPLETED`
  - [ ] `@Cron('0 0 * * *')` — setiap tengah malam cek screen yang `lastPing < 24 jam` → ubah status ke `OFFLINE`
  - [ ] `@Cron('0 1 * * *')` — daily publisher ledger reconciliation (akumulasi impressions harian)

- [ ] **Campaign Pause/Resume**
  - [ ] `PATCH /campaigns/:id/pause` — Advertiser bisa pause campaign (status → `PAUSED`)
  - [ ] `PATCH /campaigns/:id/resume` — Advertiser bisa resume campaign (status → `ACTIVE`)
  - [ ] Paused campaigns tidak tampil di player playlist

---

### Phase 20: Audit Log Endpoints & Admin Activity Tracking

> **Kenapa penting**: Model `AuditLog` sudah ada di schema, tapi belum ada endpoint untuk baca dan belum ada hook untuk tulis otomatis.

- [ ] **Auto-logging** via NestJS Interceptor:
  - [ ] Log semua operasi mutasi (CREATE, UPDATE, DELETE) oleh Admin
  - [ ] Simpan: userId, action, resource, resourceId, oldValue, newValue, IP, timestamp
- [ ] `GET /admin/audit-logs` — list audit log (paginated, filter by action/userId/date range)
- [ ] `GET /admin/audit-logs/:id` — detail audit log
- [ ] Dashboard widget: "Recent Admin Activities" (last 24h)

---

## 🟡 Priority 3 — Analytics & Reporting Enhancement

### Phase 21: Advanced Analytics

> **Kenapa penting**: Dashboard analytics saat ini terlalu basic — hanya count dan sum. Tidak ada trend, chart data, atau perbandingan period.

- [ ] **Advertiser Analytics Enhancement**
  - [ ] `GET /analytics/advertiser/performance` — campaign performance over time (impressions/day chart data)
  - [ ] `GET /analytics/advertiser/top-campaigns` — top 5 campaigns by impressions
  - [ ] `GET /analytics/advertiser/spend-history` — monthly spend breakdown (chart data)

- [ ] **Admin Analytics Enhancement**
  - [ ] `GET /analytics/admin/revenue-trend` — revenue per day/week/month (line chart data)
  - [ ] `GET /analytics/admin/top-properties` — top properties by impressions & revenue
  - [ ] `GET /analytics/admin/user-growth` — new registrations per month
  - [ ] `GET /analytics/admin/campaign-funnel` — draft → pending → approved → active conversion rates

- [ ] **Operator Analytics Enhancement**
  - [ ] `GET /analytics/operator/screen-uptime` — uptime percentage per screen (last 7/30 days)
  - [ ] `GET /analytics/operator/revenue-trend` — daily revenue chart data
  - [ ] `GET /analytics/operator/impression-heatmap` — impressions by hour (24h heatmap data)

---

### Phase 22: Reporting & Export

> **Kenapa penting**: Stakeholder butuh download data dalam format spreadsheet untuk accounting & presentation.

- [ ] `GET /reports/campaigns/export?format=csv` — export campaign data (admin)
- [ ] `GET /reports/transactions/export?format=csv` — export transaksi (admin)
- [ ] `GET /reports/publisher/export?format=csv` — export publisher earnings (operator)
- [ ] `GET /reports/impressions/export?format=csv` — export impression log (admin)
- [ ] Gunakan streaming response untuk file besar (hindari memory overflow)

---

## 🟢 Priority 4 — Infrastructure & Scalability

### Phase 23: Redis Caching Layer

> **Backlog dari TODO-2** (deferred karena butuh Redis connection). Redis sudah ada di docker-compose.

- [ ] Install `@nestjs/cache-manager` + `cache-manager-redis-store`
- [ ] Cache hot endpoints:
  - [ ] `GET /inventory/properties/list` — TTL 5 menit (dropdown jarang berubah)
  - [ ] `GET /inventory/categories` — TTL 1 jam (master data)
  - [ ] `GET /player/config` — TTL 10 menit (device config)
  - [ ] `GET /player/playlist` — TTL 1 menit (balance freshness vs performance)
  - [ ] `GET /analytics/*` — TTL 5 menit (dashboard metrics)
- [ ] Cache invalidation hooks (bust cache saat data berubah)
- [ ] Redis-based rate limiting (lebih scalable dari in-memory)

---

### Phase 24: Integration Sync Engine (Carried over from Phase 15)

> **Backlog dari TODO-2** — endpoint API untuk sinkronisasi data dari sistem eksternal.

- [ ] **`ApiKeyGuard`** — guard khusus untuk integrasi sistem-ke-sistem (bukan Bearer JWT)
  - [ ] Model `ApiKey` (key, secret, name, permissions[], isActive, lastUsedAt)
  - [ ] Guard validasi `X-Api-Key` header
- [ ] `POST /integration/sync-inventory` — sinkronisasi data properti & screen dari PMS (Property Management System)
- [ ] `POST /integration/sync-status` — update status campaign dari sistem eksternal
- [ ] Rate limit: 30 req/min per API key

---

### Phase 25: WebSocket Real-Time Updates

> **Kenapa penting**: Agar frontend tidak perlu polling untuk update — notification, dashboard metrics, dan screen status bisa live.

- [ ] Install `@nestjs/websockets` + `socket.io`
- [ ] **WebSocket Gateways**:
  - [ ] `NotificationGateway` — push notifikasi real-time ke user
  - [ ] `DashboardGateway` — live update dashboard metrics (new impressions count)
  - [ ] `ScreenStatusGateway` — live screen online/offline status change
- [ ] JWT-based WebSocket authentication
- [ ] Namespace per role: `/ws/admin`, `/ws/advertiser`, `/ws/operator`

---

## 🔵 Priority 5 — Code Quality & DevOps

### Phase 26: E2E Testing with Supertest

> **Kenapa penting**: curl test suite bagus tapi manual dan fragile. E2E test terintegrasi lebih reliable.

- [ ] Setup Jest + Supertest E2E module
- [ ] Auth flow E2E (register → login → profile → change-password)
- [ ] Campaign lifecycle E2E (create → submit → review → active → complete)
- [ ] Finance flow E2E (topup → freeze → spend → refund)
- [ ] Integrate ke GitHub Actions CI pipeline

---

### Phase 27: Monitoring & Observability

> **Kenapa penting**: Jika production down, saat ini tidak ada alert dan tidak ada cara cepat diagnosis.

- [ ] **Health Check Endpoint** — `GET /health` (deep check: DB + Redis + MinIO + BullMQ)
- [ ] **Prometheus Metrics** — request count, latency, error rate, queue depth
- [ ] **Structured Logging** — JSON format logs (bukan plain text) untuk integrasi dengan log aggregator
- [ ] Alerting rules: 5xx spike, queue backup, DB connection pool exhausted

---

### Phase 28: Documentation & DX (Developer Experience)

> **Kenapa penting**: Onboarding developer baru harus cepat. Saat ini tidak ada README yang memadai.

- [ ] `README.md` overhaul — setup guide, architecture diagram, module overview
- [ ] `CONTRIBUTING.md` — coding standards, commit message format, PR checklist
- [ ] `.env.example` audit — pastikan semua env vars terdokumentasi + ada default value
- [ ] Postman/Insomnia collection export (alternative ke Scalar untuk debugging manual)
- [ ] Architecture Decision Records (ADRs) untuk keputusan desain kunci

---

## 📊 Summary Matrix

| Phase | Area                   | Priority  | Effort | Impact         |
| ----- | ---------------------- | --------- | ------ | -------------- |
| 16    | Refresh Token & Auth   | 🔴 High   | Medium | 🔒 Security    |
| 17    | Rate Limiting          | 🔴 High   | Low    | 🔒 Security    |
| 18    | Notification System    | 🟠 Medium | High   | 📱 UX          |
| 19    | CRON Jobs & Scheduling | 🟠 Medium | Medium | 🔧 Reliability |
| 20    | Audit Log Endpoints    | 🟠 Medium | Medium | 📋 Compliance  |
| 21    | Advanced Analytics     | 🟡 Medium | High   | 📊 Business    |
| 22    | Report Export (CSV)    | 🟡 Medium | Low    | 📊 Business    |
| 23    | Redis Caching          | 🟢 Low    | Medium | ⚡ Performance |
| 24    | Integration Sync       | 🟢 Low    | High   | 🔌 Integration |
| 25    | WebSocket              | 🟢 Low    | High   | 📱 UX          |
| 26    | E2E Testing            | 🔵 Low    | High   | 🧪 Quality     |
| 27    | Monitoring             | 🔵 Low    | Medium | 🔍 Ops         |
| 28    | Documentation          | 🔵 Low    | Low    | 📚 DX          |

---

## ✅ Already Completed (from REVISION.md Review)

Berikut item dari `REVISION.md` (feedback stakeholder Januari 2026) yang **sudah di-implement**:

| Item                                               | Status                         |
| -------------------------------------------------- | ------------------------------ |
| Media `title` & `description` fields               | ✅ Done (schema + DTO)         |
| `actionUrl` / `deepLink` field                     | ✅ Done (Media + CampaignItem) |
| `timezone` field di Property                       | ✅ Done                        |
| `region` field di Property                         | ✅ Done                        |
| Config endpoint kirim timezone ke Player           | ✅ Done (`getConfig`)          |
| `targetSlot` & `durationPackage` di Campaign       | ✅ Done                        |
| Rate Card paket harga (daily/weekly/monthly)       | ✅ Done                        |
| Auto-calculate cost dari RateCard × active screens | ✅ Done                        |
| Player slot-based playlist                         | ✅ Done (`getPlaylist`)        |
