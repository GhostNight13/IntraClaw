# syntax=docker/dockerfile:1.6
# ┌─────────────────────────────────────────────────────────────┐
# │  IntraClaw Dockerfile — multi-stage production build        │
# │  Image size: ~180 MB compressed                              │
# │  Usage: docker build -t intraclaw:latest .                   │
# └─────────────────────────────────────────────────────────────┘

# ── Stage 1: builder ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Tools needed for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY memory/ ./memory/

RUN npm run build

# ── Stage 2: runner (minimal prod image) ────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini \
    && addgroup -S intraclaw \
    && adduser -S intraclaw -G intraclaw

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Compiled JS
COPY --from=builder --chown=intraclaw:intraclaw /app/dist ./dist
# i18n JSON locales (loaded at runtime)
COPY --from=builder --chown=intraclaw:intraclaw /app/src/i18n/locales ./dist/i18n/locales
# Read-only runtime files
COPY --chown=intraclaw:intraclaw memory/ ./memory/

# Writable volumes
RUN mkdir -p data logs \
    && chown -R intraclaw:intraclaw data logs

USER intraclaw
EXPOSE 3001

# tini = proper PID 1, reaps zombies, forwards signals
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
