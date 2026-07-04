#!/bin/bash
set -euo pipefail

# ============================================
# Prompt Site Builder - Deploy Script
# ============================================

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Build images
echo "🐳 Building Docker images..."
docker compose build --no-cache

# Run database migrations
echo "🗄️  Running database migrations..."
docker compose exec -T backend npx prisma migrate deploy

# Restart services with zero downtime
echo "🔄 Restarting services..."
docker compose up -d --force-recreate

# Wait for services to be healthy
echo "⏳ Waiting for services to stabilize..."
sleep 15

# Health check
echo "🏥 Running health checks..."
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    docker compose logs backend --tail=50
    exit 1
fi

if curl -sf http://localhost:5173/ > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
    docker compose logs frontend --tail=50
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo ""
echo "✅ Deployment complete!"
echo "🌐 Dashboard: http://localhost:5173"
echo "📊 API Docs:  http://localhost:3000/api/docs"
