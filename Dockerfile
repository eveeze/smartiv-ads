# --------------------------------------------------------
# 1. Stage: Builder (Build App)
# --------------------------------------------------------
FROM node:20-alpine AS builder

# Install system dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code
COPY . .

# Build NestJS Application
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

# Install dependencies (including dev for prisma generate)
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate

# Remove devDependencies (keep production only)
# ts-node and typescript MUST be in "dependencies" in package.json for this to work
RUN pnpm prune --prod

# --------------------------------------------------------
# 3. Stage: Runner (Production Image)
# --------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files for running & seeding
COPY package.json pnpm-lock.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
CMD ["node", "dist/src/main"]