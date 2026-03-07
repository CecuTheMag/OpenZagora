#!/bin/bash
# Check database state and diagnose issues

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-open_zagora}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

echo "🔍 Checking Open Zagora Database Status"
echo "========================================"
echo ""

echo "📋 Checking which budget tables exist:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'budget%'
ORDER BY table_name;
"
echo ""

echo "📊 Checking data counts (if tables exist):"
for table in budget_income budget_expenses budget_indicators budget_loans budget_villages budget_forecasts; do
  count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM $table WHERE year = 2025;
  " 2>/dev/null || echo "0")
  echo "  $table: $count rows"
done
echo ""

echo "🔍 Checking budget_expenses columns (if table exists):"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'budget_expenses'
ORDER BY ordinal_position;
" 2>/dev/null || echo "  Table does not exist"
echo ""

echo "✅ Diagnostic complete!"
