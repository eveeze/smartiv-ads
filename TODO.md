# 📝 TODO List - SmartIV Ads Management (NestJS Enterprise)

**Development Philosophy:** Test-Driven & Document-First.
**Tech Stack:** NestJS, Prisma v6, BullMQ, MinIO, pnpm.

---

## 🏗️ Phase 1: Foundation & Infrastructure (Status: COMPLETED ✅)

_Fokus: Setup lingkungan kerja yang mendukung testing & dokumentasi sejak hari pertama._

- [x] **Project Setup**
  - [x] Init project & Docker Compose (App, Postgres, Redis, MinIO).
  - [x] Downgrade Prisma ke v6 (Stable) & Fix Docker Permission.
- [x] **Documentation Engine**
  - [x] **Setup API Docs:** Migrasi ke **Scalar UI** (`@scalar/nestjs-api-reference`) untuk tampilan modern & _client generation_.
- [x] **Global Utilities**
  - [x] **Config:** Setup `@nestjs/config` dengan validasi `Joi`.
  - [x] **Interceptors:** `TransformInterceptor` (Standar Response).
  - [x] **Filters:** `AllExceptionsFilter` (Handling Error).

---

## 🔐 Phase 2: Authentication Module (Status: COMPLETED ✅)

_Definition of Done: User bisa Register/Login, API terdokumentasi di Scalar, dan Unit Test Service hijau._

- [x] **Step 0: Preparation**
  - [x] Install Dependencies: `pnpm add @nestjs/passport passport passport-jwt @nestjs/jwt bcryptjs`.
- [x] **Step 1: Interface (DTO & Docs)**
  - [x] Buat `RegisterDto` & `LoginDto`.
  - [x] **Doc:** Tambahkan `@ApiProperty()` di DTO (Scalar akan membacanya otomatis).
- [x] **Step 2: Business Logic (TDD Approach)**
  - [x] **Test:** Buat `auth.service.spec.ts` (Mock Prisma, test logic hashing password).
  - [x] Implementasi `AuthService` (`register`, `login`, `transaction`).
- [x] **Step 3: Security Strategy**
  - [x] Implementasi `JwtStrategy` & `JwtAuthGuard`.
  - [x] Decorator `@CurrentUser()` & `@Roles()`.
  - [x] Implementasi `RolesGuard` (RBAC).
- [x] **Step 4: API & Verification**
  - [x] Implementasi `AuthController`.
  - [x] **Endpoint:** `POST /auth/register`, `POST /auth/login`.
  - [x] **E2E Test:** Buat `test/auth.e2e-spec.ts`.

---

## 🏢 Phase 3: Inventory Module (Status: COMPLETED ✅)

_Definition of Done: Admin bisa Full CRUD Property/Screen dengan Pagination, Filter, dan Validasi Ketat._

- [x] **Step 1: Interface & Schema**
  - [x] Update Prisma Schema (AdSlot, Sync Fields).
  - [x] DTO: `CreatePropertyDto`, `CreateScreenDto`, `PageOptionsDto`.
- [x] **Step 2: Logic Implementation (Full CRUD)**
  - [x] **Service:** Implementasi `findAll` (Pagination), `update`, `remove`.
  - [x] **Controller:** Endpoint CRUD.
- [x] **Step 3: CMS Endpoints Verification**
  - [x] `GET /inventory/properties` (List Hotel).
  - [x] `GET /inventory/screens` (List Layar).
  - [x] `POST`, `PATCH`, `DELETE` untuk manajemen data.
- [x] **Step 4: Testing**
  - [x] **E2E Test:** Test flow lengkap CRUD (`test/inventory.e2e-spec.ts`).

---

## 🎥 Phase 4: Media Pipeline (Hard Part) (Status: COMPLETED ✅)

_Definition of Done: Upload file aman -> Masuk Queue -> Transcoding Sukses -> Update Status._

- [x] **Step 1: Infrastructure**
  - [x] Setup `BullModule` (Redis) & `StorageModule` (MinIO/S3).
  - [x] **Test:** Unit test `StorageService`.
- [x] **Step 2: Upload Logic**
  - [x] DTO: `UploadMediaDto` (Validation: MimeType).
  - [x] **Security:** `FileSignatureValidatorPipe` (Magic Bytes Check).
  - [x] Controller: Handle upload raw file.
