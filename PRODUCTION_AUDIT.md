# SmartIV Ads — Production Readiness Audit Report

> **Date**: 3 Maret 2026  
> **Scope**: Seluruh fitur TODO-2 (Phase 10–14), kecuali Phase 15 (Integration Sync) dan Midtrans Production  
> **Branch**: `staging`

---

## 📊 Build & Test Status

| Check                       | Result                            |
| --------------------------- | --------------------------------- |
| TypeScript (`tsc --noEmit`) | ✅ **0 errors**                   |
| Unit Tests (`jest`)         | ✅ **235/235 passed** (32 suites) |
| curl API Tests              | ✅ **60+ passed**                 |
| API Documentation (Scalar)  | ✅ **69/69 endpoints covered**    |

---

## 🔴 CRITICAL — Production Blocker (MUST FIX)

### 1. Hardcoded `localhost:9000` di `storage.service.ts`

**File**: [storage.service.ts](file:///home/eveeze/Learning/nest/smartiv-ads/src/providers/storage/storage.service.ts#L95)

```typescript
// Line 95 — HARDCODED localhost
getFileUrl(key: string): string {
  return `http://localhost:9000/${this.bucketName}/${key}`;
}
```

**Dampak**: Saat deploy ke production/staging, semua URL media yang disimpan di database akan mengarah ke `http://localhost:9000` yang tidak bisa diakses dari luar. Upload sukses tapi URL-nya broken.

**Fix**: Gunakan `MINIO_PUBLIC_URL` dari ConfigService:

```diff
-  getFileUrl(key: string): string {
-    return `http://localhost:9000/${this.bucketName}/${key}`;
-  }
+  getFileUrl(key: string): string {
+    const publicUrl = this.configService.get<string>(
+      'minio.publicUrl',
+      `http://localhost:9000/${this.bucketName}`,
+    );
+    return `${publicUrl}/${key}`;
+  }
```

---

### 2. `media.utils.ts` menggunakan `process.env` langsung

**File**: [media.utils.ts](file:///home/eveeze/Learning/nest/smartiv-ads/src/common/utils/media.utils.ts#L57-L58)

```typescript
// Line 57-58 — process.env langsung, tidak melalui ConfigService
const baseUrl = (
  process.env.MINIO_PUBLIC_URL || 'http://localhost:9000'
).replace(/\/$/, '');
```

**Dampak**: Di production, jika module dimuat sebelum env vars tersedia, fallback ke `localhost:9000`. Ini juga bypass validasi Joi yang sudah dikonfigurasi di `configuration.ts`.

**Fix**: Karena `MediaUtils` adalah static class (bukan Injectable), perlu refactor agar menerima `publicUrl` sebagai parameter, atau buat singleton yang diinisialisasi saat bootstrap.

---

## 🟠 HIGH — Perbaikan Penting (Sebaiknya Fix Sebelum Production)

### 3. `getFileUrl` menyimpan URL non-signed ke database

**File**: `storage.service.ts:55`

Saat upload, `getFileUrl()` dipakai untuk return value yang kemudian **disimpan ke kolom `url` di model Media**. URL ini bersifat permanen (http://hostname/bucket/key), bukan presigned.

**Status**: Tidak berbahaya karena `MediaService.findAll/findOne` sudah generate presigned URL secara dinamis saat query. **Tapi** jika frontend secara tidak sengaja menggunakan `media.url` dari response create, URL tersebut tidak akan berfungsi di MinIO private bucket.

**Rekomendasi**: Simpan hanya key/path di database (`raw/filename.mp4`), bukan full URL. Generate presigned URL selalu di runtime.

---

### 4. S3 Client Endpoint Hardcoded ke `http://`

