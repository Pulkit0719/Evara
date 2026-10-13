# ==============================================================================
# Multi-stage Dockerfile for Evara
# 100% self-hosted, independent, zero-cost production container
# ==============================================================================

# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package descriptors
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Run build (Vite client + esbuild server)
RUN pnpm build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts and package descriptors
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/dist ./dist

# Install production-only dependencies
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate && \
    pnpm install --prod --frozen-lockfile

# Create directory for local storage fallback
RUN mkdir -p /app/.storage/uploads && chown -R node:node /app

USER node

EXPOSE 3000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["node", "dist/index.js"]
