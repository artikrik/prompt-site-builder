#!/bin/bash
# prompt-site-builder — Ubuntu Server Setup Script
# Run: scp to server, then chmod +x server-setup.sh && sudo ./server-setup.sh
set -euo pipefail

GITHUB_REPO="artikrik/prompt-site-builder"
RUNNER_VERSION="2.321.0"
RUNNER_DIR="/opt/actions-runner"
APP_DIR="/opt/prompt-site-builder"

echo "============================================"
echo "  prompt-site-builder Server Setup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ── 1. System packages ──────────────────────────────────────────
echo ""
echo "[1/7] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

echo ""
echo "[1/7] Installing system dependencies..."
apt-get install -y -qq curl wget git tar gzip openssh-client

# ── 2. Node.js 20 ───────────────────────────────────────────────
echo ""
echo "[2/7] Installing Node.js 20..."
if ! node --version 2>/dev/null | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "   Node: $(node --version)"
echo "   npm:  $(npm --version)"

# ── 3. Hugo Extended ────────────────────────────────────────────
echo ""
echo "[3/7] Installing Hugo Extended..."
HUGO_VER="0.145.0"
if ! command -v hugo &>/dev/null; then
    curl -fsSL "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VER}/hugo_extended_${HUGO_VER}_linux-amd64.deb" -o /tmp/hugo.deb
    dpkg -i /tmp/hugo.deb
    rm -f /tmp/hugo.deb
fi
echo "   Hugo: $(hugo version)"

# ── 4. Docker (verify) ──────────────────────────────────────────
echo ""
echo "[4/7] Verifying Docker..."
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker not found. Install: https://docs.docker.com/engine/install/ubuntu/"
    exit 1
fi
echo "   Docker:         $(docker --version)"
echo "   Docker Compose: $(docker compose version)"

# Add user to docker group if needed
if [ -n "${SUDO_USER:-}" ] && ! groups "$SUDO_USER" 2>/dev/null | grep -q docker; then
    usermod -aG docker "$SUDO_USER"
    echo "   Added $SUDO_USER to docker group (re-login required)"
fi

# ── 5. App Directory ────────────────────────────────────────────
echo ""
echo "[5/7] Creating application directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/var/www/client-sites"
if [ -n "${SUDO_USER:-}" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" "$APP_DIR"
fi

# ── 6. GitHub Actions Runner ────────────────────────────────────
echo ""
echo "[6/7] Setting up GitHub Actions Runner..."
if [ -d "$RUNNER_DIR" ]; then
    echo "   Runner already exists. Skipping download."
else
    mkdir -p "$RUNNER_DIR"
    curl -fsSL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o /tmp/runner.tar.gz
    tar xzf /tmp/runner.tar.gz -C "$RUNNER_DIR"
    rm -f /tmp/runner.tar.gz
    if [ -n "${SUDO_USER:-}" ]; then
        chown -R "$SUDO_USER:$SUDO_USER" "$RUNNER_DIR"
    fi
    echo "   Runner downloaded to $RUNNER_DIR"
fi

echo ""
echo "   === RUNNER CONFIGURATION ==="
echo "   Run these commands as your user (not root):"
echo ""
echo "   cd $RUNNER_DIR"
echo "   ./config.sh \\"
echo "     --url https://github.com/${GITHUB_REPO} \\"
echo "     --token <RUNNER_TOKEN> \\"
echo "     --name ubuntu-server \\"
echo "     --labels self-hosted,production \\"
echo "     --unattended \\"
echo "     --replace"
echo "   sudo ./svc.sh install"
echo "   sudo ./svc.sh start"
echo ""
echo "   Generate token: gh api repos/${GITHUB_REPO}/actions/runners/registration-token --method POST --jq '.token'"

# ── 7. .env placeholder ─────────────────────────────────────────
echo ""
echo "[7/7] Creating .env placeholder..."
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" << 'ENVEOF'
# prompt-site-builder — Production Environment Variables
# CHANGE THESE VALUES before first deploy!

POSTGRES_DB=promptsite
POSTGRES_USER=promptsite
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

REDIS_PORT=6379

JWT_SECRET=CHANGE_ME_64_CHAR_RANDOM_STRING

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
APIFY_TOKEN=...

BACKEND_PORT=3000
FRONTEND_PORT=5173
ENVEOF
    if [ -n "${SUDO_USER:-}" ]; then
        chown "$SUDO_USER:$SUDO_USER" "$APP_DIR/.env"
    fi
    echo "   .env placeholder created at $APP_DIR/.env"
    echo "   EDIT IT with real production values!"
fi

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Setup Complete"
echo "============================================"
echo "  Hugo:    $(hugo version 2>&1 | head -1)"
echo "  Node:    $(node --version)"
echo "  Docker:  $(docker --version)"
echo "  App dir: $APP_DIR"
echo "  Runner:  $RUNNER_DIR"
echo ""
echo "  NEXT STEPS:"
echo "  1. Edit $APP_DIR/.env with real values"
echo "  2. Configure runner: cd $RUNNER_DIR && ./config.sh ..."
echo "  3. Push to main -> auto-deploy triggers"
echo "============================================"
