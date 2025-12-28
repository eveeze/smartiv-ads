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
  - [x] **Doc:** Tambahkan `@ApiOperation`, `@ApiResponse` di Controller.
  - [x] **E2E Test:** Buat `test/auth.e2e-spec.ts` & Setup Test Environment.

---

## 🏢 Phase 3: Inventory Module (Status: COMPLETED ✅)

_Definition of Done: Admin bisa Full CRUD Property/Screen dengan Pagination, Filter, dan Validasi Ketat._

- [x] **Step 1: Interface & Schema**
  - [x] Update Prisma Schema (AdSlot, Sync Fields).
  - [x] DTO: `CreatePropertyDto`, `CreateScreenDto`.
- [x] **Step 2: Advanced Features (DTO Update)**
  - [x] **DTO:** Buat `UpdatePropertyDto` & `UpdateScreenDto` (`PartialType`).
  - [x] **DTO:** Buat `PageOptionsDto` (untuk Pagination & Filter).
- [x] **Step 3: Logic Implementation (Full CRUD)**
  - [x] **Service:** Implementasi `findAll` (dengan Pagination & Search), `update`, `remove`.
  - [x] **Controller:** Endpoint `PATCH` dan `DELETE`.
  - [x] **Logic:** Soft Delete (jika perlu) atau validasi sebelum delete (Cek relasi).
- [x] **Step 4: Testing & Verification**
  - [x] **Unit Test:** Update test untuk cover Update, Delete, dan Pagination.
  - [x] **E2E Test:** Test flow lengkap CRUD.

---

## 🎥 Phase 4: Media Pipeline (Hard Part) (Status: COMPLETED ✅)

_Definition of Done: Upload file aman -> Masuk Queue -> Transcoding Sukses -> Update Status._

- [x] **Step 1: Infrastructure**
  - [x] Setup `BullModule` (Redis) di `app.module.ts`.
  - [x] Setup `StorageModule` (MinIO/S3) untuk handle upload.
  - [x] **Test:** Unit test `StorageService` (Mock S3 Client).
- [x] **Step 2: Upload Logic**
  - [x] DTO: `UploadMediaDto` (Validation: MimeType Image/Video only).
  - [x] **Security:** Implementasi `FileSignatureValidatorPipe` (Magic Bytes Check).
  - [x] Controller & Service: Handle upload raw file & save metadata to DB.
- [x] **Step 3: Transcoding Worker (Video Processing)**
  - [x] Processor: `TranscodeProcessor` (Menggunakan FFmpeg/Fluent-FFmpeg).
  - [x] Logic: Convert Video -> HLS (.m3u8) untuk streaming ringan di TV.
  - [x] **Integration Test:** Pastikan Job masuk ke Redis dan diproses.
- [x] **Step 4: E2E Verification**
  - [x] **E2E Test:** `test/media.e2e-spec.ts` (Upload Image, Upload Video, Security Check).

---

## 🛡️ Phase 4.5: Media Moderation (Status: NEXT UP 🚀)

_Definition of Done: SuperAdmin bisa Approve/Reject konten sebelum digunakan di Campaign._

- [ ] **Step 1: Schema Update**
  - [ ] Update `Media` Model: Tambah Enum `ApprovalStatus { PENDING, APPROVED, REJECTED }`.
  - [ ] Generate Migration Prisma.
- [ ] **Step 2: Admin Logic (Review)**
  - [ ] Endpoint `GET /media/pending`: Admin melihat antrian moderasi.
  - [ ] Endpoint `PATCH /media/:id/review`: Admin Approve/Reject (wajib alasan jika reject).
  - [ ] **Logic:** Filter `findAll` agar Advertiser hanya lihat media miliknya.
- [ ] **Step 3: Testing**
  - [ ] **E2E Test:** Update `test/media.e2e-spec.ts` untuk flow approval.

---

## 💰 Phase 5: Finance & Rate Card

_Definition of Done: Kalkulasi harga dinamis dan manajemen saldo wallet._

- [ ] **Step 1: Rate Card Logic**
  - [ ] **Test:** `rate-card.service.spec.ts`.
  - [ ] Service: Implementasi `calculateCost` (Base Rate + Override).
- [ ] **Step 2: Wallet Service**
  - [ ] **Test:** `wallet.service.spec.ts`.
  - [ ] Service: `topupBalance` (Simulasi), `freezeBalance` (Hold dana), `deductBalance`.

---

## 📢 Phase 5.5: Campaign Workflow & Approval

_Definition of Done: Flow lengkap Submit -> Review -> Active._

- [ ] **Step 1: Campaign Creation**
  - [ ] DTO: `CreateCampaignDto` (Validasi tanggal & slot).
  - [ ] **Constraint:** Hanya boleh pilih Media dengan status `APPROVED`.
- [ ] **Step 2: Submission Flow**
  - [ ] Advertiser Submit -> Status `PENDING_REVIEW` -> Saldo di-hold.
- [ ] **Step 3: Admin Review**
  - [ ] Admin Approve -> Status `ACTIVE` -> Saldo dipotong permanen.
  - [ ] Admin Reject -> Status `REJECTED` -> Saldo dikembalikan (Unfreeze).
- [ ] **Step 4: End-to-End Flow**
  - [ ] **E2E Test:** `test/campaign-flow.e2e-spec.ts`.

---

## 📺 Phase 6: Player API (Integration Point)

_Definition of Done: TV bisa request config dan dapat playlist iklan yang sesuai._

- [ ] **Step 1: Logic & Caching**
  - [ ] Setup `@nestjs/cache-manager` (Redis Cache) untuk performa tinggi.
  - [ ] Service: `getPlaylist(screenCode)` -> Filter Campaign `ACTIVE` & `APPROVED`.
- [ ] **Step 2: API & Load Test**
  - [ ] Controller: `/player/config` (Query param: `code`).
  - [ ] **Doc:** Dokumentasikan struktur JSON Playlist (Penting untuk Tim Mobile).

---

## 📊 Phase 7: Reporting

_Definition of Done: Laporan impresi dan performa campaign._

- [ ] **Step 1: Aggregation**
  - [ ] Endpoint `POST /impression`: Terima telemetri dari TV.
  - [ ] Service: `getPerformanceReport()` (Hitung Impression).
- [ ] **Step 2: Export API**
  - [ ] Controller: Download CSV Laporan Campaign.
