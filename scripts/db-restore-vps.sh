#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-restore-vps.sh — Restore the full database on the VPS
#
# Run this DIRECTLY ON THE VPS (after uploading the dump file).
#
# What it does:
#   1. Verifies dc-latest-postgres container is running
#   2. (Optional) Takes a safety backup of the current database
#   3. Restores data/db-migration-dump.sql into delegatecart
#   4. Verifies key table row counts
#   5. Cleans up temp files
#
# Usage (on VPS):
#   # First: upload the dump from your local machine (run this locally):
#   scp -i ~/.ssh/deploy_key data/db-migration-dump.sql root@VPS_IP:/tmp/delegatecart-restore.sql
#
#   # Then SSH into VPS and run:
#   bash /root/delegatecart/scripts/db-restore-vps.sh /tmp/delegatecart-restore.sql
#   bash /root/delegatecart/scripts/db-restore-vps.sh /tmp/delegatecart-restore.sql --skip-backup
#
# Or if the dump is already in the repo on VPS:
#   bash scripts/db-restore-vps.sh data/db-migration-dump.sql
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CONTAINER="${CONTAINER:-dc-latest-postgres}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-delegatecart}"

DUMP_FILE="${1:-}"
SKIP_BACKUP="${2:-}"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " DelegateCart — Full Database Restore"
echo " Container : $CONTAINER"
echo " Database  : $DB_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Validate args ─────────────────────────────────────────────────────────────
if [[ -z "$DUMP_FILE" ]]; then
  echo "Usage: $0 <dump_file> [--skip-backup]"
  echo ""
  echo "  dump_file     Path to the SQL dump (e.g. /tmp/delegatecart-restore.sql)"
  echo "  --skip-backup Skip creating a VPS safety backup first"
  echo ""
  echo "Example:"
  echo "  scp -i ~/.ssh/deploy_key data/db-migration-dump.sql root@VPS_IP:/tmp/delegatecart-restore.sql"
  echo "  bash scripts/db-restore-vps.sh /tmp/delegatecart-restore.sql"
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "❌ Dump file not found: $DUMP_FILE"
  echo ""
  echo "Upload from local machine:"
  echo "  scp -i ~/.ssh/deploy_key data/db-migration-dump.sql root@\$(hostname -I | awk '{print \$1}'):/tmp/delegatecart-restore.sql"
  exit 1
fi

DUMP_SIZE="$(du -sh "$DUMP_FILE" | cut -f1)"
DUMP_LINES="$(wc -l < "$DUMP_FILE")"

echo " Dump file : $DUMP_FILE"
echo " Size      : $DUMP_SIZE ($DUMP_LINES lines)"
echo " Skip bkp  : ${SKIP_BACKUP:-no}"
echo ""

# ── Step 1: Verify container is running ──────────────────────────────────────
echo "🔍 Checking container status..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' is not running."
  echo ""
  echo "Start the stack:"
  echo "  cd /root/delegatecart"
  echo "  docker compose -f docker-compose.latest.yml up -d postgres"
  exit 1
fi
echo "✅ Container $CONTAINER is running"

# Wait for postgres to be ready
echo "⏳ Waiting for postgres to be ready..."
for i in $(seq 1 10); do
  docker exec "$CONTAINER" pg_isready -U "$DB_USER" -q 2>/dev/null && break
  echo "   Not ready yet ($i/10) — waiting 3s..."
  sleep 3
done
echo "✅ Postgres is ready"
echo ""

# ── Step 2: Countdown (safety check) ─────────────────────────────────────────
echo "⚠️  WARNING: This will OVERWRITE '$DB_NAME' on this server."
echo ""
echo "   All existing data will be replaced with the dump content."
echo "   Press Ctrl+C within 10 seconds to cancel..."
echo ""
for i in 10 9 8 7 6 5 4 3 2 1; do
  printf "\r   Continuing in %s seconds...  " "$i"
  sleep 1
done
echo ""
echo ""

# ── Step 3: Safety backup ─────────────────────────────────────────────────────
if [[ "$SKIP_BACKUP" != "--skip-backup" ]]; then
  BACKUP_FILE="/tmp/vps-backup-before-restore-$(date +%Y%m%d_%H%M%S).sql"
  echo "📦 Creating safety backup of current database..."
  docker exec -t "$CONTAINER" pg_dump \
    -U "$DB_USER" \
    --clean --if-exists \
    --no-owner --no-acl \
    "$DB_NAME" > "$BACKUP_FILE"

  BACKUP_SIZE="$(du -sh "$BACKUP_FILE" | cut -f1)"
  echo "✅ Backup saved: $BACKUP_FILE ($BACKUP_SIZE)"
  echo "   Remove when no longer needed: rm $BACKUP_FILE"
  echo ""
else
  echo "⚠️  Safety backup SKIPPED (--skip-backup flag set)"
  echo ""
fi

# ── Step 4: Restore ───────────────────────────────────────────────────────────
echo "⏳ Restoring '$DB_NAME' from $DUMP_FILE ($DUMP_SIZE)..."
echo "   This may take several minutes for large datasets..."
echo ""

START_TIME="$(date +%s)"

docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" \
  --single-transaction \
  --set ON_ERROR_STOP=on \
  < "$DUMP_FILE"

END_TIME="$(date +%s)"
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "✅ Restore complete in ${ELAPSED}s"
echo ""

# ── Step 5: Verify key table counts ──────────────────────────────────────────
echo "🔍 Verifying restored data..."
echo ""
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  SELECT
    'Product'              AS table_name, COUNT(*) AS rows FROM \"Product\"
  UNION ALL SELECT
    'ProductTagMap',                       COUNT(*) FROM \"ProductTagMap\"
  UNION ALL SELECT
    'ProductCategoryMap',                  COUNT(*) FROM \"ProductCategoryMap\"
  UNION ALL SELECT
    'ProductSubCategoryMap',               COUNT(*) FROM \"ProductSubCategoryMap\"
  UNION ALL SELECT
    'ProductTag',                          COUNT(*) FROM \"ProductTag\"
  UNION ALL SELECT
    'ProductCategory',                     COUNT(*) FROM \"ProductCategory\"
  UNION ALL SELECT
    'ProductSubCategory',                  COUNT(*) FROM \"ProductSubCategory\"
  UNION ALL SELECT
    'SearchWeightConfig',                  COUNT(*) FROM \"SearchWeightConfig\"
  UNION ALL SELECT
    'SearchPassThreshold',                 COUNT(*) FROM \"SearchPassThreshold\"
  UNION ALL SELECT
    'User',                                COUNT(*) FROM \"User\"
  ORDER BY rows DESC;
"

echo ""
echo "🔍 Verifying Smart Intent Engine weights..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  SELECT
    \"parameterName\",
    weight,
    \"isActive\"
  FROM \"SearchWeightConfig\"
  WHERE \"isActive\" = true
  ORDER BY \"sortOrder\";
"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  SELECT
    COUNT(*) AS active_params,
    SUM(\"currentWeight\") AS total_weight
  FROM \"SearchWeightConfig\"
  WHERE \"isActive\" = true;
"

# ── Step 6: Cleanup ───────────────────────────────────────────────────────────
echo ""
echo "🧹 Cleaning up temp dump file..."
rm -f "$DUMP_FILE"
echo "✅ Temp file removed: $DUMP_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ DATABASE RESTORE COMPLETE"
echo ""
echo " Database : $DB_NAME"
echo " Duration : ${ELAPSED}s"
if [[ "$SKIP_BACKUP" != "--skip-backup" ]]; then
  echo " Backup   : $BACKUP_FILE"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
