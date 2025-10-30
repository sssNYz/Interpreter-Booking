# syntax=docker/dockerfile:1

# --- Base image for all stages ---
ARG NODE_VERSION=20-slim

# --- Dev base (pre-installed openssl) ---
FROM node:${NODE_VERSION} AS devbase
WORKDIR /app
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# --- Dependencies (production) ---
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install minimal OS deps (openssl for Prisma)
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install only production dependencies, skip lifecycle scripts (postinstall)
RUN npm ci --omit=dev --ignore-scripts

# --- Builder (full deps for build) ---
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install all deps for building Next.js, skip lifecycle scripts for now
RUN npm ci --ignore-scripts

# Copy Prisma schema for generate, and source for build
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner (final minimal image) ---
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Ensure openssl present for Prisma engines
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3030

# Copy production node_modules and app build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3030

# Run Prisma migrations then optional seed then start server (idempotent)
CMD ["sh", "-c", "npx prisma migrate deploy && ( [ \"$AUTO_SEED\" = \"1\" ] && npx prisma db seed || true ) && npm run start -- -p $PORT"]
