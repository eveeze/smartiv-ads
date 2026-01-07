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

## 🛡️ Phase 5.6: Operational & Safety (Status: COMPLETED ✅)

_Definition of Done: Fitur keamanan untuk User agar bisa membatalkan/menghapus resource._

- [x] **Step 1: Cancel Campaign**
  - [x] **Endpoint User:** `PATCH /campaigns/:id/cancel`.
  - [x] **Logic & Conditions:**
    - **Cek Kepemilikan:** User hanya bisa cancel campaign miliknya sendiri.
    - **Kondisi 1 (Status = PENDING_REVIEW):**
      - Sistem **WAJIB** mengembalikan saldo (`frozenBalance` dikembalikan ke `balance`).
      - Buat `AuditLog` tipe `REFUND`.
      - Set status menjadi `CANCELLED`.
    - **Kondisi 2 (Status = ACTIVE):**
      - Set status menjadi `CANCELLED` (agar iklan berhenti tayang di TV).
      - **Tidak ada refund otomatis** (sisa uang dianggap hangus/sudah terpakai).
    - **Kondisi 3 (Status Lain):** Jika status `REJECTED`, `DRAFT`, atau `COMPLETED`, tolak request (Throw `BadRequest`).

- [x] **Step 2: Delete Media**
  - [x] **Endpoint User:** `DELETE /media/:id`.
  - [x] **Logic & Conditions:**
    - **Cek Kepemilikan:** User hanya bisa hapus file miliknya.
    - **Dependency Check (Krusial):** Cek apakah media ini sedang digunakan di tabel `CampaignItem`.
      - Jika Campaign terkait statusnya `ACTIVE` atau `PENDING_REVIEW` -> **TOLAK** (`BadRequest: Media is currently in use`).
      - Jika Campaign terkait statusnya `DRAFT`, `CANCELLED`, `REJECTED`, atau `COMPLETED` -> **IZINKAN**.
    - **Action:** Hapus file fisik di MinIO/S3 **DAN** hapus record di Database.

---

## 🏷️ Phase 5.7: Rate Card Management (Status: COMPLETED ✅)

_Definition of Done: Admin bisa mengatur harga dinamis tanpa akses database manual._

- [x] **Step 1: Interface & DTO**
  - [x] **DTO:** `CreateRateCardDto` (Input: `classification`, `pricePerDay`, `propertyId?`, `screenId?`).
  - [x] **DTO:** `UpdateRateCardDto` (Input: `pricePerDay`).
  - [x] **Validation:** Pastikan `pricePerDay > 0`, conditional validation untuk `propertyId` vs `classification` via `@ValidateIf`.

- [x] **Step 2: Business Logic (CRUD)**
  - [x] **Service:** `create` (dengan validasi duplikat konfigurasi).
  - [x] **Service:** `findAll` (List semua konfigurasi harga aktif).
  - [x] **Service:** `update` (Ubah harga & status `isActive` dengan pengecekan konflik).
  - [x] **Service:** `remove` (Delete rate card permanently - Hard Delete).
  - [x] **Logic & Conditions:**
    - **Uniqueness Check:** Tidak boleh ada 2 Rate Card **AKTIF** untuk konfigurasi yang sama. Rate card non-aktif (history) boleh duplikat.
    - **Hierarchy Priority:** Logika perhitungan tetap mengutamakan _Screen Override_ > _Property Override_ > _Global Class Price_.

- [x] **Step 3: API Endpoints (Admin Only)**
  - [x] **Endpoint Admin:** `GET /inventory/rate-cards` (List harga).
  - [x] **Endpoint Admin:** `POST /inventory/rate-cards` (Create harga baru).
  - [x] **Endpoint Admin:** `PATCH /inventory/rate-cards/:id` (Update harga).
  - [x] **Endpoint Admin:** `DELETE /inventory/rate-cards/:id` (Delete secara permanen).
  - [x] **Conditions:**
    - **Role Check:** Hanya `SUPER_ADMIN` yang boleh akses.

- [x] **Step 4: Testing**
  - [x] **E2E Test:** `test/rate-card.e2e-spec.ts` (Skenario: Admin CRUD Rate Card, validasi unik, handling BigInt serializer).

---

## 📝 Phase 5.8: Quality of Life Improvements (Status: COMPLETED ✅)

_Definition of Done: Fitur untuk meningkatkan kenyamanan pengguna (Draft & Profile)._

- [x] **Step 1: Campaign Draft Flow**
  - [x] **Update Logic Create:** Tambahkan flag `saveAsDraft` di `CreateCampaignDto`. Jika `true`, simpan sebagai `DRAFT` tanpa freeze balance.
  - [x] **Endpoint Submit:** `PATCH /campaigns/:id/submit` (Transition `DRAFT` -> `PENDING_REVIEW` & Freeze Balance).
- [x] **Step 2: Edit & Delete Draft Campaign**
  - [x] **Endpoint:** `PATCH /campaigns/:id` & `DELETE /campaigns/:id`.
  - [x] **Logic & Conditions:**
    - **Status Check (Strict):** Hanya boleh dilakukan jika status campaign === `DRAFT`.
    - Jika delete `DRAFT`, tidak perlu ada pengembalian dana (karena draft belum memotong saldo).

