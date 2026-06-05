#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run-pending-migrations.sh — Apply all pending scripts/r*.sql data migrations
#
# Tracks every applied migration in a `_migration_log` table so re-runs are
# safe — already-applied files are skipped without any side effects.
#
# Usage (local Docker):
#   bash scripts/run-pending-migrations.sh
#   bash scripts/run-pending-migrations.sh dc-latest-postgres admin delegatecart
#
# Usage (on VPS, called by CI deploy):
#   bash /root/delegatecart/scripts/run-pending-migrations.sh dc-latest-postgres admin delegatecart
#
# Arguments (all optional, positional):
#   $1  Docker container name  (default: dc-latest-postgres)
#   $2  PostgreSQL user        (default: admin)
#   $3  PostgreSQL database    (default: delegatecart)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${1:-dc-latest-postgres}"
DB_USER="${2:-admin}"
DB_NAME="${3:-delegatecart}"

# Directory containing r*.sql files (same dir as this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────

psql_run() {
  # Run a SQL string inside the container
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null
}

psql_file() {
  # Pipe a SQL file into psql inside the container
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    --set ON_ERROR_STOP=0 \
    -v VERBOSITY=terse \
    < "$1"
}

# ── Verify container is running ───────────────────────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '${CONTAINER}' is not running."
  echo "   Start the stack: docker compose -f docker-compose.latest.yml up -d"
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  SQL Data Migrations"
echo "  Container : ${CONTAINER}"
echo "  Database  : ${DB_NAME}"
echo "  $(date -u)"
echo "═══════════════════════════════════════════════════════"

# ── Bootstrap migration log table (idempotent) ────────────────────────────────

docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  --set ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS "_migration_log" (
  id             SERIAL        PRIMARY KEY,
  migration_name TEXT          NOT NULL UNIQUE,
  applied_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
SQL

# ── Apply each r*.sql file in sort order ─────────────────────────────────────

APPLIED=0
SKIPPED=0
FAILED=0

for sql_file in $(ls "${SCRIPT_DIR}"/r*.sql 2>/dev/null | sort); do
  name=$(basename "$sql_file")

  # Check if this migration was already recorded
  count=$(psql_run "SELECT COUNT(*) FROM _migration_log WHERE migration_name='${name}'" \
          | tr -d '[:space:]')

  if [ "${count:-0}" -eq 1 ]; then
    echo "  ✓  ${name}  (already applied — skipping)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  ⚡ Applying ${name} ..."

  # Apply migration — ON_ERROR_STOP=0 so individual SQL errors don't abort
  # the entire migration (most r*.sql files use IF NOT EXISTS / ON CONFLICT)
  if psql_file "$sql_file" > /dev/null; then
    # Record successful application
    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
      "INSERT INTO _migration_log (migration_name) VALUES ('${name}')
       ON CONFLICT (migration_name) DO NOTHING;" > /dev/null
    echo "  ✅ ${name}  applied"
    APPLIED=$((APPLIED + 1))
  else
    echo "  ❌ ${name}  FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "  ┌────────────────────────────────────┐"
echo "  │  Applied : ${APPLIED}                          "
echo "  │  Skipped : ${SKIPPED}                          "
echo "  │  Failed  : ${FAILED}                           "
echo "  └────────────────────────────────────┘"

if [ "${FAILED}" -gt 0 ]; then
  echo "❌ ${FAILED} migration(s) failed — review the output above"
  exit 1
fi

echo "✅ All SQL data migrations complete"
