# --------------------------------------------------------
# 1. Stage: Builder (Build App)
# --------------------------------------------------------
FROM node:20-alpine AS builder

# Install sistem dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install SEMUA dependencies (termasuk devDependencies untuk build)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code
COPY . .

# Build Aplikasi NestJS
RUN pnpm build

# --------------------------------------------------------
# 2. Stage: Prod-Deps (Dependencies Only)
# --------------------------------------------------------
FROM node:20-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies (termasuk dev untuk prisma generate)
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate

# Hapus devDependencies (sisakan production saja)
RUN pnpm prune --prod

# --------------------------------------------------------
# 3. Stage: Runner (Production Image)
# --------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

ENV NODE_ENV=production

# Copy package.json (penting untuk referensi)
COPY package.json ./

# Copy Node Modules dari prod-deps
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma

# Copy Hasil Build dari builder (INTI MASALAHNYA DI SINI)
COPY --from=builder /app/dist ./dist

# Pastikan folder dist ada (Debug purpose, opsional)
# RUN ls -la ./dist

EXPOSE 3000

# Jalankan aplikasi
CMD ["node", "dist/src/main"]