#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# run-migrations.sh — DelegateCart Standardized DB Migration Runner
# ═════════════════════════════════════════════════════════════════════════════
#
# Applies all pending versioned SQL migrations from db/migrations/ in order.
# Tracks every applied migration in _migration_log so re-runs are idempotent.
# Archives each successful run's files to db/archive/DelegateCart_DB_<TS>/.
#
# File naming convention:
#   V{VERSION}__{YYYYMMDD_HHMMSS}__{kebab-description}.sql
#   Examples:
#     V0067__20260421_100500__category-subcategory-migration.sql
#     V0068__20260421_100800__home-appliances-seed.sql
#
# To create a new migration (replace NNNN with next version number):
#   NNNN=$(printf "%04d" 70)
#   TS=$(date +"%Y%m%d_%H%M%S")
#   touch "db/migrations/V${NNNN}__${TS}__your-description.sql"
#
# Usage:
#   bash scripts/run-migrations.sh
#   bash scripts/run-migrations.sh dc-latest-postgres admin delegatecart
#
# Arguments (all optional, positional):
#   $1  Docker container name   (default: dc-latest-postgres)
#   $2  PostgreSQL user         (default: admin)
#   $3  PostgreSQL database     (default: delegatecart)
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

CONTAINER="${1:-dc-latest-postgres}"
DB_USER="${2:-admin}"
DB_NAME="${3:-delegatecart}"

# Resolve paths relative to repo root (this script lives in scripts/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/db/migrations"
ARCHIVE_BASE_DIR="${REPO_ROOT}/db/archive"

# ── Helpers ───────────────────────────────────────────────────────────────────

psql_run() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null
}

psql_file() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    --set ON_ERROR_STOP=0 \
    -v VERBOSITY=terse \
    < "$1"
}

# ── Verify container is running ───────────────────────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '${CONTAINER}' is not running."
  echo "   Start: docker compose -f docker-compose.latest.yml up -d"
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

RUN_TS=$(date +"%Y%m%d_%H%M%S")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   DelegateCart DB Migration Runner                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Container  : ${CONTAINER}"
echo "║  Database   : ${DB_NAME}"
echo "║  Run ID     : DelegateCart_DB_${RUN_TS}"
echo "║  Timestamp  : $(date -u)"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Bootstrap migration tracking table (idempotent) ───────────────────────────

echo "🔧 Ensuring _migration_log table exists..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  --set ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS "_migration_log" (
  id             SERIAL        PRIMARY KEY,
  migration_name TEXT          NOT NULL UNIQUE,
  applied_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  run_id         TEXT,
  checksum       TEXT
);
-- Add run_id + checksum columns if upgrading from old schema (idempotent)
ALTER TABLE "_migration_log" ADD COLUMN IF NOT EXISTS run_id    TEXT;
ALTER TABLE "_migration_log" ADD COLUMN IF NOT EXISTS checksum  TEXT;
SQL

# ── Legacy backfill: map old r*.sql names → new versioned names ───────────────
# For VPS instances that already have the old names applied, this prevents
# re-running migrations by marking the new name as applied when the old name was.

echo "🔄 Backfilling legacy migration names..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  --set ON_ERROR_STOP=0 <<'SQL'
-- Old script name → new versioned filename mapping
DO $$
DECLARE
  pairs TEXT[][] := ARRAY[
    ARRAY['r50-migrations.sql',                  'V0050__20260421_100000__initial-schema-baseline.sql'],
    ARRAY['r53-wishlist-scoring-migration.sql',  'V0053__20260421_100100__wishlist-scoring-migration.sql'],
    ARRAY['r57-db-imageurl-normalization.sql',   'V0057__20260421_100200__imageurl-normalization.sql'],
    ARRAY['r59-scoring-engine-revamp.sql',       'V0059__20260421_100300__scoring-engine-revamp.sql'],
    ARRAY['r66-generic-name-migration.sql',      'V0066__20260421_100400__generic-name-migration.sql'],
    ARRAY['r67-category-subcategory-migration.sql', 'V0067__20260421_100500__category-subcategory-migration.sql'],
    ARRAY['r67-many-to-many-category-map.sql',   'V0067B__20260421_100600__many-to-many-category-map.sql'],
    ARRAY['r67-product-tags-approved-migration.sql', 'V0067C__20260421_100700__product-tags-approved-migration.sql'],
    ARRAY['r68-home-appliances-seed.sql',        'V0068__20260421_100800__home-appliances-seed.sql'],
    ARRAY['r69-search-weights-config.sql',       'V0069__20260421_100900__search-weights-config.sql'],
    ARRAY['r69b-search-weights-9params.sql',     'V0069B__20260421_101000__search-weights-9params.sql'],
    ARRAY['r69c-search-weights-11params.sql',    'V0069C__20260421_101100__search-weights-11params.sql']
  ];
  old_name TEXT;
  new_name TEXT;
  old_applied_at TIMESTAMPTZ;
