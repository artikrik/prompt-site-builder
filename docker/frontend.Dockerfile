# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root config for workspace-aware install
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy workspace package.json files
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/

# Install all dependencies via npm workspaces
RUN npm ci

# Copy source code
COPY apps/frontend/src ./apps/frontend/src
COPY apps/frontend/vite.config.ts ./apps/frontend/
COPY apps/frontend/svelte.config.js ./apps/frontend/
COPY apps/frontend/tsconfig.json ./apps/frontend/
COPY packages/shared/src ./packages/shared/src

# Build shared package
RUN cd packages/shared && npm run build

# Build frontend
RUN cd apps/frontend && npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/apps/frontend/.svelte-kit/output ./build
COPY --from=builder /app/apps/frontend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

CMD ["node", "build/index.js"]
