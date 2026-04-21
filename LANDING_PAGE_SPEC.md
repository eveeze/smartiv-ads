# 🧪 SmartIV Ads — Landing Page E2E Test Simulator

## Tujuan Dokumen

Dokumen ini adalah **konteks lengkap** agar sebuah AI agent dapat membangun **landing page test simulator** yang mensimulasikan alur kerja iklan SmartIV dari ujung ke ujung (end-to-end), mulai dari autentikasi → fetch playlist → tampilkan iklan → hitung durasi → kirim impression report → verifikasi data masuk.

Landing page ini bukan untuk production, tapi untuk **membuktikan bahwa seluruh backend pipeline sudah bekerja benar**.

---

## Arsitektur Backend (NestJS)

| Layer                | Teknologi                                                  |
| -------------------- | ---------------------------------------------------------- |
| Framework            | NestJS (TypeScript)                                        |
| Database             | PostgreSQL (via Prisma ORM)                                |
| Queue                | BullMQ (Redis)                                             |
| Storage              | MinIO (S3-compatible)                                      |
| Auth (User)          | JWT Bearer Token (Header: `Authorization: Bearer <token>`) |
| Auth (Device/Player) | Custom Header: `X-Device-ID: <screen.code>`                |
| API Prefix           | `/api` (semua endpoint diawali `/api/...`)                 |
| Port                 | `3000` (default)                                           |

### Response Wrapper (SEMUA Response)

Semua response sukses (2xx) dibungkus oleh `TransformInterceptor` dengan format:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Semua response error (4xx/5xx) menggunakan format:

```json
{
  "statusCode": 400,
  "success": false,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/..."
}
```

> **PENTING: Selalu akses `response.data.data` untuk mendapat payload sebenarnya (karena Axios/fetch mengembalikan `response.data` sebagai body, lalu di dalamnya ada field `data` dari wrapper). Jika menggunakan `fetch()`, cukup `const json = await res.json(); const payload = json.data;`**

---

## Alur E2E Test yang Harus Disimulasikan

