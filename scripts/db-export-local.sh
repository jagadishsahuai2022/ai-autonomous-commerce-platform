#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-export-local.sh — Dump the local delegatecart database to a SQL file
#
# Connects to the running dc-latest-postgres container (port 5433) and creates
# a portable SQL dump that can be restored to the VPS with db-import-vps.sh.
#
# Usage:
#   bash scripts/db-export-local.sh
#   bash scripts/db-export-local.sh --schema-only   (DDL only, no data)
#
# Output: scripts/data/dump-YYYY-MM-DD_HHMMSS.sql
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${CONTAINER:-dc-latest-postgres}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-delegatecart}"
SCHEMA_ONLY="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/data"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

if [[ "$SCHEMA_ONLY" == "--schema-only" ]]; then
  DUMP_FILE="$OUT_DIR/schema-$TIMESTAMP.sql"
  PG_FLAGS="--schema-only"
  LABEL="schema-only"
else
  DUMP_FILE="$OUT_DIR/dump-$TIMESTAMP.sql"
  PG_FLAGS="--clean --if-exists"
  LABEL="full (schema + data)"
fi

mkdir -p "$OUT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " DB Export — local → $DUMP_FILE"
echo " Container : $CONTAINER"
echo " Database  : $DB_NAME"
echo " Type      : $LABEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' is not running."
  echo "   Start the stack first: docker compose -f docker-compose.latest.yml up -d"
  exit 1
fi

echo "📦 Dumping '$DB_NAME'..."
# shellcheck disable=SC2086
docker exec -t "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  --no-owner --no-acl \
  $PG_FLAGS \
  "$DB_NAME" > "$DUMP_FILE"

SIZE="$(du -sh "$DUMP_FILE" | cut -f1)"
echo ""
echo "✅ Dump saved:"
echo "   File : $DUMP_FILE"
echo "   Size : $SIZE"

# Always keep data/db-migration-dump.sql up to date (used by CI pipeline)
if [[ "$SCHEMA_ONLY" != "--schema-only" ]]; then
  REPO_ROOT="$(dirname "$SCRIPT_DIR")"
  PIPELINE_DUMP="$REPO_ROOT/data/db-migration-dump.sql"
  cp "$DUMP_FILE" "$PIPELINE_DUMP"
  echo "   Also : $PIPELINE_DUMP (pipeline deploy file updated)"
fi

echo ""
echo "To import to VPS manually:"
echo "   bash scripts/db-import-vps.sh \"$DUMP_FILE\""
echo ""
echo "To deploy via pipeline: push to main → Actions → 'DB — Full Restore from Repo Dump'"