BEGIN
  FOR i IN 1..array_length(pairs, 1) LOOP
    old_name := pairs[i][1];
    new_name := pairs[i][2];
    -- If old name was applied and new name is not yet tracked, backfill it
    SELECT applied_at INTO old_applied_at
    FROM "_migration_log" WHERE migration_name = old_name;
    IF FOUND THEN
      INSERT INTO "_migration_log" (migration_name, applied_at, run_id)
      VALUES (new_name, old_applied_at, 'legacy-backfill')
      ON CONFLICT (migration_name) DO NOTHING;
    END IF;
  END LOOP;
END $$;
SQL

echo "   ✅ Legacy backfill complete"
echo ""

# ── Apply each V*.sql file in lexicographic sort order ───────────────────────

APPLIED=0
SKIPPED=0
FAILED=0
APPLIED_FILES=()

echo "📋 Scanning db/migrations/V*.sql files..."
echo ""

mapfile -t SQL_FILES < <(ls "${MIGRATIONS_DIR}"/V*.sql 2>/dev/null | sort)

if [ "${#SQL_FILES[@]}" -eq 0 ]; then
  echo "   ℹ️  No migration files found in ${MIGRATIONS_DIR}"
  echo ""
  echo "✅ Nothing to migrate."
  exit 0
fi

for sql_file in "${SQL_FILES[@]}"; do
  name=$(basename "$sql_file")

  already=$(psql_run "SELECT COUNT(*) FROM _migration_log WHERE migration_name='${name}'" \
            | tr -d '[:space:]')

  if [ "${already:-0}" -eq 1 ]; then
    echo "  ✓  ${name}"
    echo "        → already applied (skipping)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  ⚡ ${name}"
  echo "        → applying..."

  if psql_file "$sql_file" > /dev/null 2>&1; then
    # Compute simple checksum for audit
    CKSUM=$(md5sum "$sql_file" 2>/dev/null | awk '{print $1}' || echo "n/a")

    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
      "INSERT INTO _migration_log (migration_name, run_id, checksum)
       VALUES ('${name}', 'DelegateCart_DB_${RUN_TS}', '${CKSUM}')
       ON CONFLICT (migration_name) DO NOTHING;" > /dev/null 2>&1

    echo "        → ✅ applied (checksum: ${CKSUM:0:8}...)"
    APPLIED=$((APPLIED + 1))
    APPLIED_FILES+=("$sql_file")
  else
    echo "        → ❌ FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Migration Summary                                          │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│  ✅ Applied  : %-45s│\n" "${APPLIED}"
printf "│  ⏭  Skipped  : %-45s│\n" "${SKIPPED}"
printf "│  ❌ Failed   : %-45s│\n" "${FAILED}"
echo "└─────────────────────────────────────────────────────────────┘"

# ── Archive applied migrations ─────────────────────────────────────────────────
# Creates db/archive/DelegateCart_DB_{TIMESTAMP}/ and copies files applied
# in this run. Skipped/already-applied files are NOT copied (they were
# archived in a previous run's folder).

if [ "${APPLIED}" -gt 0 ]; then
  ARCHIVE_DIR="${ARCHIVE_BASE_DIR}/DelegateCart_DB_${RUN_TS}"
  mkdir -p "$ARCHIVE_DIR"

  echo ""
  echo "📦 Archiving ${APPLIED} applied migration(s)..."
  echo "   → ${ARCHIVE_DIR}/"
  echo ""

  for f in "${APPLIED_FILES[@]}"; do
    fname=$(basename "$f")
    cp "$f" "${ARCHIVE_DIR}/${fname}"
    echo "   ✓  ${fname}"
  done

  # Write a run manifest for full audit traceability
  MANIFEST="${ARCHIVE_DIR}/MANIFEST.txt"
  {
    echo "DelegateCart DB Migration Archive"
    echo "Run ID    : DelegateCart_DB_${RUN_TS}"
    echo "Timestamp : $(date -u)"
    echo "Container : ${CONTAINER}"
    echo "Database  : ${DB_NAME}"
    echo "Applied   : ${APPLIED}"
    echo "Skipped   : ${SKIPPED}"
    echo "Failed    : ${FAILED}"
    echo ""
    echo "Files applied in this run:"
    for f in "${APPLIED_FILES[@]}"; do
      CKSUM=$(md5sum "$f" 2>/dev/null | awk '{print $1}' || echo "n/a")
      echo "  [${CKSUM}]  $(basename "$f")"
    done
  } > "$MANIFEST"

  echo ""
  echo "   📄 MANIFEST.txt written"
  echo "   ✅ Archive complete: DelegateCart_DB_${RUN_TS}/"
fi

echo ""

if [ "${FAILED}" -gt 0 ]; then
  echo "❌ ${FAILED} migration(s) FAILED — review the output above"
  exit 1
fi

echo "✅ All DB migrations complete  (Run: DelegateCart_DB_${RUN_TS})"
echo ""