Landing page harus menjalankan flow berikut secara berurutan, dengan visual UI di setiap tahap:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: SETUP & AUTH                                         │
│  ├─ Login sebagai Advertiser → dapat JWT token                 │
│  ├─ Login sebagai Admin → dapat JWT token                      │
│  └─ Tampilkan status: ✅ Auth OK / ❌ Auth Failed              │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 2: DATA VERIFICATION                                    │
│  ├─ Fetch daftar Properties  (GET /api/inventory/properties)   │
│  ├─ Fetch daftar Screens     (GET /api/inventory/screens)      │
│  ├─ Fetch daftar Campaigns   (GET /api/campaigns)              │
│  └─ Tampilkan ringkasan data: property count, screen count,    │
│     active campaign count                                      │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 3: PLAYER SIMULATION (Inti dari test)                   │
│  ├─ Pilih Screen (dari dropdown screen codes yang ada)         │
│  ├─ Kirim Heartbeat   (POST /api/player/heartbeat)             │
│  ├─ Get Config         (GET  /api/player/config)               │
│  ├─ Get Playlist       (GET  /api/player/playlist?slot=...)    │
│  ├─ Tampilkan setiap item playlist:                            │
│  │   ├─ Nama campaign, media type, URL                         │
│  │   ├─ Countdown timer 5 detik (atau sesuai durationSec)      │
│  │   └─ Visual display media (gambar / video player)           │
│  └─ Setelah semua item diputar → lanjut Phase 4                │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 4: TELEMETRY / IMPRESSION REPORT                        │
│  ├─ Kumpulkan data impression dari semua item yang diputar     │
│  ├─ Kirim POST /api/telemetry/impression                       │
│  │   Body: { impressions: [{ campaignId, timestamp, duration }]│
│  ├─ Tampilkan response: success/queued count                   │
│  └─ Status: ✅ Telemetry Sent / ❌ Failed                     │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 5: VERIFICATION (Cek data masuk)                        │
│  ├─ Fetch Analytics Summary  (GET /api/analytics/admin/summary)│
│  ├─ Fetch Operator Dashboard (GET /api/dashboard/operator)     │
│  └─ Tampilkan: Total Revenue, Total Impressions, Screen Stats  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detail API Endpoints

### 1. Authentication

#### POST `/api/auth/login`

- **Purpose**: Login untuk mendapatkan JWT token
- **Body**:

```json
{
  "email": "admin@smartiv.com",
  "password": "password123"
}
```

- **Response** (`data` field):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@smartiv.com",
    "name": "Super Admin",
    "role": "SUPER_ADMIN"
  }
}
```

#### Akun Seed yang Tersedia:

| Role              | Email                         | Password      |
| ----------------- | ----------------------------- | ------------- |
| SUPER_ADMIN       | `admin@smartiv.com`           | `password123` |
| ADVERTISER        | `client@grandbrand.com`       | `password123` |
| ADVERTISER        | `client@umkm.com`             | `password123` |
| PROPERTY_OPERATOR | `operator@grandindonesia.com` | `password123` |

---

### 2. Inventory (Butuh JWT Token — Admin atau Advertiser)

#### GET `/api/inventory/properties?page=1&take=10`

- **Auth**: `Authorization: Bearer <admin_token>`
- **Response** (`data` field): Paginated array of properties

#### GET `/api/inventory/properties/list`

- **Auth**: Bearer token
- **Response**: Lightweight `[{ id, name }]` — cocok untuk dropdown

#### GET `/api/inventory/screens?page=1&take=10`

- **Auth**: Bearer token
- **Response**: Paginated array of screens
- **Penting**: Response berisi `code` field — ini yang dipakai sebagai `X-Device-ID`

#### GET `/api/inventory/screens/list?propertyId=<id>`

- **Auth**: Bearer token
- **Response**: `[{ id, code, name, propertyName }]`

---

### 3. Campaigns (Butuh JWT Token)

#### GET `/api/campaigns`

- **Auth**: Bearer token (Admin melihat semua, Advertiser melihat miliknya)
- **Query params**: `?status=ACTIVE&page=1&take=10`
- **Response**: Array of campaigns with id, name, status, startDate, endDate, targetSlot, items, etc.

---

### 4. Player API (Auth: X-Device-ID Header)

> **KRITIS: Player API TIDAK menggunakan JWT Bearer Token. Autentikasi via custom header `X-Device-ID` yang berisi screen `code`.**

#### POST `/api/player/heartbeat`

- **Headers**: `X-Device-ID: <screen_code>` (contoh: `GI-JKT-SCR-1`)
- **Body**:

```json
{
  "ipAddress": "192.168.1.100",
  "freeStorage": 50000000
}
```

- **Response** (dalam wrapper `data`):

```json
{
  "status": "ok",
  "serverTime": "2026-04-21T13:00:00.000Z"
}
```

#### GET `/api/player/config`

- **Headers**: `X-Device-ID: <screen_code>`
- **Response** (dalam wrapper `data`):

```json
{
  "screenId": 1,
  "screenName": "TV MALL 1",
  "orientation": "LANDSCAPE",
  "property": {
    "name": "Grand Indonesia Mall",
    "address": "Jl. MH Thamrin No. 1, Jakarta",
    "timezone": "Asia/Jakarta",
    "logo": "http://localhost:9000/smartiv-media/...",
    "themeColor": null
  },
  "refreshInterval": 60
}
```

#### GET `/api/player/playlist`

- **Headers**: `X-Device-ID: <screen_code>`
- **Query params**: `?slot=SCREENSAVER` (opsional, default: SCREENSAVER)
- **Slot enum values**: `SCREENSAVER`, `INFO_SLIDER`, `APP_PROMOTION`, `LEISURE_CULINARY`, `LEISURE_TOURISM`, `LEISURE_GIFT`, `WELCOME_GREETING`, `BACKGROUND`
- **Response** (dalam wrapper `data`):

```json
{
  "slot": "SCREENSAVER",
  "generatedAt": "2026-04-21T13:00:00.000Z",
  "totalDuration": 45,
  "items": [
    {
      "campaignId": 1,
      "campaignName": "[ACTIVE] Campaign Lebaran GI",
      "mediaId": 1,
      "type": "VIDEO",
      "mediaUrl": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      "duration": 30,
      "slot": "SCREENSAVER",
      "actionUrl": "https://qr.promo.com/123"
    },
    {
      "campaignId": 1,
      "campaignName": "[ACTIVE] Campaign Lebaran GI",
      "mediaId": 2,
      "type": "IMAGE",
      "mediaUrl": "https://via.placeholder.com/1920x1080.png?text=Iklan+Gambar+HD",
      "duration": 15,
      "slot": "SCREENSAVER"
    }
  ]
}
```

**Catatan penting tentang media URL:**

- Untuk `type: "VIDEO"` → URL bisa berupa HLS `.m3u8` stream (gunakan HLS.js player) atau direct video URL
- Untuk `type: "IMAGE"` → URL langsung ke gambar (bisa ditampilkan dengan `<img>`)
- Dari seed data, video menggunakan test HLS stream: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`
- Image menggunakan placeholder: `https://via.placeholder.com/1920x1080.png?text=Iklan+Gambar+HD`

