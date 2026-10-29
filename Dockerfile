# ==============================================================================
# Attendly — Production Dockerfile with Integrated Nginx Reverse Proxy & File Host
# Multi-stage optimized build for universal deployment (Linux, macOS, Windows)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Base Image
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

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
ENV NEXTAUTH_SECRET=attendly-build-only-placeholder
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# ------------------------------------------------------------------------------
# 4. Production Runner Stage with Nginx Proxy & Installer Hosting
# ------------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Install Nginx reverse proxy and utility tools
RUN apk add --no-cache nginx curl bash coreutils

# Create directory structure for Nginx, runtime, and downloads
RUN mkdir -p /var/www/downloads /etc/nginx/http.d /etc/nginx/conf.d /app/release /app/prisma

# Copy Nginx proxy configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/http.d/default.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy application assets and compiled output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/

# Copy installers from release directory if present
COPY release/ /app/release/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose HTTP (80 - Nginx proxy + Downloads), HTTPS (443), and direct Next.js (3000)
EXPOSE 80 443 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
