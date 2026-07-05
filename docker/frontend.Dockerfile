# Stage 1: Build
FROM node:22-alpine AS builder

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

# Build frontend (adapter-auto → adapter-node → output at build/)
RUN cd apps/frontend && npm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy adapter-node output (build/ directory with index.js)
COPY --from=builder /app/apps/frontend/build ./build
COPY --from=builder /app/apps/frontend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5173

ENV HOST=0.0.0.0
ENV PORT=5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --max-time 5 http://localhost:5173/ || exit 1

CMD ["node", "build/index.js"]
