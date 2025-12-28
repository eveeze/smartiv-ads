# --------------------------------------------------------
# 1. Stage: Builder (Build aplikasi & Generate Prisma Client)
# --------------------------------------------------------
FROM node:20-alpine AS builder

# Install pnpm & dependencies sistem yang dibutuhkan
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl

WORKDIR /app

# Copy config files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies (termasuk devDependencies untuk build)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code & Build
COPY . .
RUN pnpm build

# --------------------------------------------------------
# 2. Stage: Runner (Image Production yang bersih)
# --------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

# [UPDATE PHASE 4] Install FFmpeg (Wajib untuk Transcoding) & OpenSSL
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install HANYA production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy hasil build dari stage builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# ---------------------------------------------------------------------
# FIX UTAMA DI SINI:
# Jalankan ulang 'prisma generate' di stage runner untuk menjamin
# binary yang cocok dengan OS Alpine (production environment).
# ---------------------------------------------------------------------
RUN pnpm prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]