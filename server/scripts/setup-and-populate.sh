#!/bin/bash
# Setup database schema and populate with parsed data

set -e

echo "🚀 Setting up Open Zagora Budget Database"
echo ""

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-open_zagora}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

echo "📊 Step 1: Applying budget schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f ../db/budget_schema.sql
echo "✅ Schema applied"
echo ""

echo "📊 Step 2: Running parsers..."
echo ""

echo "  💰 Parsing income data..."
node ultimate-budget-parser.js
echo ""

echo "  💸 Parsing expenses..."
node expense-parser.js
echo ""

echo "  🏘️  Parsing village budgets..."
node village-parser.js
echo ""

echo "  💳 Parsing loans..."
node loan-parser-fixed.js
echo ""

echo "  📈 Parsing forecasts..."
node forecast-parser.js
echo ""

echo "✅ All parsers completed!"
echo ""

echo "📊 Database Summary:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
  'Income Items' as table_name, 
  COUNT(*) as count, 
  TO_CHAR(SUM(amount), 'FM999,999,999') || ' лв' as total
FROM budget_income WHERE year = 2025
UNION ALL
SELECT 
  'Expense Items', 
  COUNT(*), 
  TO_CHAR(SUM(amount), 'FM999,999,999') || ' лв'
FROM budget_expenses WHERE year = 2025
UNION ALL
SELECT 
  'Indicators', 
  COUNT(*), 
  TO_CHAR(SUM(amount_approved), 'FM999,999,999') || ' лв'
FROM budget_indicators WHERE year = 2025
UNION ALL
SELECT 
  'Loans', 
  COUNT(*), 
  TO_CHAR(SUM(original_amount), 'FM999,999,999') || ' лв'
FROM budget_loans WHERE year = 2025
UNION ALL
SELECT 
  'Villages', 
  COUNT(*), 
  TO_CHAR(SUM(total_amount), 'FM999,999,999') || ' лв'
FROM budget_villages WHERE year = 2025
UNION ALL
SELECT 
  'Forecasts', 
  COUNT(*), 
  TO_CHAR(SUM(amount_2025), 'FM999,999,999') || ' лв'
FROM budget_forecasts;
"

echo ""
echo "🎉 Setup complete! Your database is ready."
