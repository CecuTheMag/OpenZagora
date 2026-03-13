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
echo "🎉 Import complete!"
