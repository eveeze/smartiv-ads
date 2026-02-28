# 📝 TODO List - SmartIV Ads Advanced Features (Phase 10+)

**Focus:** Enterprise Structure, Business Rules, & Monetization (Standalone Mode).
**Code Standards:** Strict TypeScript (No `any`), O(1)/O(log n) Algorithms, Async Processing via BullMQ.

---

## 🎥 Phase 10: Advanced Media Architecture & Security (Status: COMPLETED ✅)

_Definition of Done: Implementasi standar streaming (ABR), keamanan konten, dan kemudahan manajemen aset (Metadata)._

- [x] **Step 1: Adaptive Bitrate (ABR) Pipeline**
  - [x] **Processor:** Transcoding HLS Multi-bitrate (240p, 360p, 480p, 720p) via FFmpeg.
  - [x] **Playlist:** Generate `master.m3u8` yang menggabungkan seluruh stream varian.
  - [x] **Storage Structure:** Refactor struktur folder di MinIO: `hls/{id}/*.ts` & `hls/{id}/*.m3u8`.

- [x] **Step 2: Rich Media Previews (GIF)**
  - [x] **Thumbnail:** Generate gambar `.jpg` statis dari video (Sudah diimplementasikan).
  - [x] **GIF Preview:** Update Processor untuk generate animasi `.gif` (durasi 3 detik, fps 5) dari detik awal video untuk _hover preview_ di CMS.
    - _Command Hint:_ `ffmpeg -ss 1 -t 3 -i input.mp4 -vf "fps=5,scale=320:-1:flags=lanczos" -c:v gif preview.gif`
  - [x] **Schema Update:** Tambahkan field `previewUrl` (atau `previewPath`) di model `Media`.
  - [x] **Storage:** Upload GIF ke MinIO path `hls/{id}/preview.gif`.

- [x] **Step 3: Content Security (Signed URLs & Protection)**
  - [x] **Signed URL Engine:**
    - Update `StorageService`: Tambahkan method `getPresignedUrl(key: string, expiry: number)`.
    - Ganti return value `getFileUrl` agar menghasilkan URL dengan signature AWS S3/MinIO yang valid (misal: 1 jam).
  - [x] **API Endpoint Update:**
    - Update `MediaService`: Saat `findOne` atau `findAll`, generate Signed URL secara dinamis (jangan simpan Signed URL di DB karena akan expired).
  - [x] **Access Control:**
    - Pastikan Bucket MinIO diset **Private** (bukan Public Read) agar user wajib lewat Signed URL.
    - Implementasi CORS Policy ketat (hanya izinkan domain dashboard & player).

- [x] **Step 4: Media Metadata & Advanced Search (Enterprise Standard)**
  - [x] **Schema Refinement (Normalized):**
    - Buat model baru `MediaTag` (`id`, `name` unique).
    - Relasikan Many-to-Many antara `Media` dan `MediaTag`.
    - Tambahkan field `displayName` dan `description` di `Media`.
  - [x] **DTO & Logic Update:**
    - Update `UploadMediaDto` terima input tags string (misal: "promo, food").
    - Update `MediaService.create`: Gunakan Prisma `connectOrCreate` untuk menangani logika tag baru vs tag lama secara otomatis.
    - Sanitasi Input: Paksa tag menjadi _lowercase_ dan _trim_ spasi sebelum disimpan.
  - [x] **Search Implementation:**
    - Update `findAll`: Support filter `where: { tags: { some: { name: { contains: search } } } }`.
    - Tambahkan endpoint `GET /media/tags` (untuk Autocomplete di Frontend).

---

## 📊 Phase 10.5: Operator Portal & Analytics (Status: COMPLETED ✅)

_Definition of Done: Dashboard khusus untuk Property Operator (Hotel/RS) untuk memantau performa iklan dan jadwal (Tanpa kontrol fisik TV)._

- [x] **Step 1: Operator Dashboard (Finance & Stats)**
  - [x] **Endpoint:** `GET /dashboard/operator`.
  - [x] **Guard:** `Roles(PROPERTY_OPERATOR)`.
  - [x] **Logic:**
    - `revenueCurrentMonth`: Hitung estimasi pendapatan dari `PublisherLedger` (jika ada).
    - `totalImpressions`: Count logs hari ini where `screen.propertyId` == user.propertyId.
    - `activeCampaigns`: Count campaign yang statusnya `ACTIVE` di properti ini.
    - `screenSummary`: Simple count "Online vs Offline" (ambil dari field `status` & `lastPing`).

- [x] **Step 2: Schedule View (Monitoring)**
  - [x] **Endpoint:** `GET /schedule/property`.
  - [x] **Logic:**
    - Ambil semua `Campaign` yang `ACTIVE` dan berhubungan dengan `propertyId` user.
    - Return format kalender: `{ date: '2026-01-20', campaigns: [{ name: 'Iklan Sirup', slot: 'SCREENSAVER' }] }`.
    - _Tujuannya:_ Agar Operator bisa cek jika ada iklan yang tidak pantas di jam tertentu.

- [x] **Step 3: Property Profile (Read-Only Mirror)**
  - [x] **Endpoint:** `GET /properties/my-profile`.
  - [x] **Logic:** Return data `Property` (Nama, Alamat, Logo) milik user yang sedang login.
  - [x] **Validation:** Pastikan Read-Only (tidak ada endpoint Update di sini karena Data Master ada di SmartIV Core).

