FROM node:22-alpine

WORKDIR /app

# Copy monorepo root configs
COPY package.json package-lock.json turbo.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN npm ci --workspace=apps/backend

# Copy source
COPY packages/shared packages/shared/
COPY apps/backend apps/backend/

# Build shared + backend
RUN npx turbo run build --filter=@prompt-site-builder/backend

EXPOSE 3001
CMD ["node", "apps/backend/dist/main.js"]
