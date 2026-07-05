#!/usr/bin/env bash
# dev-start.sh — Local dev environment startup
# Usage: bash scripts/dev-start.sh [--create-user]
#   --create-user    Create test user (test@example.com / test123456)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CREATE_USER=false
for arg in "$@"; do
  case "$arg" in
    --create-user) CREATE_USER=true ;;
    -h|--help)
      echo "Usage: bash scripts/dev-start.sh [--create-user]"
      echo "  --create-user    Create test user (test@example.com / test123456)"
      exit 0
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"
PG_CONTAINER="prompt-site-postgres"
REDIS_CONTAINER="prompt-site-redis"
BACKEND_PORT=3000
FRONTEND_PORT=5173
PG_PORT=5543
REDIS_PORT=6379

# Track PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  echo -e "${GREEN}Stopped.${NC}"
}
trap cleanup EXIT INT TERM

# Helper: kill process on a TCP port (Windows-compatible)
kill_port() {
  local port="$1"
  local pid
  pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $NF}' | head -1)
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    taskkill -F -PID "$pid" 2>/dev/null || true
    echo "    (killed PID $pid on port $port)"
  fi
}

log_step() {
  echo -e "${CYAN}[$1]${NC} $2..."
}

log_pass() {
  echo -e "  ${GREEN}OK${NC}"
}

log_warn() {
  echo -e "  ${YELLOW}$1${NC}"
}

