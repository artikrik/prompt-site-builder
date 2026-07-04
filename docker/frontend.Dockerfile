# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy frontend package files
COPY apps/frontend/package.json ./
COPY apps/frontend/package-lock.json* ./

# Install frontend dependencies (self-contained)
RUN npm ci

# Copy shared package source and build it
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY tsconfig.base.json ./

# Install shared package dependencies and build
RUN cd packages/shared && npm install --install-strategy=nested && npm run build

# Link shared package into frontend's node_modules
RUN mkdir -p node_modules/@prompt-site-builder && ln -s /app/packages/shared node_modules/@prompt-site-builder/shared

# Copy frontend source
COPY apps/frontend/src ./src
COPY apps/frontend/static ./static
COPY apps/frontend/vite.config.ts ./
COPY apps/frontend/svelte.config.js ./
COPY apps/frontend/tsconfig.json ./

# Build frontend
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/.svelte-kit/output ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

CMD ["npm", "run", "preview", "--", "--port", "5173", "--host"]
