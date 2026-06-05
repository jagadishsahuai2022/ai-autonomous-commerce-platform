#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy-nginx.sh — Install DelegateCart Nginx config on Hostinger VPS
#
# This script:
#   1. Removes ALL old Nginx configs for delegatecart.com (including Certbot ones)
#   2. Installs the single-upstream config (everything → web container, port 3000)
#   3. Tests and reloads Nginx
#
# Usage:
#   cd /root/delegatecart
#   bash scripts/deploy-nginx.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="delegatecart.com"
REPO_CONFIG="infra/nginx/delegatecart.conf"
TARGET="/etc/nginx/sites-available/delegatecart.conf"
ENABLED="/etc/nginx/sites-enabled"

echo "═══════════════════════════════════════════════════════"
echo "  DelegateCart — Nginx Config Deployment"
echo "═══════════════════════════════════════════════════════"

# ── Step 1: Remove ALL configs in sites-enabled ──────────────────────────────
# This is the nuclear option — we want ONLY our config active.
# Old Certbot configs, default configs, anything else → gone.
echo ""
echo "► Removing ALL existing configs from ${ENABLED}/..."
for f in "${ENABLED}"/*; do
    [ -e "$f" ] || continue
    echo "  Removing: $(basename "$f")"
    rm -f "$f"
done

# Also clean up sites-available for the old configs (but keep ours)
echo "► Cleaning old configs from /etc/nginx/sites-available/..."
for f in /etc/nginx/sites-available/*; do
    [ -e "$f" ] || continue
    fname=$(basename "$f")
    # Remove any file that isn't our target filename
    if [ "$fname" != "delegatecart.conf" ]; then
        echo "  Removing: $fname"
        rm -f "$f"
    fi
done

# Also check /etc/nginx/conf.d/ for any delegatecart config
for f in /etc/nginx/conf.d/*; do
    [ -e "$f" ] || continue
    if grep -q "$DOMAIN" "$f" 2>/dev/null; then
        echo "  Removing conf.d/$(basename "$f") (contains $DOMAIN)"
        rm -f "$f"
    fi
done

# ── Step 2: Install our config ───────────────────────────────────────────────
echo ""
echo "► Installing new config from ${REPO_CONFIG}..."
if [ ! -f "$REPO_CONFIG" ]; then
    echo "ERROR: $REPO_CONFIG not found. Run this from the repo root (/root/delegatecart)."
    exit 1
fi
cp "$REPO_CONFIG" "$TARGET"

# The config already has delegatecart.com hardcoded (sed was done in the repo)
# But just in case it still has the placeholder:
if grep -q "DOMAIN_PLACEHOLDER" "$TARGET"; then
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "$TARGET"
    echo "  Replaced DOMAIN_PLACEHOLDER with ${DOMAIN}"
fi

# ── Step 3: Enable ───────────────────────────────────────────────────────────
echo "► Enabling config..."
ln -sf "$TARGET" "${ENABLED}/delegatecart.conf"

# ── Step 4: Verify there's only ONE config in sites-enabled ──────────────────
echo ""
echo "► Active configs in ${ENABLED}/:"
ls -la "${ENABLED}/"
ENABLED_COUNT=$(ls -1 "${ENABLED}/" 2>/dev/null | wc -l)
if [ "$ENABLED_COUNT" -ne 1 ]; then
    echo "WARNING: Expected exactly 1 config, found ${ENABLED_COUNT}"
fi

# ── Step 5: Test and reload ──────────────────────────────────────────────────
echo ""
echo "► Testing Nginx configuration..."
if nginx -t 2>&1; then
    echo ""
    echo "► Reloading Nginx..."
    systemctl reload nginx
    echo ""
    echo "✅ Nginx reloaded successfully!"
    echo ""
    echo "► Verifying — no conflicting server name warnings:"
    nginx -t 2>&1 | grep -i "conflict" && echo "⚠️  CONFLICT FOUND — check above" || echo "  No conflicts — all clear!"
else
    echo ""
    echo "❌ Nginx config test FAILED. Check the output above."
    echo "   The old config is still gone. Fix the error and run: nginx -t && systemctl reload nginx"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DONE — All traffic now goes to web container (port 3000)"
echo ""
echo "  Test it:"
echo "    curl -sI https://${DOMAIN}/api/auth/session | head -5"
echo "    curl -sI https://${DOMAIN}/api/observability | head -5"
echo "═══════════════════════════════════════════════════════"
