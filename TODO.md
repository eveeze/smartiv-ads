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

## 💰 Phase 5: Finance & Rate Card (Status: NEXT UP 🚀)

_Definition of Done: Manajemen saldo wallet & Kalkulasi harga dinamis._

- [ ] **Step 1: Rate Card Schema & Logic**
  - [ ] Schema: `RateCard` (Base Price per Property Class / Override per Screen).
  - [ ] **Service:** `calculateCampaignCost(screenIds, startDate, endDate)`.
  - [ ] **Endpoint Helper:** `POST /finance/calculate-cost` (Untuk frontend menampilkan estimasi harga sebelum submit).
- [ ] **Step 2: Wallet Management**
  - [ ] **Service:** `topupBalance`, `freezeBalance`, `deductBalance`.
  - [ ] **Endpoint User:** `GET /finance/wallet` (Cek saldo sendiri).
  - [ ] **Endpoint User:** `GET /finance/transactions` (History mutasi saldo).
  - [ ] **Endpoint User:** `POST /finance/topup` (Simulasi payment gateway).
- [ ] **Step 3: Admin Finance Dashboard**
  - [ ] **Endpoint Admin:** `GET /finance/admin/transactions` (Audit seluruh transaksi user).
  - [ ] **Endpoint Admin:** `GET /finance/admin/wallets` (Cek saldo user).

---

## 📢 Phase 5.5: Campaign Workflow & Approval

_Definition of Done: Flow lengkap Submit -> Review -> Active._

- [ ] **Step 1: Campaign Creation**
  - [ ] DTO: `CreateCampaignDto` (Validasi tanggal & slot).
  - [ ] **Constraint:** Validasi Media `status === APPROVED` & Saldo Cukup.
  - [ ] **Endpoint User:** `POST /campaigns` (Draft/Submit).
  - [ ] **Endpoint User:** `GET /campaigns` (List campaign sendiri & statusnya).
- [ ] **Step 2: Submission Flow**
  - [ ] Logic: Submit -> Status `PENDING_REVIEW` -> Trigger `freezeBalance`.
- [ ] **Step 3: Admin Campaign Review**
  - [ ] **Endpoint Admin:** `GET /campaigns/pending` (Queue campaign masuk).
  - [ ] **Endpoint Admin:** `GET /campaigns/:id/detail` (Lihat detail slot & media).
  - [ ] **Endpoint Admin:** `PATCH /campaigns/:id/review` (Approve -> Deduct Saldo / Reject -> Unfreeze).
- [ ] **Step 4: End-to-End Flow**
  - [ ] **E2E Test:** `test/campaign-flow.e2e-spec.ts`.

---

## 📺 Phase 6: Player API (Integration Point)

_Definition of Done: TV bisa request config dan dapat playlist iklan yang sesuai._

- [ ] **Step 1: Logic & Caching**
  - [ ] Setup `@nestjs/cache-manager` (Redis Cache).
  - [ ] Service: `getPlaylist(screenCode)` -> Filter Campaign `ACTIVE` & `APPROVED`.
- [ ] **Step 2: API & Load Test**
  - [ ] **Endpoint TV:** `GET /player/config?code=MAC_ADDRESS`.
  - [ ] **Response:** JSON Playlist Standard (HLS URL, Duration, Type).

---

## 📊 Phase 7: Reporting & Analytics Dashboard

_Definition of Done: Admin & Advertiser bisa melihat performa iklan._

- [ ] **Step 1: Telemetry Ingest**
  - [ ] **Endpoint Player:** `POST /telemetry/impression` (TV lapor iklan tayang).
  - [ ] **Worker:** Proses log impression secara async (agar endpoint cepat).
- [ ] **Step 2: Advertiser Dashboard Endpoints**
  - [ ] **Endpoint:** `GET /reports/campaign/:id/stats` (Total Impression, Cost).
  - [ ] **Endpoint:** `GET /reports/export/csv` (Download laporan).
- [ ] **Step 3: Super Admin Dashboard Endpoints**
  - [ ] **Endpoint:** `GET /dashboard/summary` (Total Revenue, Active Screens, Active Campaigns).
  - [ ] **Endpoint:** `GET /dashboard/occupancy` (Persentase slot terisi).

---

## 👥 Phase 8: User Management (CMS Extras)

_Definition of Done: Admin bisa mengelola user yang terdaftar._

- [ ] **Step 1: User Administration**
  - [ ] **Endpoint Admin:** `GET /users` (List semua advertiser, filter by name/email).
  - [ ] **Endpoint Admin:** `GET /users/:id` (Detail user & history campaign).
  - [ ] **Endpoint Admin:** `PATCH /users/:id/status` (Block/Unblock user).
