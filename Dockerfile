# ----------------------------
# Stage 1: Builder (Build App)
# ----------------------------
FROM node:20-alpine AS builder

# Aktifkan pnpm bawaan Node.js
RUN corepack enable

WORKDIR /app

# Copy file dependency definition
COPY package.json pnpm-lock.yaml ./

# Copy folder prisma (Tanpa prisma.config.ts karena kita pakai v6)
COPY prisma ./prisma/

# Install dependencies (termasuk devDependencies untuk build)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client (Versi 6 Stable)
RUN pnpm prisma generate

# Copy seluruh source code
COPY . .

# Build NestJS ke folder dist/
RUN pnpm build

# ----------------------------
# Stage 2: Runner (Production)
# ----------------------------
FROM node:20-alpine

# Aktifkan pnpm
RUN corepack enable

WORKDIR /app

# Install FFmpeg (Wajib untuk HLS Transcoding)
RUN apk add --no-cache ffmpeg

# Copy package definition
COPY package.json pnpm-lock.yaml ./

# Install dependencies production only (Hemat size image)
RUN pnpm install --prod --frozen-lockfile

# Copy hasil build dari stage builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Penting: Copy Prisma Client yang sudah di-generate dari builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port aplikasi
EXPOSE 3000

# Command saat container jalan:
# 1. Jalankan migrasi DB (deploy)
# 2. Jalankan aplikasi
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
