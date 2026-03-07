#!/bin/bash
# Master script to populate all budget data

set -e

echo "🚀 Open Zagora Budget Data Import"
echo "=================================="
echo ""

cd "$(dirname "$0")"

echo "📊 Step 1: Income & Indicators..."
node ultimate-budget-parser.js
echo ""

echo "💸 Step 2: Expenses..."
node expense-parser-final.js
echo ""

echo "🏘️  Step 3: Villages..."
node village-parser.js
echo ""

echo "💳 Step 4: Loans..."
node loan-parser-fixed.js
echo ""

echo "📈 Step 5: Forecasts..."
node forecast-parser-fixed.js
echo ""

echo "✅ All parsers completed!"
echo ""
echo "📊 Database Summary:"
docker exec open-zagora-db-dev psql -U postgres -d open_zagora -c "
SELECT 
  'Income' as type, 
  COUNT(*) as items, 
  TO_CHAR(SUM(amount), 'FM999,999,999') || ' лв' as total 
FROM budget_income WHERE year = 2025
UNION ALL
SELECT 'Expenses', COUNT(*), TO_CHAR(SUM(amount), 'FM999,999,999') || ' лв' 
FROM budget_expenses WHERE year = 2025
UNION ALL
SELECT 'Villages', COUNT(*), TO_CHAR(SUM(total_amount), 'FM999,999,999') || ' лв' 
FROM budget_villages WHERE year = 2025
UNION ALL
SELECT 'Loans', COUNT(*), TO_CHAR(SUM(original_amount), 'FM999,999,999') || ' лв' 
FROM budget_loans WHERE year = 2025
UNION ALL
SELECT 'Forecasts', COUNT(*), TO_CHAR(SUM(amount_2025), 'FM999,999,999') || ' лв' 
FROM budget_forecasts
UNION ALL
SELECT 'Indicators', COUNT(*), TO_CHAR(SUM(amount_approved), 'FM999,999,999') || ' лв' 
FROM budget_indicators WHERE year = 2025;
"

echo ""
echo "🎉 Import complete! Frontend ready at http://localhost:5173/budget"
