#!/bin/sh
# Master script to populate all budget data in admin server
# Accepts a folder path as argument

set -e

# Default folder path (admin server's budget PDFs inside container)
DEFAULT_BUDGET_FOLDER="/app/budget-pdfs"

# Get the folder path from argument or use default
BUDGET_FOLDER=${1:-$DEFAULT_BUDGET_FOLDER}

echo "🚀 Open Zagora Budget Data Import (Admin Server)"
echo "================================================="
echo ""
echo "📁 Source folder: $BUDGET_FOLDER"
echo ""

cd "$(dirname "$0")"

# Check if source folder exists
if [ ! -d "$BUDGET_FOLDER" ]; then
    echo "❌ Error: Source folder does not exist: $BUDGET_FOLDER"
    exit 1
fi

# Create uploads directory if it doesn't exist
SCRIPT_DIR="$(dirname "$0")"
UPLOADS_DIR="$SCRIPT_DIR/../uploads/b"
mkdir -p "$UPLOADS_DIR"

# Clear existing PDFs in uploads folder
echo "🧹 Clearing existing PDFs in uploads folder..."
rm -f "$UPLOADS_DIR"/*.pdf 2>/dev/null || true

# Copy PDFs from source folder
echo "📂 Copying PDFs from source folder..."
PDF_COUNT=0
for pdf in "$BUDGET_FOLDER"/*.pdf; do
    if [ -f "$pdf" ]; then
        cp "$pdf" "$UPLOADS_DIR/"
        PDF_COUNT=$((PDF_COUNT + 1))
        echo "   ✅ Copied: $(basename "$pdf")"
    fi
done

if [ $PDF_COUNT -eq 0 ]; then
    echo "❌ Error: No PDF files found in $BUDGET_FOLDER"
    exit 1
fi

echo ""
echo "📊 Copied $PDF_COUNT PDF files"
echo ""

# Set environment variables for database connection
export MAIN_DB_HOST="db"
export MAIN_DB_PORT="5432"
export MAIN_DB_NAME="open_zagora"
export MAIN_DB_USER="postgres"
export MAIN_DB_PASSWORD="postgres"

# Run individual parsers (matching the main server's approach)
echo "📊 Step 1: Income & Indicators..."
node ultimate-budget-parser.js
echo ""

echo "💸 Step 2: Expenses..."
node expense-parser.js
echo ""

echo "🏘️  Step 3: Villages..."
node village-parser.js
echo ""

echo "💳 Step 4: Loans..."
node loan-parser.js
echo ""

echo "📈 Step 5: Forecasts..."
node forecast-parser.js
echo ""

echo "✅ All parsers completed!"
echo ""
echo "📊 Database Summary:"
echo "   (Import completed successfully)"
echo ""
echo "🎉 Import complete!"
