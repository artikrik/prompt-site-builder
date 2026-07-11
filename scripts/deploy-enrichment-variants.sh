#!/bin/bash
# prompt-site-builder — Production Deployment Script
# Run on the production server (192.168.31.22) after code push to main.
# Usage: bash deploy-enrichment-variants.sh

set -e

echo "=========================================="
echo "Step 1: Pull latest code"
echo "=========================================="
cd /opt/prompt-site-builder
# If using Coolify, redeploy via Coolify UI first to get new Docker images
echo "Trigger Coolify redeploy for prompt-site-builder (main branch)"
echo "Waiting for Coolify to rebuild and redeploy..."

echo ""
echo "=========================================="
echo "Step 2: Check new migration files in container"
echo "=========================================="
docker exec prompt-site-backend ls /app/prisma/migrations/
echo ""
echo "Expected: 20260706000000_add_enrichment_and_variants should be present"
echo "If NOT present, wait for Coolify redeploy to complete."
echo ""

echo "=========================================="
echo "Step 3: Apply Prisma migration"
echo "=========================================="
docker exec prompt-site-backend npx prisma migrate deploy
echo ""
echo "Migration applied. Should see:"
echo "  - 20260706000000_add_enrichment_and_variants"
echo ""

echo "=========================================="
echo "Step 4: Verify env vars"
echo "=========================================="
echo "Checking new env vars in container..."
docker exec prompt-site-backend printenv | grep -E 'FACEBOOK|GOOGLE_MAPS|INSTAGRAM|BFL|ENCRYPTION|GOOGLE_API' | sed 's/=.*/=SET/' || echo "WARNING: Some env vars missing!"
echo ""
echo "Add missing vars via Coolify dashboard or:"
echo "  docker exec prompt-site-backend export VAR_NAME=VALUE"
echo "  (then restart container: docker compose restart backend)"
echo ""
echo "Required new vars:"
echo "  FACEBOOK_ACCESS_TOKEN="
echo "  GOOGLE_MAPS_API_KEY="
echo "  INSTAGRAM_ACCESS_TOKEN="
echo "  GOOGLE_API_KEY="
echo "  BFL_API_KEY="
echo "  ENCRYPTION_KEY=<random-32-chars>"
echo ""

echo "=========================================="
echo "Step 5: Verify services are healthy"
echo "=========================================="
docker compose ps
echo ""
echo "Check backend health:"
curl -s http://localhost:3000/health 2>/dev/null || curl -s http://localhost:3000/ 2>/dev/null || echo "Health check - check manually"
echo ""

echo "=========================================="
echo "Step 6: Migrate existing projects to variants"
echo "=========================================="
echo "Running migration of existing projects..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sitenow.pp.ua","password":"CHANGE_ME"}' | jq -r '.accessToken')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  curl -s -X POST http://localhost:3000/api/projects/migrate-to-variants \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | jq .
  echo ""
  echo "Project migration complete."
else
  echo "Could not get auth token. Please run migration manually:"
  echo "  curl -X POST https://api.sitenow.pp.ua/api/projects/migrate-to-variants \\"
  echo "    -H 'Authorization: Bearer YOUR_JWT_TOKEN'"
fi

echo ""
echo "=========================================="
echo "Step 7: Final verification"
echo "=========================================="
echo "Check variant page: https://app.sitenow.pp.ua/dashboard/projects"
echo "Check settings page: https://app.sitenow.pp.ua/dashboard/settings"
echo "Check enrichment: https://app.sitenow.pp.ua/dashboard/leads (click a lead)"
echo ""
echo "Deployment complete!"