---

## 🎯 Phase 11: Structural Upgrade (Placement & Zones) (Status: COMPLETED ✅)

_Definition of Done: Sistem mengenali spesifikasi slot iklan secara teknis (Resolusi & Aspek Rasio), bukan sekadar Enum. Ini penting agar manual input inventory lebih valid._

- [x] **Step 1: Schema Refinement**
  - [x] **Create Model `AdPlacement`:**
    - Fields: `code` (unique), `name`, `width`, `height`, `aspectRatio` (e.g., "16:9", "4:1"), `allowedMediaTypes` (Array of Enum).
    - **Seed:** Populate default data (e.g., `FULLSCREEN_1080P`, `BANNER_FOOTER`, `SIDEBAR_MENU`).
  - [x] **Migration:** Relasikan `CampaignItem` dengan `AdPlacement` (menggantikan atau melengkapi `AdSlot` enum).

- [x] **Step 2: Strict Validation Logic**
  - [x] **Update `UploadMediaDto`:** Tambahkan validasi metadata (gunakan `ffprobe` atau `sharp`) untuk memastikan dimensi file user sesuai dengan `Placement` yang ditargetkan.
  - [x] **Service:** `validateMediaCompatibility(mediaId, placementId)`.
    - _Performance:_ Cache konfigurasi Placement di Redis agar validasi tidak hit DB berulang kali.

---

## 🛡️ Phase 12: Brand Safety & Category Blocking (Status: COMPLETED ✅)

_Definition of Done: Hotel (Property Owner) bisa memblokir kategori iklan tertentu agar tidak tayang di properti mereka (misal: Blokir Alkohol atau Kompetitor)._

- [x] **Step 1: Classification Schema**
  - [x] **Update Schema:**
    - Tambah Model `IndustryCategory` (e.g., TRAVEL, F&B, AUTOMOTIVE, ALCOHOL).
    - Tambah field `categoryId` di `Campaign` dan `Media`.
    - Tambah Model `PropertyBlocklist` (Many-to-Many antara `Property` dan `IndustryCategory`).

- [x] **Step 2: Business Logic (Blocking Rule)**
  - [x] **Service:** Update `InventoryService.checkAvailability`.
    - _Logic:_ Saat mengecek ketersediaan slot, filter Campaign yang `categoryId`-nya ada di daftar blocklist Property tersebut.
    - _Performance:_ Gunakan Prisma `where: { NOT: { categoryId: { in: blockedIds } } }` (Database level filtering, hindari filtering di loop JS).

- [x] **Step 3: Admin Configuration**
  - [x] **Endpoint:** `POST /inventory/properties/:id/blocklist`.
  - [x] **Validation:** Pastikan Category ID valid.

---

## 🤝 Phase 13: Publisher Revenue Share (Billing Expansion) (Status: COMPLETED ✅)

_Definition of Done: Sistem menghitung bagi hasil untuk pemilik properti (Hotel Owner) berdasarkan impresi yang tercatat via Telemetry._

- [x] **Step 1: Revenue Configuration**
  - [x] **Update Schema:** Tambah field `revenueSharePercentage` (Float, e.g., 0.3 for 30%) di model `Property`.
  - [x] **Create Model:** `PublisherLedger` (Mencatat pendapatan per hari/per impression).

- [x] **Step 2: Async Calculation (BullMQ)**
  - [x] **Update Worker:** Modifikasi `TelemetryProcessor`.
  - [x] **Logic:**
    - Setiap kali `ImpressionLog` berhasil dibuat -> Hitung share (misal: `CPM Price * Share %`).
    - Buat record di `PublisherLedger` (Gunakan pola Accumulative per day/hour untuk menghemat baris DB).
    - _Performance:_ Jangan hitung real-time di API Request. Lakukan murni di background job.

- [x] **Step 3: Reporting Endpoint**
  - [x] **Endpoint:** `GET /finance/publisher/report`.
  - [x] **Output:** JSON Summary (Total Earning, Daily Breakdown).
  - [x] **Type Safety:** Gunakan `serializeBigInt` helper untuk output nominal uang.

---

## 👁️ Phase 14: Sales Tools & Preview (Status: COMPLETED ✅)

_Definition of Done: Advertiser bisa melihat simulasi tampilan iklan di TV sebelum membayar._

- [x] **Step 1: Preview Generator**
  - [x] **Endpoint:** `GET /campaigns/:id/preview-url`.
  - [x] **Logic:**
    - Ambil thumbnail/image dari Media yang diupload.
    - Overlay ke atas template gambar TV kosong (menggunakan library gambar seperti `sharp` atau generate HTML Canvas link).
    - Return URL sementara (Presigned URL) ke frontend.

---

## 🔗 Phase 15: Integration Sync Engine (SmartIV Core Link) (Status: BLOCKED / FUTURE)

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

- [x] **Database Indexing:** Tambahkan index pada kolom yang sering di-filter (`categoryId`, `smartivId`, `status`, `propertyId`).
- [ ] **Redis Caching:** Implementasi caching untuk endpoint public yang berat (`GET /inventory/*`).
- [x] **Strict Types:** Audit seluruh codebase, pastikan tidak ada penggunaan `any`. Gunakan `unknown` + Validation (Zod/ClassValidator) untuk input eksternal yang tidak pasti.
