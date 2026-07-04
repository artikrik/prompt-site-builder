#!/bin/bash
set -euo pipefail

# ============================================
# Prompt Site Builder — Server Setup Script
# Run ONCE on Ubuntu Server (22.04/24.04)
# ============================================
#
# Usage (run as root or user with sudo):
#   curl -sSL https://raw.githubusercontent.com/artikrik/prompt-site-builder/main/scripts/server-setup.sh | bash
#
# Or manually:
#   chmod +x server-setup.sh && sudo ./server-setup.sh
#

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# ============================================
# Pre-flight checks
# ============================================
echo ""
echo "============================================"
echo " Prompt Site Builder — Server Setup"
echo "============================================"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    err "Run as root or with sudo"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    info "OS: $NAME $VERSION_ID"
else
    err "Cannot detect OS. Ubuntu 22.04+ required."
fi

# ============================================
# 1. Install system dependencies
# ============================================
log "Installing system packages..."

apt-get update -qq

apt-get install -y -qq \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    jq \
    htop

log "System packages installed"

# ============================================
# 2. Install Docker + Docker Compose
# ============================================
if command -v docker &> /dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    systemctl enable docker --now
    log "Docker installed: $(docker --version)"
fi

# ============================================
# 3. Install Hugo Extended
# ============================================
HUGO_VERSION="0.139.0"

if command -v hugo &> /dev/null; then
    log "Hugo already installed: $(hugo version)"
else
    log "Installing Hugo Extended ${HUGO_VERSION}..."

    HUGO_PKG="hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
    wget -q "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${HUGO_PKG}"
    tar xzf "$HUGO_PKG"
    mv hugo /usr/local/bin/hugo
    chmod +x /usr/local/bin/hugo
    rm "$HUGO_PKG"

    log "Hugo installed: $(hugo version)"
fi

# ============================================
# 4. Configure firewall
# ============================================
log "Configuring firewall..."

ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null

# SSH
ufw allow 22/tcp comment 'SSH' > /dev/null

# HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP' > /dev/null
ufw allow 443/tcp comment 'HTTPS' > /dev/null
ufw allow 443/udp comment 'HTTPS QUIC' > /dev/null

ufw --force enable > /dev/null

log "Firewall configured (SSH, HTTP, HTTPS only)"

# ============================================
# 5. Create project directory
# ============================================
APP_DIR="/opt/prompt-site-builder"

if [ ! -d "$APP_DIR" ]; then
    log "Creating $APP_DIR..."
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/var/www/client-sites"
fi

log "Project directory: $APP_DIR"

# ============================================
# 6. Create .env template (if missing)
# ============================================
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    log "Creating .env template..."
    cat > "$ENV_FILE" << 'ENVEOF'
# ===========================================
# Prompt Site Builder — Production .env
# ===========================================
# FILL IN ALL VALUES before first deploy!
# Generate secrets: openssl rand -hex 32

NODE_ENV=production
PORT=3000
FRONTEND_URL=https://sitenow.pp.ua

# Database
DATABASE_URL=postgresql://promptsite:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/promptsite
POSTGRES_DB=promptsite
POSTGRES_USER=promptsite
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Auth — generate with: openssl rand -hex 32
JWT_SECRET=REPLACE_WITH_64CHAR_HEX
JWT_REFRESH_SECRET=REPLACE_WITH_64CHAR_HEX
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LLM_PROVIDER=anthropic

# Image Generation
IMAGE_PROVIDER=dall-e-3
DALL_E_MODEL=dall-e-3

# Scraper
APIFY_TOKEN=your-apify-token

# Publishing
HUGO_SITES_PATH=/var/www/client-sites
HUGO_BINARY_PATH=hugo

# Domain
BASE_DOMAIN=sitenow.pp.ua

# Widgets (optional)
EASYWEEK_API_KEY=
WAYFORPAY_MERCHANT=
WAYFORPAY_SECRET=
MONOBANK_API_KEY=
ENVEOF
    warn ".env template created at $ENV_FILE"
    warn ">>> EDIT THIS FILE with real values before deploying! <<<"
else
    log ".env already exists"
fi

# ============================================
# 7. Setup GitHub Actions self-hosted runner
# ============================================
RUNNER_DIR="$APP_DIR/actions-runner"

if [ -d "$RUNNER_DIR" ]; then
    log "Runner already configured at $RUNNER_DIR"
else
    log "Setting up GitHub Actions runner..."

    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"

    RUNNER_VERSION="2.321.0"
    curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
        -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    tar xzf "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    rm "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

    # Create helper script for runner setup
    cat > "$RUNNER_DIR/configure-runner.sh" << 'RUNNEREOF'
#!/bin/bash
set -euo pipefail

TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
    echo "Usage: ./configure-runner.sh <GITHUB_RUNNER_TOKEN>"
    echo ""
    echo "Get token at:"
    echo "  https://github.com/artikrik/prompt-site-builder/settings/actions/runners/new"
    exit 1
fi

cd "$(dirname "$0")"

./config.sh \
    --url https://github.com/artikrik/prompt-site-builder \
    --token "$TOKEN" \
    --name "$(hostname)" \
    --labels self-hosted,production \
    --work /opt/prompt-site-builder \
    --unattended \
    --replace

echo ""
echo "Installing as systemd service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "✅ Runner installed. Check status:"
echo "  sudo ./svc.sh status"
RUNNEREOF

    chmod +x "$RUNNER_DIR/configure-runner.sh"
    log "Runner downloaded. Use configure-runner.sh <TOKEN> to finish setup."
fi

# ============================================
# 8. Summary
# ============================================
echo ""
echo "============================================"
echo " Setup Complete"
echo "============================================"
echo ""
echo "  Server:       $(hostname) ($(hostname -I | awk '{print $1}'))"
echo "  Docker:       $(docker --version 2>/dev/null || echo 'not found')"
echo "  Hugo:         $(hugo version 2>/dev/null || echo 'not found')"
echo "  Project dir:  $APP_DIR"
echo "  Runner dir:   $RUNNER_DIR"
echo ""
echo "============================================"
echo " Next Steps"
echo "============================================"
echo ""
echo "1. Edit .env with production values:"
echo "     nano $ENV_FILE"
echo ""
echo "2. Configure GitHub runner:"
echo "     cd $RUNNER_DIR"
echo "     ./configure-runner.sh <TOKEN>"
echo ""
echo "   Get token: https://github.com/artikrik/prompt-site-builder/settings/actions/runners/new"
echo ""
echo "3. DNS: Ensure these point to $(hostname -I | awk '{print $1}'):"
echo "     sitenow.pp.ua   → A record"
echo "     api.sitenow.pp.ua → A record"
echo "     *.sitenow.pp.ua   → A record (wildcard)"
echo ""
echo "4. Start first deploy:"
echo "     Push to main branch or trigger manually from GitHub Actions"
echo ""
echo "============================================"