- [x] **Step 3: User Self-Service (Update Profile)**
  - [x] **Endpoint:** `PATCH /users/profile`.
  - [x] **Logic & Conditions:**
    - Input: `name`, `phone`.
    - **Restricted Fields:** User **TIDAK BOLEH** mengubah `email` (identitas unik) atau `role` (keamanan) lewat endpoint ini.
    - **Validation:** Pastikan format nomor HP valid (ID Locale).

---

## 📺 Phase 6: Player API (Integration Point) (Status: COMPLETED ✅)

_Definition of Done: TV/Player bisa komunikasi dengan server, tarik jadwal secara aman, dan lapor status._

- [x] **Step 1: Player Authentication & Config**
  - [x] **Middleware:** `PlayerAuthMiddleware` (via Guard).
    - **Logic:** Validasi Header `X-Device-ID` (Mac Address/Unique ID) dengan data `code` di tabel `Screen`.
  - [x] **Endpoint:** `GET /player/config` (Return: Interval Sync, Orientation, Default Media).

- [x] **Step 2: Playlist Generation (The Brain)**
  - [x] **Service:** `generatePlaylist(screenId)`.
  - [x] **Logic & Conditions:**
    - Cari Campaign yang statusnya **HANYA** `ACTIVE`.
    - Cek tanggal: `startDate` <= TODAY <= `endDate`.
    - Cek targeting: Apakah `Screen` ini termasuk dalam list `campaign.screens`? (Handle logic Buyout vs Selective secara otomatis via relasi Prisma).
    - **Security:** Generate URL file yang aman (Presigned URL) jika private, atau direct URL jika public.

- [x] **Step 3: Monitoring (Heartbeat)**
  - [x] **Endpoint:** `POST /player/heartbeat` (TV lapor status "Online").
  - [x] **Logic:** Update field `lastPing` di tabel `Screen` dengan waktu sekarang. Jika `lastPing` > 5 menit lalu, Admin dashboard menganggap layar "Offline".

---

## 📊 Phase 7: Reporting & Analytics Dashboard (Status: COMPLETED ✅)

_Definition of Done: Pengolahan data telemetri menjadi laporan yang bisa dibaca Advertiser & Admin._

- [x] **Step 1: Telemetry Ingest (High Throughput)**
  - [x] **Endpoint:** `POST /telemetry/impression`.
  - [x] **Logic:** Terima array logs dari TV. Validasi `screenId` dan `campaignId`. Push ke Redis Queue (`telemetry-queue`). Jangan tulis langsung ke DB SQL agar API cepat.

- [x] **Step 2: Advertiser Dashboard**
  - [x] **Endpoint:** `GET /campaigns/summary`.
  - [x] **Logic:**
    - `activeCampaigns`: Count where status = ACTIVE.
    - `pendingCampaigns`: Count where status = PENDING.
    - `totalSpent`: Sum `totalCost` from campaigns (or transactions).
    - `remainingBalance`: Ambil dari tabel `Wallet`.

- [x] **Step 3: Super Admin Dashboard**
  - [x] **Endpoint:** `GET /dashboard/summary`.
  - [x] **Logic:** Aggregation seluruh revenue, total layar aktif vs total layar mati.

---

## 👥 Phase 8: User Management & Expansion (CMS Extras) (Status: NEXT UP - Prioritas Utama)

_Definition of Done: Fitur tambahan untuk manajemen aktor lain sesuai spesifikasi._

- [ ] **Step 1: User Administration**
  - [ ] **Endpoint Admin:** `GET /users` (Search & Filter).
  - [ ] **Endpoint Admin:** `PATCH /users/:id/status` (Block/Unblock User).
- [ ] **Step 2: Property Operator Role (Multi-tenant Support)**
  - [ ] **Role:** Implementasi Role `PROPERTY_OPERATOR` (sebelumnya HOTEL_ADMIN).
  - [ ] **Permissions:** View Schedule Properti Sendiri, View Screen Status.
  - [ ] **Endpoint:** `GET /property/screens` (Khusus Operator melihat status layar di propertinya sendiri).

---

## 🔐 Phase 9: Account Security (Status: PENDING - Low Priority)

_Definition of Done: User bisa mengamankan akun dan melakukan pemulihan (Optional/Akhir)._

- [ ] **Step 1: Change Password**
  - [ ] **Endpoint:** `PATCH /auth/change-password`.
  - [ ] **Input:** `oldPassword`, `newPassword`.
  - [ ] **Logic & Conditions:**
    - Verifikasi `oldPassword` dengan hash di database. Jika salah -> **TOLAK**.
    - Hash `newPassword` sebelum disimpan.
    - Logout semua sesi lain (opsional, best practice).

- [ ] **Step 2: Forgot Password Flow**
  - [ ] **Endpoint:** `POST /auth/forgot-password` (Input: Email).
    - **Logic:** Generate token acak, simpan di DB dengan expiry time (misal 15 menit), kirim email.
  - [ ] **Endpoint:** `POST /auth/reset-password` (Input: Token, New Password).
    - **Logic:** Cek apakah token valid dan belum expired. Jika ya, update password dan hapus token.
