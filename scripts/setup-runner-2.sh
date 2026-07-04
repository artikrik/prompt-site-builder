#!/bin/bash
# Setup second GitHub Actions runner for parallel CI jobs
# Run on server: ssh redage@192.168.31.22 'bash -s' < scripts/setup-runner-2.sh
set -e

RUNNER_DIR="/opt/actions-runner-2"
RUNNER_VERSION="2.335.1"
TOKEN="ADMGIOWN674BUP5LUPEIV33KJGRZA"
REPO="https://github.com/artikrik/prompt-site-builder"
RUNNER_NAME="ubuntu-server-2"

echo "=== Step 1: Create runner directory ==="
sudo mkdir -p "$RUNNER_DIR"
sudo chown -R redage:redage "$RUNNER_DIR"

echo "=== Step 2: Download runner package ==="
if [ ! -f /tmp/runner.tar.gz ]; then
    curl -sL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o /tmp/runner.tar.gz
fi

echo "=== Step 3: Extract runner ==="
cd "$RUNNER_DIR"
sudo tar xzf /tmp/runner.tar.gz
sudo chown -R redage:redage "$RUNNER_DIR"

echo "=== Step 4: Configure runner ==="
sudo -u redage ./config.sh --unattended \
    --url "$REPO" \
    --token "$TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "self-hosted,Linux,X64,runner-2" \
    --work "_work" \
    --replace

echo "=== Step 5: Install as service ==="
sudo ./svc.sh install redage
sudo ./svc.sh start

echo "=== Done! Runner '$RUNNER_NAME' is running ==="
sudo ./svc.sh status
