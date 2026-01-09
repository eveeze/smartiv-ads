# SmartIV Ads Backend API

SmartIV Ads is a comprehensive backend solution designed for managing digital signage advertising networks. This system handles inventory management, campaign scheduling, media transcoding, telemetry tracking from edge devices (screens), and financial transactions via Midtrans.

Built with **NestJS**, utilizing **PostgreSQL** for persistence, **Redis** for caching and queues, and **MinIO** for object storage.

---

## 🏗 Architecture & Tech Stack

- **Framework:** NestJS (Node.js)
- **Database:** PostgreSQL 15 (Prisma ORM)
- **Caching & Queues:** Redis (BullMQ)
- **Object Storage:** MinIO (S3-compatible)
- **Payment Gateway:** Midtrans (Snap API)
- **Media Processing:** FFmpeg (Transcoding & Thumbnails)
- **Deployment:** Docker & GitHub Actions (CI/CD to GHCR)

### Key Features

- Role-Based Access Control (RBAC)
- Automated media transcoding pipeline
- Real-time device telemetry & heartbeat
- Screen inventory & rate card management
- Wallet system with top-up & withdrawals

---

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- pnpm
- Docker & Docker Compose (recommended)

---

### 1. Environment Setup

```bash
cp .env.example .env
```

Configure database, Redis, MinIO, and Midtrans credentials.

---

### 2. Infrastructure (Docker)

```bash
docker-compose up -d
```

---

### 3. Install Dependencies

```bash
pnpm install
```

---

### 4. Database Migration

```bash
pnpm prisma:migrate
pnpm prisma:seed
```

---

### 5. Run the Application

```bash
pnpm start:dev
```

Production:

```bash
pnpm build
pnpm start:prod
```

---

## 📂 Project Structure

```
src/
├── auth/
├── users/
├── media/
├── inventory/
├── campaigns/
├── telemetry/
├── finance/
├── payments/
├── common/
├── config/
└── main.ts
```

---

## 🔐 Authentication & Authorization

Roles:

- Admin
- Advertiser
- Screen Owner

Example:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADVERTISER')
@Get('my-campaigns')
async getMyCampaigns(@CurrentUser() user: User) {
  return this.campaignsService.findByAdvertiser(user.id);
}
```

---

## 🧪 Testing

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

---

## 🐳 Docker Deployment

```bash
docker build -t smartiv-ads:latest .
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📝 License

MIT License

---

**Built with ❤️ by the SmartIV Team**