log_fail() {
  echo -e "  ${RED}FAIL: $1${NC}"
  exit 1
}

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  prompt-site-builder — Dev Startup${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"

# ── 1. Docker check ───────────────────────────────────────
log_step 1 "Checking Docker"
if ! docker ps &>/dev/null; then
  echo -e "  ${YELLOW}Docker not running. Starting Docker Desktop...${NC}"
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>/dev/null || true
  echo -n "  Waiting for Docker"
  for i in $(seq 1 30); do
    docker ps &>/dev/null && break
    echo -n "."
    sleep 2
  done
  echo ""
  if ! docker ps &>/dev/null; then
    log_fail "Docker failed to start"
  fi
fi
log_pass

# ── 2. PostgreSQL ─────────────────────────────────────────
log_step 2 "Starting PostgreSQL ($PG_CONTAINER)"
if docker ps --format '{{.Names}}' | grep -q "^$PG_CONTAINER$"; then
  log_warn "Already running — skipped"
else
  docker rm -f "$PG_CONTAINER" 2>/dev/null || true
  docker run -d \
    --name "$PG_CONTAINER" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=prompt_builder \
    -p ${PG_PORT}:5432 \
    postgres:16-alpine >/dev/null
  echo -n "  Waiting for PostgreSQL"
  for i in $(seq 1 20); do
    docker exec "$PG_CONTAINER" pg_isready -U postgres &>/dev/null && break
    echo -n "."
    sleep 1
  done
  echo ""
  if ! docker exec "$PG_CONTAINER" pg_isready -U postgres &>/dev/null; then
    log_fail "PostgreSQL not ready"
  fi
  log_pass
fi

# ── 3. Redis ──────────────────────────────────────────────
log_step 3 "Starting Redis ($REDIS_CONTAINER)"
REDIS_NEEDS_START=false
if docker ps --format '{{.Names}}' | grep -q "^$REDIS_CONTAINER$"; then
  REDIS_VER=$(docker exec "$REDIS_CONTAINER" redis-cli INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')
  if [ -z "$REDIS_VER" ] || [ "$(echo "$REDIS_VER" | cut -d. -f1)" -lt 5 ]; then
    log_warn "Redis v${REDIS_VER:-?} too old (need >=5). Recreating..."
    docker rm -f "$REDIS_CONTAINER" 2>/dev/null || true
    REDIS_NEEDS_START=true
  else
    log_warn "Already running (v$REDIS_VER) — skipped"
  fi
else
  REDIS_NEEDS_START=true
fi
if $REDIS_NEEDS_START; then
  docker rm -f "$REDIS_CONTAINER" 2>/dev/null || true
  docker run -d \
    --name "$REDIS_CONTAINER" \
    -p ${REDIS_PORT}:6379 \
    redis:7-alpine >/dev/null
  log_pass
fi

# ── 4. Clear dev ports ───────────────────────────────────
log_step 4 "Clearing dev ports ($BACKEND_PORT, $FRONTEND_PORT)"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"
kill_port "$((FRONTEND_PORT + 1))"
kill_port "$((FRONTEND_PORT + 2))"
log_pass

# ── 5. Environment check ──────────────────────────────────
log_step 5 "Checking environment"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log_fail "$ENV_FILE not found. Copy from .env.example and edit."
fi
if ! grep -q "JWT_REFRESH_SECRET" "$ENV_FILE"; then
  log_warn "JWT_REFRESH_SECRET missing — adding"
  echo "JWT_REFRESH_SECRET=dev-refresh-secret-minimum-32-chars-long" >> "$ENV_FILE"
fi
if ! grep -q "JWT_SECRET" "$ENV_FILE"; then
  log_warn "JWT_SECRET missing — adding"
  echo "JWT_SECRET=dev-secret-key-for-local-development-min-32" >> "$ENV_FILE"
fi
log_pass

# ── 6. Prisma Migrations ──────────────────────────────────
log_step 6 "Running database migrations"
cd "$BACKEND_DIR"
npx prisma migrate deploy 2>&1 | tail -1
log_pass

# ── 7. Backend ─────────────────────────────────────────────
log_step 7 "Starting backend (port $BACKEND_PORT)"
cd "$BACKEND_DIR"
npx nest start --watch &
BACKEND_PID=$!
echo -n "  Waiting for backend"
for i in $(seq 1 30); do
  curl -s "http://localhost:${BACKEND_PORT}/docs" -o /dev/null 2>/dev/null && break
  echo -n "."
  sleep 1
done
echo ""
if curl -s "http://localhost:${BACKEND_PORT}/docs" -o /dev/null 2>/dev/null; then
  log_pass
else
  log_fail "Backend not responding on port $BACKEND_PORT"
fi

# ── 8. Frontend ────────────────────────────────────────────
log_step 8 "Starting frontend (port $FRONTEND_PORT)"
cd "$FRONTEND_DIR"
npx vite --host &
FRONTEND_PID=$!
echo -n "  Waiting for frontend"
for i in $(seq 1 20); do
  curl -s "http://localhost:${FRONTEND_PORT}" -o /dev/null 2>/dev/null && break
  echo -n "."
  sleep 1
done
echo ""
if curl -s "http://localhost:${FRONTEND_PORT}" -o /dev/null 2>/dev/null; then
  log_pass
else
  log_warn "Frontend may take longer. Check http://localhost:${FRONTEND_PORT}"
fi

# ── 9. Test User ───────────────────────────────────────────
if $CREATE_USER; then
  log_step 9 "Creating test user"
  RESPONSE=$(curl -s -X POST "http://localhost:${BACKEND_PORT}/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123456","name":"Test User"}')
  if echo "$RESPONSE" | grep -q "accessToken"; then
    log_pass
    echo -e "  ${GREEN}Login:${NC} test@example.com / test123456"
  elif echo "$RESPONSE" | grep -q "already exists"; then
    log_warn "Already exists — skipped"
    echo -e "  ${GREEN}Login:${NC} test@example.com / test123456"
  else
    log_warn "Unexpected: $RESPONSE"
  fi
fi

# ── Summary ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Dev environment ready${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Backend:   ${BOLD}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  Frontend:  ${BOLD}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  Swagger:   ${BOLD}http://localhost:${BACKEND_PORT}/docs${NC}"
echo -e "  Database:  localhost:${PG_PORT} (postgres:postgres@prompt_builder)"
echo -e "  Redis:     localhost:${REDIS_PORT}"
echo ""
echo -e "  ${CYAN}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for both background processes
wait