**File**: [storage.service.ts](file:///home/eveeze/Learning/nest/smartiv-ads/src/providers/storage/storage.service.ts#L27)

```typescript
const fullS3Endpoint = `http://${minioHost}:${minioPort}`;
```

**Dampak**: Jika production menggunakan HTTPS (wajib untuk public-facing MinIO), endpoint akan tetap pakai HTTP.

**Fix**: Tambah env var `MINIO_USE_SSL` dan kondisikan protocol:

```diff
-const fullS3Endpoint = `http://${minioHost}:${minioPort}`;
+const useSSL = this.configService.get<boolean>('minio.useSSL', false);
+const protocol = useSSL ? 'https' : 'http';
+const fullS3Endpoint = `${protocol}://${minioHost}:${minioPort}`;
```

---

## 🟡 MEDIUM — Improvement (Production-Safe tapi Kurang Ideal)

### 5. CORS terbuka lebar (`app.enableCors()`)

**File**: [main.ts:19](file:///home/eveeze/Learning/nest/smartiv-ads/src/main.ts#L19)

```typescript
app.enableCors(); // ← Allow ALL origins
```

**Status**: Ini allow semua origin. Untuk production, seharusnya whitelist domain frontend saja.

**Fix**:

```typescript
app.enableCors({
  origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3001'),
  credentials: true,
});
```

---

### 6. Tidak ada file size limit di media upload

**File**: `media.controller.ts` — `@UseInterceptors(FileInterceptor('file'))`

Tanpa konfigurasi `limits`, Multer default ke unlimited file size. User bisa upload file 10GB dan crash server.

**Fix**: Tambah limits di FileInterceptor:

```typescript
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
}))
```

---

### 7. Campaign startDate tidak validasi ke masa depan

**File**: `campaigns.service.ts:60-76`

Campaign bisa dibuat dengan `startDate` di masa lalu. Ini memungkinkan advertiser membuat campaign "retroaktif" yang langsung tayang.

**Fix**: Tambah validasi `if (start < new Date()) throw new BadRequestException('Start date must be in the future')`.

---

### 8. BigInt → Number overflow risk di `calculateCampaignCost`

**File**: `finance.service.ts:190`

```typescript
totalCost: Number(totalCost), // BigInt → Number bisa oveflow jika > 2^53
```

Untuk IDR, `Number.MAX_SAFE_INTEGER` = Rp 9,007,199,254,740,992 (~9 kuadriliun). **Aman untuk use case saat ini**, tapi idealnya return string untuk future-proof.

---

## ✅ SUDAH BENAR — Fitur yang Production-Ready

### Auth Module ✅

- [x] Register + duplikat email check
- [x] Login + bcrypt password hash
- [x] JWT authentication (JwtAuthGuard)
- [x] Role-based access (RolesGuard: SUPER_ADMIN, ADVERTISER, PROPERTY_OPERATOR)
- [x] Change password (bcrypt compare old → hash new)
- [x] Forgot/Reset password (crypto token, 15min expiry, email rollback)

### Users Module ✅

- [x] CRUD users (Admin only)
- [x] Profile update (self-service)
- [x] Password excluded from responses

### Inventory Module ✅

- [x] Properties CRUD + pagination
- [x] Screens CRUD + propertyId filter
- [x] Rate Cards (conflict detection, cascade logic)
- [x] Category blocklist (many-to-many, DB-level filtering)
- [x] Availability check (with blocklist integration)
- [x] Proper 404 handling

### Media Module ✅

- [x] Upload with MIME type validation
- [x] Tag system (connectOrCreate, lowercase sanitization)
- [x] ABR transcoding via BullMQ (360p, 720p, 1080p)
- [x] GIF preview generation
- [x] Presigned URL on read (1 hour expiry)
- [x] Usage constraint check on delete (campaign dependency)
- [x] Admin approval flow

### Campaigns Module ✅

- [x] Create → freeze balance → PENDING_REVIEW flow
- [x] Save as draft (tanpa potong saldo)
- [x] Submit draft (freeze balance)
- [x] Review (approve → commit, reject → release)
- [x] Cancel (PENDING → release, ACTIVE → refund) — all in $transaction
- [x] Delete (DRAFT only)
- [x] Ownership checks on all operations
- [x] DTO validation (class-validator)
- [x] Audit log on create/cancel

### Finance Module ✅

- [x] Wallet auto-create on topup
- [x] Cost calculation engine (Rate Card priority, package pricing)
- [x] Midtrans webhook (idempotent — already processed check)
- [x] Withdrawal flow (freeze → approve/reject → debit/release)
- [x] Refund flow ($transaction atomic)
- [x] Publisher revenue report (ledger aggregation)

### Dashboard / Analytics Module ✅

- [x] Operator dashboard (parallel queries, efficient groupBy)
- [x] Schedule view (90-day cap prevents memory overflow)
- [x] Property profile (read-only)
- [x] Advertiser summary + Admin summary

### Player Module ✅

- [x] Heartbeat (update lastPing + status)
- [x] Config (timezone, branding)
- [x] Playlist (slot-based, date-filtered)
- [x] Device auth guard (X-Device-ID)

### Telemetry Module ✅

- [x] Async impression logging (BullMQ)
- [x] Bulk insert (createMany, skipDuplicates)
- [x] Revenue share calculation (non-blocking, catch errors separately)
- [x] Daily ledger upsert (prevents row explosion)

### Global Infrastructure ✅

- [x] AllExceptionsFilter (handles HttpException, Prisma errors, unknown)
- [x] TransformInterceptor (consistent response wrapper)
- [x] ValidationPipe (whitelist, transform, forbidNonWhitelisted)
- [x] Database indexing on frequently filtered columns
- [x] BigInt serialization (`applyBigIntSerializers`)

---

## 📋 Action Items Summary

| #   | Severity    | Issue                                   | Fix Effort |
| --- | ----------- | --------------------------------------- | ---------- |
| 1   | 🔴 CRITICAL | `getFileUrl` hardcoded `localhost:9000` | 5 min      |
| 2   | 🔴 CRITICAL | `media.utils.ts` `process.env` fallback | 15 min     |
| 3   | 🟠 HIGH     | URL (bukan key) disimpan ke DB          | 30 min     |
| 4   | 🟠 HIGH     | S3 endpoint hardcoded `http://`         | 5 min      |
| 5   | 🟡 MEDIUM   | CORS terbuka ke semua origin            | 5 min      |
| 6   | 🟡 MEDIUM   | Tidak ada file size limit on upload     | 5 min      |
| 7   | 🟡 MEDIUM   | Campaign startDate bisa masa lalu       | 5 min      |
| 8   | 🟡 MEDIUM   | BigInt→Number pada calculateCost        | 10 min     |

**Estimated Fix Time**: ~1.5 jam untuk semua CRITICAL + HIGH.  
**Setelah fix**: Sistem siap production (minus Midtrans production key).
