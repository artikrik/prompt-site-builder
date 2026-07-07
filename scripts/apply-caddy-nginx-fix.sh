#!/bin/bash
# Fix: route *.sitenow.pp.ua to Caddy, fix Caddyfile labels
# Run: sudo bash /opt/prompt-site-builder/backups/apply-caddy-nginx-fix.sh
set -e

echo "=== Step 1: Backup current configs ==="
mkdir -p /opt/prompt-site-builder/backups/nginx-$(date +%Y%m%d-%H%M)
cp -a /etc/nginx/sites-enabled /opt/prompt-site-builder/backups/nginx-$(date +%Y%m%d-%H%M)/
cp /etc/nginx/nginx.conf /opt/prompt-site-builder/backups/nginx-$(date +%Y%m%d-%H%M)/
cp /opt/prompt-site-builder/docker/Caddyfile /opt/prompt-site-builder/backups/nginx-$(date +%Y%m%d-%H%M)/Caddyfile.bak
echo "Backup: /opt/prompt-site-builder/backups/nginx-$(date +%Y%m%d-%H%M)/"

echo ""
echo "=== Step 2: Install new Caddyfile ==="
cp /opt/prompt-site-builder/docker/Caddyfile.new /opt/prompt-site-builder/docker/Caddyfile
echo "Caddyfile updated with {labels.3} fix + HTTP handler"

echo ""
echo "=== Step 3: Install Nginx wildcard HTTP config ==="
cp /opt/prompt-site-builder/backups/sitenow-wildcard-http.conf /etc/nginx/sites-enabled/sitenow-wildcard
echo "Wildcard HTTP config installed"

echo ""
echo "=== Step 4: Update Nginx SSL ports 443 -> 8444 ==="
for f in /etc/nginx/sites-enabled/*; do
    if grep -q 'listen.*443.*ssl' "$f" 2>/dev/null; then
        echo "  Patching: $f"
        sed -i 's/listen \[::\]:443 ssl/listen [::]:8444 ssl/g' "$f"
        sed -i 's/listen 443 ssl/listen 8444 ssl/g' "$f"
    fi
done
echo "SSL ports updated"

echo ""
echo "=== Step 5: Add stream block to nginx.conf ==="
# Check if stream block already exists
if grep -q 'stream {' /etc/nginx/nginx.conf; then
    echo "  Stream block already exists, skipping..."
else
    # Append stream block before the last closing brace or at end
    cat /opt/prompt-site-builder/backups/nginx-stream-sni.conf >> /etc/nginx/nginx.conf
    echo "  Stream block added"
fi

echo ""
echo "=== Step 6: Test Nginx config ==="
nginx -t && echo "  NGINX CONFIG OK" || { echo "  NGINX CONFIG ERROR - ROLLBACK!"; exit 1; }

echo ""
echo "=== Step 7: Reload Nginx ==="
systemctl reload nginx
echo "Nginx reloaded"

echo ""
echo "=== Step 8: Restart Caddy ==="
cd /opt/prompt-site-builder
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart caddy
echo "Caddy restarted"

echo ""
echo "=== DONE! ==="
echo "Verify: curl -s -H 'Host: test.sitenow.pp.ua' http://127.0.0.1:8080/ | head -5"
echo "Verify: curl -sk https://sitenow.pp.ua/ | head -5"
