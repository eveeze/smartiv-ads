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
RUN apk add --no-cache openssl

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
# Daripada copy folder node_modules/.prisma yang ribet path-nya di pnpm,
# Kita jalankan ulang 'prisma generate' di stage runner.
# Ini lebih aman dan menjamin binary yang cocok dengan OS Alpine.
# ---------------------------------------------------------------------
RUN pnpm prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
