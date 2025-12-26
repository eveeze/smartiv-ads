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

## 🔐 Phase 2: Authentication Module (Status: ON GOING 🚀)

_Definition of Done: User bisa Register/Login, API terdokumentasi di Scalar, dan Unit Test Service hijau._

- [ ] **Step 0: Preparation**
  - [ ] Install Dependencies: `pnpm add @nestjs/passport passport passport-jwt @nestjs/jwt bcryptjs` dan `pnpm add -D @types/passport-jwt @types/bcryptjs`.
- [ ] **Step 1: Interface (DTO & Docs)**
  - [ ] Buat `RegisterDto` & `LoginDto`.
  - [ ] **Doc:** Tambahkan `@ApiProperty()` di DTO (Scalar akan membacanya otomatis).
- [ ] **Step 2: Business Logic (TDD Approach)**
  - [ ] **Test:** Buat `auth.service.spec.ts` (Mock Prisma, test logic hashing password).
  - [ ] Implementasi `AuthService` (`register`, `validateUser`, `login`).
- [ ] **Step 3: Security Strategy**
  - [ ] Implementasi `JwtStrategy` & `JwtAuthGuard`.
  - [ ] Decorator `@CurrentUser()` & `@Roles()`.
- [ ] **Step 4: API & Verification**
  - [ ] Implementasi `AuthController`.
  - [ ] **Doc:** Tambahkan `@ApiOperation`, `@ApiResponse` di Controller.
  - [ ] **Verification:** Cek tampilan di `http://localhost:3000/reference`.
  - [ ] **E2E Test:** Buat `test/auth.e2e-spec.ts`.

---

## 🏢 Phase 3: Property & Inventory Module

_Definition of Done: Admin bisa CRUD Property/Screen._

- [ ] **Step 1: Interface**
  - [ ] DTO: `CreatePropertyDto`, `CreateScreenDto`.
  - [ ] **Doc:** Lengkapi Schema Property & Screen agar muncul di Scalar Sidebar.
- [ ] **Step 2: Logic & Testing**
  - [ ] **Test:** `inventory.service.spec.ts`.
  - [ ] Service: CRUD Property & Screen.
- [ ] **Step 3: API Implementation**
  - [ ] Controller: Endpoint Admin (Guard: `@Roles(SUPER_ADMIN)`).
  - [ ] **Doc:** Dokumentasikan Endpoint Admin.

---

## 🎥 Phase 4: Media Pipeline (Hard Part)

_Definition of Done: Upload file -> Masuk Queue -> Transcoding Sukses._

- [ ] **Step 1: Infrastructure**
  - [ ] Setup `BullModule` (Redis) & `StorageModule` (MinIO/S3).
  - [ ] **Test:** Unit test `StorageService`.
- [ ] **Step 2: Upload Logic**
  - [ ] DTO: `UploadMediaDto`.
  - [ ] **Doc:** Setup Scalar untuk File Upload (Multipart/Form-Data).
  - [ ] Controller & Service: Handle upload raw file.
- [ ] **Step 3: Transcoding Worker**
  - [ ] Processor: `TranscodeProcessor`.
  - [ ] **Integration Test:** Pastikan Job masuk ke Redis.

---

## 💰 Phase 5: Campaign & Finance

_Definition of Done: Saldo berkurang atomik saat campaign dibuat._

- [ ] **Step 1: Wallet Logic**
  - [ ] **Test:** `wallet.service.spec.ts`.
  - [ ] Service: `topupBalance`, `deductBalance`.
- [ ] **Step 2: Campaign Logic**
  - [ ] DTO: `CreateCampaignDto`.
  - [ ] **Test:** `campaign.service.spec.ts`.
  - [ ] Service: `submitCampaign`.
- [ ] **Step 3: End-to-End Flow**
  - [ ] **E2E Test:** `test/campaign-flow.e2e-spec.ts`.

---

## 📺 Phase 6: Player API

- [ ] **Step 1: Logic & Caching**
  - [ ] Setup `@nestjs/cache-manager`.
  - [ ] Service: `getPlaylist(macAddress)`.
- [ ] **Step 2: API & Load Test**
  - [ ] Controller: `/player/config/:mac`.
  - [ ] **Doc:** Dokumentasikan struktur JSON Playlist.

---

## 📊 Phase 7: Reporting

- [ ] **Step 1: Aggregation**
  - [ ] Service: `getPerformanceReport()`.
- [ ] **Step 2: Export API**
  - [ ] Controller: Download CSV.
