# 📝 TODO List - SmartIV Ads Management (NestJS Enterprise)

**Development Philosophy:** Test-Driven & Document-First.
**Tech Stack:** NestJS, Prisma v6, BullMQ, MinIO, pnpm.

---

## 🏗️ Phase 1: Foundation & Infrastructure (Status: ON GOING)

_Fokus: Setup lingkungan kerja yang mendukung testing & dokumentasi sejak hari pertama._

- [x] **Project Setup**
  - [x] Init project & Docker Compose (App, Postgres, Redis, MinIO).
  - [x] Downgrade Prisma ke v6 (Stable) & Fix Docker Permission.
- [ ] **Documentation Engine**
  - [ ] **Setup Swagger:** Install `@nestjs/swagger` dan konfigurasi di `main.ts` agar siap pakai.
- [ ] **Global Utilities**
  - [ ] **Config:** Setup `@nestjs/config` dengan validasi `Joi` (Test: Pastikan app gagal start kalau ENV kurang).
  - [ ] **Interceptors:** `TransformInterceptor` (Standar Response).
  - [ ] **Filters:** `AllExceptionsFilter` (Handling Error).

---

## 🔐 Phase 2: Authentication Module

_Definition of Done: User bisa Register/Login, API terdokumentasi, dan Unit Test Service hijau._

- [ ] **Step 1: Interface (DTO & Docs)**
  - [ ] Buat `RegisterDto` & `LoginDto`.
  - [ ] **Doc:** Tambahkan `@ApiProperty()` (Example & Description) di DTO.
- [ ] **Step 2: Business Logic (TDD Approach)**
  - [ ] **Test:** Buat `auth.service.spec.ts` (Mock Prisma, test logic hashing password).
  - [ ] Implementasi `AuthService` (`register`, `validateUser`, `login`).
- [ ] **Step 3: Security Strategy**
  - [ ] Implementasi `JwtStrategy` & `JwtAuthGuard`.
  - [ ] Decorator `@CurrentUser()` & `@Roles()`.
- [ ] **Step 4: API & Verification**
  - [ ] Implementasi `AuthController`.
  - [ ] **Doc:** Tambahkan `@ApiOperation`, `@ApiResponse` (200, 401, 403) di Controller.
  - [ ] **E2E Test:** Buat `test/auth.e2e-spec.ts` (Skenario: Register -> Login -> Dapat Token).

---

## 🏢 Phase 3: Property & Inventory Module

_Definition of Done: Admin bisa CRUD Property/Screen, Validasi Mac Address unik._

- [ ] **Step 1: Interface**
  - [ ] DTO: `CreatePropertyDto`, `CreateScreenDto` (Enum Validation).
  - [ ] **Doc:** Lengkapi Swagger Schema untuk Property & Screen.
- [ ] **Step 2: Logic & Testing**
  - [ ] **Test:** `inventory.service.spec.ts` (Test logic assignment `AdZone`).
  - [ ] Service: CRUD Property & Screen.
- [ ] **Step 3: API Implementation**
  - [ ] Controller: Endpoint Admin (Guard: `@Roles(SUPER_ADMIN)`).
  - [ ] **Doc:** Dokumentasikan Endpoint Admin di Swagger.

---

## 🎥 Phase 4: Media Pipeline (Hard Part)

_Definition of Done: Upload file -> Masuk Queue -> Transcoding Sukses -> Update DB._

- [ ] **Step 1: Infrastructure**
  - [ ] Setup `BullModule` (Redis) & `StorageModule` (MinIO/S3).
  - [ ] **Test:** Unit test `StorageService` (Mock AWS SDK).
- [ ] **Step 2: Upload Logic**
  - [ ] DTO: `UploadMediaDto` (Validasi MimeType).
  - [ ] **Doc:** Setup Swagger untuk File Upload (Multipart/Form-Data).
  - [ ] Controller & Service: Handle upload raw file.
- [ ] **Step 3: Transcoding Worker**
  - [ ] Processor: `TranscodeProcessor` (Logic FFmpeg).
  - [ ] **Integration Test:** Pastikan Job masuk ke Redis dan Worker bereaksi.

---

## 💰 Phase 5: Campaign & Finance

_Definition of Done: Saldo berkurang atomik saat campaign dibuat._

- [ ] **Step 1: Wallet Logic (Critical)**
  - [ ] **Test:** `wallet.service.spec.ts` (Wajib test Race Condition / Saldo Minus).
  - [ ] Service: `topupBalance`, `deductBalance` (Prisma Transaction).
- [ ] **Step 2: Campaign Logic**
  - [ ] DTO: `CreateCampaignDto`.
  - [ ] **Test:** `campaign.service.spec.ts` (Test logic hitung harga).
  - [ ] Service: `submitCampaign` (Integrasi Wallet & Inventory).
- [ ] **Step 3: End-to-End Flow**
  - [ ] **E2E Test:** `test/campaign-flow.e2e-spec.ts`
    - Flow: Register -> Topup -> Create Campaign -> Cek Saldo & Status.

---

## 📺 Phase 6: Player API

_Definition of Done: API cepat (<50ms) & Ter-cache._

- [ ] **Step 1: Logic & Caching**
  - [ ] Setup `@nestjs/cache-manager`.
  - [ ] Service: `getPlaylist(macAddress)`.
- [ ] **Step 2: API & Load Test**
  - [ ] Controller: `/player/config/:mac`.
  - [ ] **Doc:** Dokumentasikan struktur JSON Playlist response.
  - [ ] **Manual Test:** Cek response time saat cache miss vs cache hit.

---

## 📊 Phase 7: Reporting

_Definition of Done: Data akurat & bisa di-export._

- [ ] **Step 1: Aggregation**
  - [ ] **Test:** Test query SQL/Prisma aggregation (Sum/Count).
  - [ ] Service: `getPerformanceReport()`.
- [ ] **Step 2: Export API**
  - [ ] Controller: Download CSV.
  - [ ] **Doc:** Dokumentasikan format CSV.