---

### 5. Telemetry / Impression Report (Auth: X-Device-ID Header)

> **Ini endpoint untuk mengirim data "berapa lama iklan ditampilkan"**

#### POST `/api/telemetry/impression`

- **Headers**: `X-Device-ID: <screen_code>`
- **HTTP Status Response**: `202 Accepted` (async processing via BullMQ)
- **Body**:

```json
{
  "impressions": [
    {
      "campaignId": 1,
      "timestamp": "2026-04-21T13:00:00.000Z",
      "duration": 30
    },
    {
      "campaignId": 1,
      "timestamp": "2026-04-21T13:00:30.000Z",
      "duration": 15
    }
  ]
}
```

**Validation rules pada setiap item `impressions`:**

- `campaignId` — wajib integer, min 1
- `timestamp` — wajib ISO8601 date string (waktu mulai tayang)
- `duration` — wajib integer, min 1 (durasi dalam detik)

- **Response** (dalam wrapper `data`):

```json
{
  "success": true,
  "queued": 2
}
```

**Apa yang terjadi di backend setelah impressions dikirim:**

1. Data masuk ke BullMQ queue (`telemetry-queue`)
2. `TelemetryProcessor` meng-consume job dan:
   - Bulk insert ke tabel `impression_logs`
   - Hitung revenue share ke `publisher_ledger`
3. Data akan muncul di:
   - Admin Dashboard → total impressions
   - Operator Dashboard → impressions today
   - Publisher Ledger → daily revenue

---

### 6. Analytics & Dashboard (Butuh JWT Token)

#### GET `/api/analytics/admin/summary`

- **Auth**: Bearer token (SUPER_ADMIN only)
- **Response** (dalam wrapper `data`):

```json
{
  "totalRevenue": "10500000",
  "totalScreens": 35,
  "screenStats": {
    "ONLINE": 35,
    "OFFLINE": 0,
    "MAINTENANCE": 0
  }
}
```

#### GET `/api/analytics/advertiser/summary`

- **Auth**: Bearer token (ADVERTISER only)
- **Response** (dalam wrapper `data`):

```json
{
  "activeCampaigns": 2,
  "pendingCampaigns": 0,
  "totalSpent": "35500000",
  "remainingBalance": "464500000"
}
```

#### GET `/api/dashboard/operator`

- **Auth**: Bearer token (PROPERTY_OPERATOR only)
- **Response** (dalam wrapper `data`):

```json
{
  "revenueCurrentMonth": "150000",
  "totalImpressions": 1250,
  "activeCampaigns": 3,
  "screenSummary": {
    "online": 8,
    "offline": 2
  }
}
```

---

## Seed Data yang Sudah Ada di Database

Setelah `prisma db seed`, data berikut tersedia:

### Properties (3 buah)

| Property              | Type     | Classification | City     | SmartivCode | Screens | Revenue Share |
| --------------------- | -------- | -------------- | -------- | ----------- | ------- | ------------- |
| Grand Indonesia Mall  | MALL     | LUXURY         | Jakarta  | `GI-JKT`    | 15      | 30%           |
| Siloam Hospitals Bali | HOSPITAL | PREMIUM        | Denpasar | `SH-BALI`   | 10      | 25%           |
| Hotel Savoy Homann    | HOTEL    | STANDARD       | Bandung  | `HSH-BDG`   | 10      | 20%           |

