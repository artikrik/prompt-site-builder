# Stage 1: Build
FROM node:24-alpine AS builder

# Install Hugo
ARG HUGO_VERSION=0.145.0
RUN apk add --no-cache wget && \
    wget -q https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    tar xzf hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    mv hugo /usr/local/bin/hugo && \
    rm hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    apk del wget

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/backend/ ./apps/backend/
COPY packages/shared/ ./packages/shared/

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Build shared package
RUN cd packages/shared && npm run build

# Build backend
RUN cd apps/backend && npm run build

# Stage 2: Production
FROM node:24-alpine AS production

# Install Hugo and curl for healthcheck
# Hugo version: 0.145.0
ARG HUGO_VERSION=0.145.0
RUN apk add --no-cache wget curl && \
    wget -q https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    tar xzf hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    mv hugo /usr/local/bin/hugo && \
    rm hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    apk del wget

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Create directories for Hugo sites
RUN mkdir -p /var/www/client-sites

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/src/main.js"]
