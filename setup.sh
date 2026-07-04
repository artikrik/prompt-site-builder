#!/bin/bash
set -euo pipefail

# ============================================
# Prompt Site Builder - Server Setup Script
# ============================================

echo "🚀 Starting Prompt Site Builder setup..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and back in for group changes."
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose v2."
    exit 1
fi

# Create .env from .env.example if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    
    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/your-32-char-minimum-secret-key-here/$JWT_SECRET/" .env
    
    echo "⚠️  Please edit .env and fill in your API keys:"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - OPENAI_API_KEY"
    echo "   - APIFY_TOKEN"
    echo ""
    echo "Press Enter after updating .env..."
    read
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p var/www/client-sites
mkdir -p var/log

# Build and start services
echo "🐳 Building and starting Docker services..."
docker compose build
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations

echo "🗄️  Running database migrations..."
docker compose exec backend npx prisma migrate deploy

# Seed admin user
echo "👤 Seeding admin user..."
docker compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const prisma = new PrismaClient();
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    await prisma.user.upsert({
        where: { email: 'admin@promptsite.com' },
        update: {},
        create: {
            id: uuidv4(),
            email: 'admin@promptsite.com',
            passwordHash,
            name: 'Admin',
            role: 'ADMIN',
        },
    });
    
    console.log('✅ Admin user created: admin@promptsite.com / admin123');
    await prisma.\$disconnect();
}

seed().catch(console.error);
"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Services:"
echo "   - Dashboard:  http://localhost:5173"
echo "   - API:        http://localhost:3000"
echo "   - Swagger:    http://localhost:3000/api/docs"
echo ""
echo "👤 Default admin: admin@promptsite.com / admin123"
echo "   (Change this password immediately!)"
echo ""
echo "📋 Useful commands:"
echo "   docker compose up -d      - Start services"
echo "   docker compose down       - Stop services"
echo "   docker compose logs -f    - View logs"
echo "   docker compose exec backend npx prisma studio - Database UI"