### Screen Codes (Format: `<SMARTIV_CODE>-SCR-<N>`)

Contoh screen codes yang bisa dipakai sebagai `X-Device-ID`:

- `GI-JKT-SCR-1` sampai `GI-JKT-SCR-15` (Grand Indonesia)
- `SH-BALI-SCR-1` sampai `SH-BALI-SCR-10` (Siloam Bali)
- `HSH-BDG-SCR-1` sampai `HSH-BDG-SCR-10` (Hotel Savoy)

### Active Campaigns (2 buah)

| Campaign                     | Property              | Slot        | Cost       | Media Items               |
| ---------------------------- | --------------------- | ----------- | ---------- | ------------------------- |
| [ACTIVE] Campaign Lebaran GI | Grand Indonesia Mall  | SCREENSAVER | 10,500,000 | Video (30s) + Image (15s) |
| [ACTIVE] Health Info Bali    | Siloam Hospitals Bali | SCREENSAVER | 25,000,000 | Image (10s)               |

### Media Assets (2 buah)

| ID  | Type  | Title              | URL                                                              |
| --- | ----- | ------------------ | ---------------------------------------------------------------- |
| 1   | VIDEO | Promo Lebaran 2026 | `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`              |
| 2   | IMAGE | Banner Diskon 50%  | `https://via.placeholder.com/1920x1080.png?text=Iklan+Gambar+HD` |

---

## Spesifikasi Landing Page yang Harus Dibangun

### Tech Stack

- **Single-page HTML + CSS + JavaScript** (Vanilla, tanpa framework)
- Library boleh digunakan: **HLS.js** (untuk memutar video HLS `.m3u8`)
- Hosting: File statis, bisa dibuka langsung di browser

### Fitur & UI Requirements

#### Panel 1: Configuration

- Input field untuk **Backend URL** (default: `http://localhost:3000/api`)
- Dropdown untuk memilih **User Role** yang mau ditest:
  - Admin (`admin@smartiv.com`)
  - Advertiser (`client@grandbrand.com`)
  - Operator (`operator@grandindonesia.com`)
- Input untuk **Screen Device ID** (default: `GI-JKT-SCR-1`)
- Dropdown untuk **Ad Slot** (default: `SCREENSAVER`)
- Tombol **"▶ Start E2E Test"**

#### Panel 2: Test Progress & Logs

- Step-by-step visual progress (checklist with ✅/❌/⏳):
  1. `Auth Login` → tampilkan token (truncated)
  2. `Fetch Inventory Data` → tampilkan jumlah properties, screens
  3. `Player Heartbeat` → tampilkan server time
  4. `Player Config` → tampilkan property name, timezone
  5. `Fetch Playlist` → tampilkan jumlah items, total duration
  6. `Play Ads` → countdown per item (lihat Panel 3)
  7. `Send Impression Report` → tampilkan queued count
  8. `Verify Analytics` → tampilkan total revenue, impressions

- Real-time log console di bawah (scrollable, monospace font)

#### Panel 3: Ad Player Simulator

- Area display 16:9 aspect ratio (mirip TV)
- Jika media type `VIDEO` → gunakan HLS.js untuk play `.m3u8` stream
- Jika media type `IMAGE` → tampilkan gambar full area
- **Countdown overlay** di pojok kanan atas: "⏱ 5s", "⏱ 4s", ..., "⏱ 0s"
  - Gunakan `durationSec` dari playlist item, ATAU override dengan 5 detik untuk test cepat
- Progress bar di bawah menunjukkan durasi
- Info banner: Campaign name, Media ID, Slot

#### Panel 4: Results Summary

- Tabel hasil test:
  - ✅/❌ Login
  - ✅/❌ Heartbeat
  - ✅/❌ Config fetched
  - ✅/❌ Playlist loaded (N items)
  - ✅/❌ All ads played
  - ✅/❌ Impressions sent (N queued)
  - ✅/❌ Analytics verified
- **Overall verdict**: "🟢 SYSTEM OK" atau "🔴 SYSTEM FAILURE"

---

## Implementasi Impression yang Benar

Setelah setiap item playlist diputar, landing page harus mengumpulkan data impression:

