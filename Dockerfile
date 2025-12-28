# --------------------------------------------------------
# 1. Stage: Builder (Untuk Build & Development)
#    Image ini memiliki SEMUA dependencies (Dev + Prod) + FFmpeg
# --------------------------------------------------------
FROM node:20-alpine AS builder

# Install pnpm & dependencies sistem
RUN corepack enable && corepack prepare pnpm@latest --activate

# [FIX] Install FFmpeg & OpenSSL di sini agar tersedia saat mode Dev (docker-compose.dev.yml)
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

# Copy config files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install SEMUA dependencies (termasuk devDependencies)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code & Build (untuk production artifact)
COPY . .
RUN pnpm build

# --------------------------------------------------------
# 2. Stage: Prod-Deps (Intermediate Stage untuk membersihkan deps)
# --------------------------------------------------------
FROM node:20-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install HANYA production dependencies
RUN pnpm install --prod --frozen-lockfile
RUN pnpm prisma generate

# --------------------------------------------------------
# 3. Stage: Runner (Final Image untuk Production)
# --------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install FFmpeg di Production juga
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

# Copy hasil build dari 'builder'
COPY --from=builder /app/dist ./dist

# Copy node_modules yang bersih dari 'prod-deps'
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main"]