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

## 🏢 Phase 3: Property & Inventory Module (Status: COMPLETED ✅)

_Definition of Done: Admin bisa CRUD Property/Screen, setting Slot Iklan, dan Test Passed._

- [x] **Step 1: Interface & Schema**
  - [x] Update Schema: `AdSlot` (Synced with SmartIV Core), `MediaType`, `Property` Sync Fields.
  - [x] DTO: `CreatePropertyDto` (Strict Validation), `CreateScreenDto`.
- [x] **Step 2: Logic Implementation**
  - [x] Service: `createProperty` (Check Duplicates), `createScreen` (Check Duplicates & Relations).
  - [x] Controller: Endpoint Admin (`@Roles(SUPER_ADMIN)`).
- [x] **Step 3: Testing & Verification**
  - [x] **Unit Test:** `inventory.service.spec.ts` (Mocking Prisma).
  - [x] **Unit Test:** `inventory.controller.spec.ts` (Mocking Service).
  - [x] **E2E Test:** `test/inventory.e2e-spec.ts` (Full Integration Flow).
  - [x] **Doc:** Dokumentasi di Scalar UI untuk Inventory Endpoints.

---

## 🎥 Phase 4: Media Pipeline (Hard Part) (Status: NEXT UP 🚀)

_Definition of Done: Upload file -> Masuk Queue -> Transcoding Sukses -> Update Status._

- [ ] **Step 1: Infrastructure**
  - [ ] Setup `BullModule` (Redis) di `app.module.ts`.
  - [ ] Setup `StorageModule` (MinIO/S3) untuk handle upload.
  - [ ] **Test:** Unit test `StorageService` (Mock S3 Client).
- [ ] **Step 2: Upload Logic**
  - [ ] DTO: `UploadMediaDto` (Validation: MimeType Image/Video only).
  - [ ] **Doc:** Setup Scalar untuk File Upload (Multipart/Form-Data).
  - [ ] Controller & Service: Handle upload raw file & save metadata to DB.
- [ ] **Step 3: Transcoding Worker (Video Processing)**
  - [ ] Processor: `TranscodeProcessor` (Menggunakan FFmpeg/Fluent-FFmpeg).
  - [ ] Logic: Convert Video -> HLS (.m3u8) untuk streaming ringan di TV.
  - [ ] **Integration Test:** Pastikan Job masuk ke Redis dan diproses.

---

## 💰 Phase 5: Campaign & Finance

_Definition of Done: Saldo berkurang atomik saat campaign dibuat._

- [ ] **Step 1: Wallet Logic**
  - [ ] **Test:** `wallet.service.spec.ts`.
  - [ ] Service: `topupBalance` (Simulasi), `deductBalance` (Atomic Transaction).
- [ ] **Step 2: Campaign Logic**
  - [ ] DTO: `CreateCampaignDto` (Pilih Property, Slot, Date Range).
  - [ ] **Test:** `campaign.service.spec.ts` (Validasi Saldo & Ketersediaan Slot).
  - [ ] Service: `submitCampaign` (Create Campaign + Deduct Wallet dalam 1 transaksi).
- [ ] **Step 3: End-to-End Flow**
  - [ ] **E2E Test:** `test/campaign-flow.e2e-spec.ts`.

---

## 📺 Phase 6: Player API (Integration Point)

_Definition of Done: TV bisa request config dan dapat playlist iklan yang sesuai._

- [ ] **Step 1: Logic & Caching**
  - [ ] Setup `@nestjs/cache-manager` (Redis Cache) untuk performa tinggi.
  - [ ] Service: `getPlaylist(screenCode)` -> Filter Campaign aktif berdasarkan Property & Slot.
- [ ] **Step 2: API & Load Test**
  - [ ] Controller: `/player/config` (Query param: `code`).
  - [ ] **Doc:** Dokumentasikan struktur JSON Playlist (Penting untuk Tim Mobile).

---

## 📊 Phase 7: Reporting

- [ ] **Step 1: Aggregation**
  - [ ] Service: `getPerformanceReport()` (Hitung Impression).
- [ ] **Step 2: Export API**
  - [ ] Controller: Download CSV Laporan Campaign.
