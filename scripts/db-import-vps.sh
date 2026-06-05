#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-import-vps.sh — Transfer a local SQL dump to the VPS and restore it
#
# Prerequisites:
#   1. SSH key configured (set SSH_KEY_PATH or use the default ~/.ssh/deploy_key)
#   2. SERVER_IP and SERVER_USER env vars set, or edit the defaults below
#   3. VPS must have the dc-latest-postgres container running
#
# Usage:
#   export SERVER_IP=123.456.789.0
#   export SERVER_USER=root
#   bash scripts/db-import-vps.sh scripts/data/dump-2026-04-18_120000.sql
#   bash scripts/db-import-vps.sh scripts/data/dump-2026-04-18_120000.sql --skip-backup
#
# What this script does:
#   1. Verifies dump file exists
#   2. (Optional) Creates a backup of the current VPS DB first
#   3. Uploads the dump via SCP
#   4. Restores it inside the dc-latest-postgres container on VPS
#   5. Cleans up the temp file on VPS
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config (override via env vars) ───────────────────────────────────────────
SERVER_IP="${SERVER_IP:-}"
SERVER_USER="${SERVER_USER:-root}"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/deploy_key}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/deploy/app}"
REMOTE_TMP="/tmp/delegatecart-import.sql"

CONTAINER="dc-latest-postgres"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-delegatecart}"

# ── Args ──────────────────────────────────────────────────────────────────────
DUMP_FILE="${1:-}"
SKIP_BACKUP="${2:-}"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$DUMP_FILE" ]]; then
  echo "Usage: $0 <dump_file> [--skip-backup]"
  echo ""
  echo "  dump_file     Path to SQL dump (created by db-export-local.sh)"
  echo "  --skip-backup Skip creating a VPS backup before restoring"
  echo ""
  echo "Environment variables:"
  echo "  SERVER_IP      VPS IP address (required)"
  echo "  SERVER_USER    SSH user, default: root"
  echo "  SSH_KEY_PATH   Path to SSH private key, default: ~/.ssh/deploy_key"
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "❌ Dump file not found: $DUMP_FILE"
  exit 1
fi

if [[ -z "$SERVER_IP" ]]; then
  echo "❌ SERVER_IP is not set."
  echo "   Run: export SERVER_IP=your.vps.ip.address"
  exit 1
fi

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
SSH_CMD="ssh $SSH_OPTS $SERVER_USER@$SERVER_IP"
DUMP_SIZE="$(du -sh "$DUMP_FILE" | cut -f1)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " DB Import: local → VPS"
echo " VPS       : $SERVER_USER@$SERVER_IP"
echo " Dump file : $DUMP_FILE ($DUMP_SIZE)"
echo " Target DB : $DB_NAME (inside $CONTAINER)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  WARNING: This will OVERWRITE the '$DB_NAME' database on the VPS."
echo "   Press Ctrl+C within 10 seconds to cancel..."
echo ""
for i in 10 9 8 7 6 5 4 3 2 1; do printf "\r   Continuing in %s... " "$i"; sleep 1; done
echo ""
echo ""

# ── Step 1: Verify VPS container is running ───────────────────────────────────
echo "🔍 Checking VPS container status..."
if ! $SSH_CMD "docker ps --format '{{.Names}}' | grep -q '^${CONTAINER}$'"; then
  echo "❌ Container '$CONTAINER' is not running on VPS."
  echo "   SSH to VPS and run: docker compose -f docker-compose.latest.yml -f docker-compose.prod.yml up -d"
  exit 1
fi
echo "✅ Container running"

# ── Step 2: Backup current VPS DB ─────────────────────────────────────────────
if [[ "$SKIP_BACKUP" != "--skip-backup" ]]; then
  BACKUP_FILE="/tmp/vps-backup-$(date +%Y%m%d_%H%M%S).sql"
  echo ""
  echo "📦 Creating VPS backup → $BACKUP_FILE ..."
  $SSH_CMD "docker exec -t $CONTAINER pg_dump -U $DB_USER --clean --if-exists $DB_NAME > $BACKUP_FILE 2>&1"
  BACKUP_SIZE="$($SSH_CMD "du -sh $BACKUP_FILE | cut -f1" 2>/dev/null || echo "?")"
  echo "✅ VPS backup created: $BACKUP_FILE ($BACKUP_SIZE)"
  echo "   (stored on VPS — delete manually when no longer needed)"
else
  echo "⚠️  Skipping VPS backup (--skip-backup)"
fi

# ── Step 3: Upload dump ────────────────────────────────────────────────────────
echo ""
echo "⬆️  Uploading dump to VPS ($DUMP_SIZE)..."
scp $SSH_OPTS "$DUMP_FILE" "$SERVER_USER@$SERVER_IP:$REMOTE_TMP"
echo "✅ Upload complete"

# ── Step 4: Restore on VPS ────────────────────────────────────────────────────
echo ""
echo "🔄 Restoring database on VPS..."
$SSH_CMD "docker exec -i $CONTAINER psql -U $DB_USER $DB_NAME < $REMOTE_TMP" 2>&1 | tail -5
echo ""
echo "✅ Restore complete"

# ── Step 5: Cleanup ───────────────────────────────────────────────────────────
$SSH_CMD "rm -f $REMOTE_TMP"
echo "🧹 Temp file removed from VPS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ Import complete at $(date -u)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