- [x] **Step 3: Transcoding Worker**
  - [x] Processor: `TranscodeProcessor` (FFmpeg Video -> HLS).
  - [x] **Integration Test:** Job masuk Redis & diproses.
- [x] **Step 4: Verification**
  - [x] **E2E Test:** `test/media.e2e-spec.ts`.

---

## 🛡️ Phase 4.5: Media Moderation (Status: COMPLETED ✅)

_Definition of Done: SuperAdmin bisa Approve/Reject konten sebelum digunakan di Campaign._

- [x] **Step 1: Schema Update**
  - [x] Update `Media` Model: Enum `ApprovalStatus`, field `rejectionReason`.
- [x] **Step 2: Admin Logic (Review)**
  - [x] **Endpoint Admin:** `GET /media/pending` (List antrian moderasi).
  - [x] **Endpoint Admin:** `PATCH /media/:id/review` (Action Approve/Reject).
- [x] **Step 3: Testing**
  - [x] **E2E Test:** Update `test/media.e2e-spec.ts` (Flow Upload -> Pending -> Review).

---

## 🛠️ Phase 4.6: Frontend Enablers (Status: COMPLETED ✅)

_Definition of Done: Endpoint pelengkap untuk kebutuhan UI/UX (Dropdowns & Details) tersedia._

- [x] **Step 1: Inventory Dropdowns (Lightweight)**
  - [x] **Endpoint:** `GET /inventory/properties/list` (Return: `{id, name}` only, no pagination).
  - [x] **Endpoint:** `GET /inventory/screens/list` (Filter by `propertyId`, Return: `{id, name}` only).
- [x] **Step 2: Media Detail & Preview**
  - [x] **Endpoint:** `GET /media/:id` (Full detail including HLS URL & Uploader Info).
- [x] **Step 3: Basic User Management (Admin)**
  - [x] **Endpoint:** `GET /users` (List all advertisers).
  - [x] **Endpoint:** `GET /users/:id` (User detail & stats).

---

## 💰 Phase 5: Finance & Rate Card (Status: COMPLETED ✅)

_Definition of Done: Manajemen saldo wallet, Topup, Withdrawal, & Engine Kalkulasi Harga._

- [x] **Step 1: Rate Card Schema & Logic**
  - [x] Schema: `RateCard` (Base Price per Property Class / Override per Screen).
  - [x] **Service:** `calculateCampaignCost(screenIds, startDate, endDate)`.
  - [x] **Endpoint Helper:** `POST /finance/calculate-cost` (Untuk frontend menampilkan estimasi harga).
- [x] **Step 2: Wallet Management**
  - [x] **Service:** `topupBalance`, `freezeBalance`, `deductBalance`.
  - [x] **Endpoint User:** `GET /finance/wallet` (Cek saldo & history transaksi).
  - [x] **Endpoint User:** `POST /finance/topup` (Simulasi payment gateway Midtrans).
  - [x] **Endpoint User:** `POST /finance/withdrawal` (Request pencairan dana).
- [x] **Step 3: Admin Finance Dashboard**
  - [x] **Endpoint Admin:** `GET /finance/admin/transactions` (Audit seluruh transaksi user).
  - [x] **Endpoint Admin:** `GET /finance/admin/withdrawals` (List request withdrawal).
  - [x] **Endpoint Admin:** `PATCH /finance/admin/withdrawals/:id/review` (Approve/Reject).

---

## 📢 Phase 5.5: Campaign Workflow & Approval (Status: COMPLETED ✅)

_Definition of Done: Flow lengkap Create (Targeting) -> Validate (Conflict/Balance) -> Freeze -> Review -> Active._

- [x] **Step 1: Campaign Core Logic (Targeting & Availabilty)**
  - [x] **DTO:** `CreateCampaignDto` (Input: `name`, `startDate`, `endDate`, `mediaId`, `targetFilter` atau `screenIds`).
  - [x] **Service:** `checkAvailability` (Basic check: Screen Exist).
  - [x] **Service:** `resolveTargeting` (Implicit via Screen Selection).
- [x] **Step 2: Campaign Creation & Financial Lock**
  - [x] **Constraint:** Validasi Media `status === APPROVED` & Saldo `available` >= `totalCost`.
  - [x] **Service:** `createCampaign` (Transaction: Simpan DB -> Update `frozenBalance` -> Buat Audit Log).
  - [x] **Endpoint User:** `POST /campaigns` (Draft/Submit Campaign).
  - [x] **Endpoint User:** `GET /campaigns` (List campaign sendiri, filter by status).
