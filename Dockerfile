# ============================================================
# Stage 1 : Builder
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Dépendances de build (cache layer)
COPY package*.json ./
RUN npm ci

# Source TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
COPY memory/ ./memory/
COPY skills/ ./skills/

# Compile
RUN npm run build

# ============================================================
# Stage 2 : Runner (image minimale)
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Sécurité : user non-root
RUN addgroup -S intraclaw && adduser -S intraclaw -G intraclaw

ENV NODE_ENV=production
ENV PORT=3000

# Deps prod seulement
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Artifacts du builder
COPY --from=builder --chown=intraclaw:intraclaw /app/dist ./dist
COPY --chown=intraclaw:intraclaw memory/ ./memory/
COPY --chown=intraclaw:intraclaw skills/ ./skills/

# Dossiers runtime avec bonnes permissions
RUN mkdir -p data logs && chown -R intraclaw:intraclaw data logs

USER intraclaw
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
