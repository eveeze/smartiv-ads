# 📝 SmartIV Backend Revision Tracker

**Date:** 20 Januari 2026
**Based on:** Feedback Stakeholder (Mas-mas SmartIV)
**Status:** In Progress

---

## 🚀 1. Media Management

Menambahkan metadata pada resource media agar informatif dan interaktif.

- [ ] **Schema Update (`Media`):** Tambahkan field `title` (String, nullable) dan `description` (Text, nullable).
- [ ] **Schema Update (`Media` / `CampaignItem`):** Tambahkan field `actionUrl` atau `deepLink` (String, nullable) untuk keperluan click-through (misal: scan QR lari ke URL ini).
- [ ] **DTO Update:** Update `UploadMediaDto` dan `UpdateMediaDto` untuk menerima field baru tersebut.

---

## 🏢 2. Property & Inventory (Location Logic)

Memastikan konfigurasi waktu dan lokasi presisi.

- [ ] **Schema Update (`Property`):** Tambahkan field `timezone` (String, default: 'Asia/Jakarta').
  - _Tujuannya:_ Agar TV di Bali (WITA) menayangkan iklan jam 10 pagi WITA, bukan jam 10 pagi WIB.
- [ ] **Schema Update (`Property`):** Tambahkan field `region` (String, nullable) untuk grouping lokasi (misal: "Jabodetabek", "Bali").
- [ ] **Response Update (`getConfig`):** Kirim data `timezone` ke Player saat booting/heartbeat.

---

## 📢 3. Campaign Logic (The "Package" System)

**[MAJOR CHANGE]** Mengubah cara Campaign dibuat dari "Pilih Screen" menjadi "Pilih Paket & Lokasi".

- [ ] **Schema Update (`Campaign`):**
  - Tambahkan `targetSlot` (Enum: AdSlot).
  - Tambahkan `durationPackage` (Enum/String: 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM').
- [ ] **Service Update (`createCampaign`):**
  - **Input Baru:**
    1. `propertyId` (Target Lokasi)
    2. `targetSlot` (Target Posisi Iklan)
    3. `packageType` (Daily/Weekly/Monthly) -> Otomatis set `startDate` & `endDate`.
  - **Process:** Sistem otomatis mencari seluruh `Screen` di Property tsb yang memiliki Slot tsb.
- [ ] **Date & Time Logic:** Ubah `startDate` dan `endDate` menjadi `DateTime` (bukan Date saja) agar advertiser bisa booking jam tayang spesifik (misal: 12:00 - 14:00).

---

## 💰 4. Finance & Calculation (Rate Card Logic)

Perhitungan biaya otomatis berdasarkan Slot dan Paket Durasi.

- [ ] **Schema Update (`RateCard`):**
  - Rate Card tidak lagi flat per hari, tapi bisa punya varian paket.
  - Opsi A (Simpel): Tetap harga per hari, tapi `calculateCost` memberi diskon jika pilih Weekly/Monthly.
  - Opsi B (Advanced): `RateCard` punya field `dailyPrice`, `weeklyPrice`, `monthlyPrice`.
- [ ] **Logic Perhitungan (`calculateCost`):**
  - **Rumus:** `(Harga Paket Slot) x (Jumlah Screen Aktif di Property)`.
  - User tidak perlu input jumlah screen manual, sistem yang hitung berdasarkan inventory property saat itu.
- [ ] **Adjustment:** Hitungan biaya melekat pada **Enabled Slot** di Screen/Property, bukan sekedar ID Screen.

---

## 🖥️ 5. Player / Device Context

- [ ] **Logic Update:** Player harus pintar memilah campaign.
  - Player request ke server: "Saya Screen ID 1 di Hotel A, punya slot SCREENSAVER".
  - Server jawab: "Nih list campaign untuk Hotel A slot SCREENSAVER". (Tidak perlu mapping ID screen satu-persatu di tabel campaign).

---

## 🧪 Testing Checklist

1.  [ ] **Inventory:** Buat Property "Grand Indo" (WIB), punya 10 Screen. Semua Screen enable slot `MAIN_DISPLAY`.
2.  **Rate Card:** Buat harga `MAIN_DISPLAY` di "Grand Indo": Rp 100.000/hari.
3.  **Campaign:** Advertiser buat campaign:
    - Target: "Grand Indo"
    - Slot: `MAIN_DISPLAY`
    - Paket: "Weekly" (7 Hari)
4.  **Expectation:**
    - Total Harga: 100rb x 7 hari x 10 screen = Rp 7.000.000.
    - Iklan otomatis tayang di ke-10 screen tersebut tanpa pilih manual.