- [x] **Step 3: Admin Campaign Moderation**
  - [x] **Endpoint Admin:** `GET /campaigns/pending` (Queue campaign masuk, sort by date).
  - [x] **Endpoint Admin:** `GET /campaigns/:id/detail` (Lihat detail: Media, Total Harga, Screen List).
  - [x] **Endpoint Admin:** `PATCH /campaigns/:id/review` (Approve/Reject).
    - [x] _Logic Approve:_ Status `ACTIVE`, `frozenBalance` -> Potong Saldo (Create Transaction `SPEND`), Generate Invoice.
    - [x] _Logic Reject:_ Status `REJECTED`, `frozenBalance` -> Kembalikan ke Saldo (Release Hold).
- [x] **Step 4: Verification**
  - [x] **E2E Test:** `test/campaign-flow.e2e-spec.ts` (Skenario: Saldo kurang, Conflict jadwal, Approval Admin).

---

## 📺 Phase 6: Player API (Integration Point) (Status: NEXT UP 🚀)

_Definition of Done: TV/Player bisa komunikasi dengan server, tarik jadwal secara aman, dan lapor status._

- [ ] **Step 1: Player Authentication & Config**
  - [ ] **Middleware:** `PlayerAuthMiddleware` (Validasi Header `X-Device-ID` atau Mac Address).
  - [ ] **Endpoint:** `GET /player/config` (Return: Interval Sync, Orientation, Default Media).
- [ ] **Step 2: Playlist Generation (The Brain)**
  - [ ] **Service:** `generatePlaylist(screenId)`
    - [ ] Query Campaign yang `ACTIVE` dan `in_date_range`.
    - [ ] **Security:** Generate **Presigned URL** / **Signed URL** untuk file HLS (agar tidak bisa di-hotlink/dicuri).
  - [ ] **Endpoint:** `GET /player/playlist` (Return JSON: Sequence iklan, URL HLS Aman, Duration).
- [ ] **Step 3: Monitoring (Heartbeat)**
  - [ ] **Endpoint:** `POST /player/heartbeat` (TV lapor status "Online").
  - [ ] **Service:** Update field `lastPing` dan `status` di tabel `Screen`.

---

## 📊 Phase 7: Reporting & Analytics Dashboard

_Definition of Done: Pengolahan data telemetri menjadi laporan yang bisa dibaca Advertiser & Admin._

- [ ] **Step 1: Telemetry Ingest (High Throughput)**
  - [ ] **Schema:** `ImpressionLog` (screenId, campaignId, mediaId, duration, timestamp).
  - [ ] **Endpoint:** `POST /telemetry/impression` (Menerima batch logs dari TV).
  - [ ] **Queue:** Masukkan data ke Redis Queue (`telemetry-queue`) agar API tidak blocking.
  - [ ] **Worker:** `TelemetryProcessor` untuk simpan bulk insert ke DB.
- [ ] **Step 2: Advertiser Dashboard**
  - [ ] **Endpoint:** `GET /reports/campaign/:id/summary` (Total Impression, Cost, CTR).
  - [ ] **Endpoint:** `GET /reports/export` (Download CSV/PDF Laporan).
- [ ] **Step 3: Super Admin Dashboard**
  - [ ] **Endpoint:** `GET /dashboard/summary` (Revenue, Active Screens, Occupancy Rate).
  - [ ] **Endpoint:** `GET /dashboard/screens/status` (List layar Online vs Offline berdasarkan Heartbeat).

---

## 👥 Phase 8: User Management & Expansion (CMS Extras)

_Definition of Done: Fitur tambahan untuk manajemen aktor lain sesuai spesifikasi._

- [ ] **Step 1: User Administration**
  - [ ] **Endpoint Admin:** `GET /users` (Search & Filter).
  - [ ] **Endpoint Admin:** `PATCH /users/:id/status` (Block/Unblock User).
- [ ] **Step 2: Property Operator Role (Multi-tenant Support)**
  - [ ] **Role:** Implementasi Role `PROPERTY_OPERATOR` (sebelumnya HOTEL_ADMIN).
  - [ ] **Permissions:** View Schedule Properti Sendiri, View Screen Status.
  - [ ] **Endpoint:** `GET /property/screens` (Khusus Operator melihat status layar di propertinya sendiri).
