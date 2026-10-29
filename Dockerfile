# ==============================================================================
# Attendly — Production Dockerfile
# Optimized multi-stage build for universal deployment (Windows, macOS, Linux)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Base Image with Alpine Linux & Required Prisma Native Libraries
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl curl

# ------------------------------------------------------------------------------
# 2. Dependencies Stage
# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# ------------------------------------------------------------------------------
# 3. Build Stage
# ------------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:./dev.db
ENV NEXTAUTH_SECRET=attendly-build-only-placeholder-key-32b
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# ------------------------------------------------------------------------------
# 4. Production Runner Stage
# ------------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copy application assets and compiled output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persistent directory for SQLite database storage
RUN mkdir -p /app/prisma && chown -R node:node /app/prisma

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
