# 📝 TODO List - SmartIV Ads Management (NestJS Migration)

**Target Architecture:** Modular Monolith (Enterprise Standard)
**Tech Stack:** NestJS, Prisma, BullMQ (Redis), MinIO, PostgreSQL.

---

## 🏗️ Phase 1: Foundation & Infrastructure Setup

Membangun fondasi framework dan koneksi database.

- [ ] **Project Initialization**
  - [ ] Init project baru: `nest new smartiv-backend` (Package manager: Bun/Yarn).
  - [ ] Setup Docker Compose (App, Postgres, Redis, MinIO).
- [ ] **Database (Prisma)**
  - [ ] Copy file `schema.prisma` dari project lama.
  - [ ] Generate Prisma Client: `npx prisma generate`.
  - [ ] Buat **`PrismaModule`** (Global Module).
  - [ ] Implementasi `PrismaService` (sebagai connection provider).
- [ ] **Configuration**
  - [ ] Install `@nestjs/config`.
  - [ ] Setup validasi environment variables menggunakan `Joi` atau `Zod` (Validasi `DATABASE_URL`, `JWT_SECRET`, dll).
- [ ] **Global Interceptors & Filters**
  - [ ] Buat `TransformInterceptor`: Standarisasi response `{ success: true, data: ... }`.
  - [ ] Buat `AllExceptionsFilter`: Global Error Handling untuk menangkap `HttpException` & Prisma Error.

---

## 🔐 Phase 2: Authentication & Authorization (Auth Module)

Migrasi logika login dari manual ke `Passport` strategy.

- [ ] **Dependencies**: Install `@nestjs/passport`, `@nestjs/jwt`, `passport-jwt`, `bcrypt`.
- [ ] **Auth DTOs**
  - [ ] Buat `RegisterDto` & `LoginDto` menggunakan `class-validator` (Gantikan validasi `elysia.t`).
- [ ] **Auth Service**
  - [ ] Porting logic `register` (Hash password, Create User, Create Wallet).
  - [ ] Porting logic `login` (Validate User, Sign JWT).
- [ ] **Strategies & Guards**
  - [ ] Implementasi `JwtStrategy` (Extract token dari Bearer Header).
  - [ ] Implementasi `JwtAuthGuard`.
  - [ ] Implementasi `RolesGuard` (RBAC: Admin vs Advertiser).
  - [ ] Buat Decorator custom: `@CurrentUser()` dan `@Roles()`.

---

## 🏨 Phase 3: Inventory & Data Master (Inventory Module)

Manajemen Hotel, Screen, dan Harga.

- [ ] **Inventory Module**
  - [ ] `CreateHotelDto` & `CreateScreenDto` (Validasi Enum & Types).
  - [ ] `InventoryService`: Logic CRUD Hotel & Screen (Inject `PrismaService`).
  - [ ] `InventoryController`: Endpoint Admin dengan proteksi `@Roles(Role.ADMIN)`.
- [ ] **Pricing Logic**
  - [ ] `PricingService`: Logic `upsertRateCard` (Harga per bintang/hotel).
- [ ] **Internal Sync (S2S Integration)**
  - [ ] Buat `InternalKeyGuard`: Validasi `INTERNAL_SECRET` (Bypass JWT).
  - [ ] Endpoint `/internal/sync/screen` untuk webhook sinkronisasi alat.

---

## 🎥 Phase 4: Media Pipeline (HLS & Queue)

Bagian terberat: Upload, Antrian, dan Transcoding Video.

- [ ] **Infrastructure**
  - [ ] Install `@nestjs/bull` (Wrapper BullMQ) & `@nestjs/platform-express` (Multer).
  - [ ] Setup `BullModule` di `AppModule` (Koneksi ke Redis).
- [ ] **Storage Service**
  - [ ] Buat `StorageService`: Wrapper untuk upload file ke MinIO/S3.
- [ ] **Media Module**
  - [ ] `MediaController`: Endpoint Upload (Filter MimeType Video/Image).
  - [ ] `MediaService`: Simpan metadata ke DB -> Add Job to Queue (`video-transcoding`).
- [ ] **Transcode Worker (Consumer)**
  - [ ] Buat `TranscodeProcessor` (`@Processor`).
  - [ ] Logic `@Process`: Jalankan FFmpeg (Convert MP4 -> HLS .m3u8).
  - [ ] Update status `Media` di DB (READY/FAILED).
  - [ ] (Optional) Generate Signed URL logic.

---

## 💰 Phase 5: Campaign & Finance (Business Logic)

Inti bisnis: Booking slot iklan dan pembayaran.

- [ ] **Finance Module**
  - [ ] `WalletService`: Logic Atomic Transaction (Topup & Deduct Balance).
  - [ ] `DepositController`: Handle callback payment gateway.
- [ ] **Campaign Module**
  - [ ] `CreateCampaignDto` (Validasi tanggal & target screen).
  - [ ] `CampaignService`:
    - [ ] `calculateCost()`: Hitung estimasi biaya (Rate _ Days _ Screens).
    - [ ] `submitCampaign()`: Gunakan `prisma.$transaction` (Cek Slot -> Potong Saldo -> Create Campaign).
  - [ ] `CampaignController`: CRUD Campaign untuk Advertiser.

---

## 📺 Phase 6: Player API (High Performance)

API yang diakses ribuan TV secara bersamaan.

- [ ] **Caching**
  - [ ] Setup `@nestjs/cache-manager` (Redis Store).
- [ ] **Player Module**
  - [ ] `PlayerService`:
    - [ ] `getPlaylist(screenId)`: Query jadwal aktif.
    - [ ] Implementasi Cache: Simpan hasil playlist selama 5-10 menit.
  - [ ] `PlayerController`: Endpoint `/player/playlist` dan `/player/telemetry`.
  - [ ] Kompresi Gzip untuk response JSON besar.

---

## 📊 Phase 7: Reporting & Analytics

Visualisasi data performa iklan.

- [ ] **Reporting Module**
  - [ ] `ReportService`: Aggregation query (Count Impression, Total Spend).
  - [ ] `ReportController`: Endpoint download CSV/PDF.

---

## 🧪 Phase 8: Testing & Documentation (QA)

Standarisasi Enterprise.

- [ ] **Documentation**
  - [ ] Setup `@nestjs/swagger`.
  - [ ] Lengkapi Decorator `@ApiProperty` di semua DTO.
- [ ] **Testing**
  - [ ] Unit Test: `AuthService.spec.ts`, `CampaignService.spec.ts`.
  - [ ] E2E Test: Flow Register -> Topup -> Create Campaign.
