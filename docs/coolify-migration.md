# Coolify Hybrid Migration Guide

## Architecture After Migration

```
VPS (192.168.31.22)
├── Coolify (Web UI + orchestration)
│   ├── Services (Coolify-managed):
│   │   ├── PostgreSQL 16  (restored from pg_dump)
│   │   └── Redis 7
│   │
│   └── Applications (Git-integrated):
│       ├── backend  (port 3001, Dockerfile-based)
│       └── frontend (port 3000, Dockerfile-based)
│
└── Caddy (docker-compose.coolify.yml)
    └── Only for *.sitenow.pp.ua client sites
    └── On-Demand TLS via backend health check
```

## Step 1: Backup Production

```bash
ssh root@192.168.31.22

# Backup PostgreSQL
docker exec prompt-site-postgres pg_dump -U postgres prompt_builder > /root/backup-$(date +%Y%m%d).sql

# Backup client sites
tar -czf /root/client-sites-backup.tar.gz /var/www/client-sites/

# Backup env
cp .env /root/env-backup-$(date +%Y%m%d)
```

## Step 2: Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open Coolify at `http://<VPS-IP>:8000` and complete initial setup.

## Step 3: Create Services in Coolify

1. **PostgreSQL 16:**
   - Coolify UI → Services → Add → PostgreSQL
   - Version: 16-alpine
   - Database: prompt_builder
   - User: set in Coolify (copy DATABASE_URL after creation)
   - Restore: `psql < /root/backup-YYYYMMDD.sql`

2. **Redis 7:**
   - Coolify UI → Services → Add → Redis
   - Version: 7-alpine

## Step 4: Create Applications in Coolify

1. **Backend:**
   - Source: Git repository → main branch
   - Build Pack: Dockerfile
   - Dockerfile path: `apps/backend/Dockerfile.coolify`
   - Port: 3001
   - Add all environment variables from `docker-compose.coolify.yml`

2. **Frontend:**
   - Source: Git repository → main branch
   - Build Pack: Dockerfile
   - Dockerfile path: `apps/frontend/Dockerfile.coolify`
   - Port: 3000
   - Environment: `PUBLIC_API_URL=/api`

## Step 5: Deploy Caddy for Client Sites

Upload `docker-compose.coolify.yml` and `docker/Caddyfile.client` to server:

```bash
scp docker-compose.coolify.yml root@192.168.31.22:/opt/caddy-client/
scp docker/Caddyfile.client root@192.168.31.22:/opt/caddy-client/
```

Run Caddy separately:
```bash
cd /opt/caddy-client
docker compose up -d
```

## Step 6: DNS

Point domains to Coolify IP:
- `sitenow.pp.ua` → VPS IP (Coolify proxies to frontend:3000)
- `api.sitenow.pp.ua` → VPS IP (Coolify proxies to backend:3001)
- `*.sitenow.pp.ua` → VPS IP (Caddy handles wildcard TLS)

## Step 7: Verify

```bash
# Health check
curl https://sitenow.pp.ua/api/health
curl https://api.sitenow.pp.ua/health

# Client site
curl -H "Host: test.sitenow.pp.ua" https://localhost/
```

## Rollback

If Coolify fails:
1. Stop Coolify stack
2. Restore original `docker-compose.yml`:
   ```bash
   cd /opt/prompt-site-builder
   docker compose up -d
   ```

## Removed

- GitHub Actions deploy step (Coolify auto-deploys on push to main)
- Caddy from main docker-compose (only client-site Caddy stays)
- API subdomain DNS (Coolify uses internal routing)