```javascript
// Kumpulkan selama ads diputar
const impressions = [];

playlistItems.forEach((item) => {
  impressions.push({
    campaignId: item.campaignId, // Integer — ID campaign dari playlist
    timestamp: new Date().toISOString(), // String — Waktu mulai tayang (ISO8601)
    duration: item.duration, // Integer — Durasi aktual tayang (detik)
  });
});

// Kirim sekaligus setelah semua selesai diputar
await fetch(`${baseUrl}/telemetry/impression`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Device-ID': selectedScreenCode, // Bukan JWT! Pakai screen code
  },
  body: JSON.stringify({ impressions }),
});
```

---

## Edge Cases yang Harus Ditangani

1. **Backend belum running** → Tampilkan pesan error jelas di log panel, jangan crash
2. **Playlist kosong** (tidak ada campaign active untuk screen/slot) → Tampilkan "No ads available" dan skip ke Phase 4 (tetap kirim empty impressions array, atau skip telemetry)
3. **HLS video gagal load** → Fallback ke tampilkan thumbnail/placeholder, tetap jalankan countdown timer
4. **Telemetry gagal** → Log error tapi tetap lanjutkan ke verification phase
5. **Analytics endpoint forbidden** (karena role salah) → Log warning, skip verifikasi yang butuh role lain
6. **CORS error** → Backend sudah enable CORS (`app.enableCors()`) jadi seharusnya tidak ada masalah jika backend running di localhost. Jika tetap error, kemungkinan backend belum running.
7. **Screen code salah / tidak ditemukan** → Player API akan return `401 Unauthorized` dengan message "Device ID is not registered"

---

## Bagaimana Memverifikasi Sistem Sudah Benar

Jika semua Phase berhasil:

1. ✅ Login berhasil → JWT valid, user data match
2. ✅ Inventory data ada → Database terisi dengan seed data
3. ✅ Heartbeat response OK → Screen ditemukan di database (code valid)
4. ✅ Config response → Property + screen relationship benar
5. ✅ Playlist ada items → Campaign active, targeting & date range benar
6. ✅ Ads ditampilkan → Media URL accessible, HLS stream playable
7. ✅ Impression dikirim & queued → BullMQ + Redis running
8. ✅ Analytics ada data → Telemetry processor berjalan, data masuk ke DB

Jika ada yang gagal, log harus menunjukkan **di titik mana** pipeline putus, sehingga developer tahu harus debug di bagian mana.

---

## Prasyarat Sebelum Testing

Sebelum menjalankan landing page, pastikan backend sudah siap:

```bash
# 1. Start infrastructure (PostgreSQL + Redis + MinIO)
docker-compose up -d

# 2. Run database migrations
npx prisma migrate dev

# 3. Seed database with test data
npx prisma db seed

# 4. Start the NestJS backend
pnpm run start:dev
# Backend akan berjalan di http://localhost:3000

# 5. Verify backend running
curl http://localhost:3000/api
# Harus mengembalikan response (bukan connection refused)
```

---

## Catatan Penting untuk AI Agent yang akan Membuat Landing Page

1. **JANGAN** gunakan framework React/Vue/Angular. Gunakan vanilla HTML+CSS+JS saja.
2. **Gunakan** `fetch()` API untuk semua HTTP requests.
3. **Include** HLS.js via CDN: `https://cdn.jsdelivr.net/npm/hls.js@latest`
4. **Desain** harus premium, dark theme, dengan animasi smooth (landing page ini juga showcase kualitas).
5. **Semua** request harus menangani error gracefully (try/catch) dan menampilkan hasilnya di log panel.
6. Backend URL bisa di-configure karena mungkin berbeda per environment (localhost:3000 vs staging server).
7. Response dari backend **selalu dibungkus** dalam `{ statusCode, success, message, data }` — jadi payload ada di `data` field dari response body.
8. **Player API dan Telemetry API** menggunakan `X-Device-ID` header, **bukan** JWT Bearer token.
9. **Analytics dan Dashboard** menggunakan JWT Bearer token, dan tiap endpoint punya role restriction yang berbeda.
10. Untuk test cepat, bisa gunakan **5 detik countdown** untuk setiap ad item, bukan durasi asli (yang bisa 30 detik).
11. Buat checkbox/toggle "Use Quick Mode (5s per ad)" di panel konfigurasi.
