# 📝 TODO List - SmartIV Ads Advanced Features (Phase 10+)

**Focus:** Enterprise Structure, Business Rules, & Monetization (Standalone Mode).
**Code Standards:** Strict TypeScript (No `any`), O(1)/O(log n) Algorithms, Async Processing via BullMQ.

---

## 🎯 Phase 10: Structural Upgrade (Placement & Zones) (Status: NEXT UP)

_Definition of Done: Sistem mengenali spesifikasi slot iklan secara teknis (Resolusi & Aspek Rasio), bukan sekadar Enum. Ini penting agar manual input inventory lebih valid._

- [ ] **Step 1: Schema Refinement**
  - [ ] **Create Model `AdPlacement`:**
    - Fields: `code` (unique), `name`, `width`, `height`, `aspectRatio` (e.g., "16:9", "4:1"), `allowedMediaTypes` (Array of Enum).
    - **Seed:** Populate default data (e.g., `FULLSCREEN_1080P`, `BANNER_FOOTER`, `SIDEBAR_MENU`).
  - [ ] **Migration:** Relasikan `CampaignItem` dengan `AdPlacement` (menggantikan atau melengkapi `AdSlot` enum).

- [ ] **Step 2: Strict Validation Logic**
  - [ ] **Update `UploadMediaDto`:** Tambahkan validasi metadata (gunakan `ffprobe` atau `sharp`) untuk memastikan dimensi file user sesuai dengan `Placement` yang ditargetkan.
  - [ ] **Service:** `validateMediaCompatibility(mediaId, placementId)`.
    - _Performance:_ Cache konfigurasi Placement di Redis agar validasi tidak hit DB berulang kali.

---

## 🛡️ Phase 11: Brand Safety & Category Blocking (Status: PENDING)

_Definition of Done: Hotel (Property Owner) bisa memblokir kategori iklan tertentu agar tidak tayang di properti mereka (misal: Blokir Alkohol atau Kompetitor)._

- [ ] **Step 1: Classification Schema**
  - [ ] **Update Schema:**
    - Tambah Model `IndustryCategory` (e.g., TRAVEL, F&B, AUTOMOTIVE, ALCOHOL).
    - Tambah field `categoryId` di `Campaign` dan `Media`.
    - Tambah Model `PropertyBlocklist` (Many-to-Many antara `Property` dan `IndustryCategory`).

- [ ] **Step 2: Business Logic (Blocking Rule)**
  - [ ] **Service:** Update `InventoryService.checkAvailability`.
    - _Logic:_ Saat mengecek ketersediaan slot, filter Campaign yang `categoryId`-nya ada di daftar blocklist Property tersebut.
    - _Performance:_ Gunakan Prisma `where: { NOT: { categoryId: { in: blockedIds } } }` (Database level filtering, hindari filtering di loop JS).

- [ ] **Step 3: Admin Configuration**
  - [ ] **Endpoint:** `POST /inventory/properties/:id/blocklist`.
  - [ ] **Validation:** Pastikan Category ID valid.

---

## 🤝 Phase 12: Publisher Revenue Share (Billing Expansion) (Status: PENDING)

_Definition of Done: Sistem menghitung bagi hasil untuk pemilik properti (Hotel Owner) berdasarkan impresi yang tercatat via Telemetry._

- [ ] **Step 1: Revenue Configuration**
  - [ ] **Update Schema:** Tambah field `revenueSharePercentage` (Float, e.g., 0.3 for 30%) di model `Property`.
  - [ ] **Create Model:** `PublisherLedger` (Mencatat pendapatan per hari/per impression).

- [ ] **Step 2: Async Calculation (BullMQ)**
  - [ ] **Update Worker:** Modifikasi `TelemetryProcessor`.
  - [ ] **Logic:**
    - Setiap kali `ImpressionLog` berhasil dibuat -> Hitung share (misal: `CPM Price * Share %`).
    - Buat record di `PublisherLedger` (Gunakan pola Accumulative per day/hour untuk menghemat baris DB).
    - _Performance:_ Jangan hitung real-time di API Request. Lakukan murni di background job.

- [ ] **Step 3: Reporting Endpoint**
  - [ ] **Endpoint:** `GET /finance/publisher/report`.
  - [ ] **Output:** JSON Summary (Total Earning, Daily Breakdown).
  - [ ] **Type Safety:** Gunakan `serializeBigInt` helper untuk output nominal uang.

---

## 👁️ Phase 13: Sales Tools & Preview (Status: PENDING)

_Definition of Done: Advertiser bisa melihat simulasi tampilan iklan di TV sebelum membayar._

- [ ] **Step 1: Preview Generator**
  - [ ] **Endpoint:** `GET /campaigns/:id/preview-url`.
  - [ ] **Logic:**
    - Ambil thumbnail/image dari Media yang diupload.
    - Overlay ke atas template gambar TV kosong (menggunakan library gambar seperti `sharp` atau generate HTML Canvas link).
    - Return URL sementara (Presigned URL) ke frontend.

---

## 🔗 Phase 14: Integration Sync Engine (SmartIV Core Link) (Status: BLOCKED / FUTURE)

_Definition of Done: Data Hotel & Layar tersinkronisasi otomatis dari SmartIV Core. Dilakukan NANTI saat API Core sudah siap. Saat ini menggunakan Manual CRUD._

- [ ] **Step 1: Security (Machine-to-Machine Auth)**
  - [ ] **Guard:** `ApiKeyGuard` (Header: `X-Integration-Key`).
  - [ ] **Config:** Simpan valid API Key di `.env`.

- [ ] **Step 2: Inventory Webhooks (Receiver)**
  - [ ] **Endpoint:** `POST /integration/sync-inventory` (Bulk Upsert).
  - [ ] **DTO:** `SyncInventoryDto` (Strict Validation: `smartivId`, `name`, `screens: []`).
  - [ ] **Logic (Optimization):**
    - Gunakan `prisma.$transaction` untuk atomic operations.
    - Gunakan pola `upsert` (Create if not exists, Update if exists) berdasarkan `smartivId`.
    - _Avoid O(n) Loops:_ Gunakan `createMany` jika memungkinkan.

- [ ] **Step 3: Status Synchronization**
  - [ ] **Endpoint:** `POST /integration/sync-status`.
  - [ ] **Logic:** Menerima array status layar (`online/offline`) dari Core. Update field `lastPing` dan `status` secara bulk.

---

## 🧹 Technical Debt & Optimization (Continuous)

- [ ] **Database Indexing:** Tambahkan index pada kolom yang sering di-filter (`categoryId`, `smartivId`, `status`, `propertyId`).
- [ ] **Redis Caching:** Implementasi caching untuk endpoint public yang berat (`GET /inventory/*`).
- [ ] **Strict Types:** Audit seluruh codebase, pastikan tidak ada penggunaan `any`. Gunakan `unknown` + Validation (Zod/ClassValidator) untuk input eksternal yang tidak pasti.
