# Folder Upload - Complete Budget Year Import

## Overview

The folder upload feature processes an entire year's budget PDFs in one operation using the **working parsers** from `/server/scripts`.

## Supported Document Types

The system automatically detects and parses:

1. **Income** (`pr 1 prihodi 2025.pdf`) → `budget_income`
2. **Expenses** (`pr 2 razhod 2025.pdf`) → `budget_expenses` 
3. **Indicators** (`Pr 10 indik razcheti-2025-d122.pdf`) → `budget_indicators`
4. **Loans** (`Pr 42 ZAEM JESSICA-A1-5_2024-2025.pdf`) → `budget_loans`
5. **Villages** (`pr 54 kmetstva-plan-2025.pdf`) → `budget_villages`
6. **Forecasts** (`Pr 57 Prognoza 2026-2028.pdf`) → `budget_forecasts`

## How It Works

### 1. Detection
Files are classified by filename patterns:
- `prihod|pr 1` → Income
- `razhod|pr 2` → Expenses
- `indik|d\d{3}` → Indicators
- `zaem` → Loans
- `kmetstva|pr 54` → Villages
- `prognoza|pr 57` → Forecasts

### 2. Parsing
Each file is parsed using the **proven working parsers**:
- Income: Extracts codes like `31-11`, `13-00` with amounts
- Expenses: Maps departments (`д. 311`) to functions (`Образование`)
- Indicators: Extracts indicator codes (`d122`) with approved/executed amounts
- Loans: Extracts loan details (type, amount, interest rate)
- Villages: Extracts village budgets with state/local breakdown
- Forecasts: Extracts multi-year projections (2024-2028)

### 3. Storage
Data is inserted directly into the main database tables with proper relationships.

## Usage

### Via Admin Interface

1. Login at http://localhost:5174
2. Click "Full Year Folder" tab
3. Enter folder path: `/home/king/Documents/GitHub/OpenZagora/server/budget-pdfs`
4. Select year: `2025`
5. Click "Process Year Folder"

### Via API

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

# Upload folder
curl -X POST http://localhost:5001/api/admin/upload/folder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/home/king/Documents/GitHub/OpenZagora/server/budget-pdfs",
    "year": "2025"
  }'
```

## Response Format

```json
{
  "success": true,
  "message": "Folder processed successfully. 73 files processed, 621 items stored.",
  "data": {
    "folderPath": "/path/to/folder",
    "year": "2025",
    "totalFiles": 73,
    "processedSuccessfully": 73,
    "failedFiles": 0,
    "summary": {
      "income": 1,
      "expenses": 1,
      "indicators": 30,
      "loans": 7,
      "villages": 1,
      "forecasts": 1,
      "totalItems": 621,
      "totalAmount": 621106653
    },
    "results": [
      {
        "file": "pr 1 prihodi 2025.pdf",
        "type": "income",
        "items": 108,
        "amount": 621106653
      },
      {
        "file": "pr 2 razhod 2025.pdf",
        "type": "expense",
        "items": 73,
        "amount": 282957888
      }
    ],
    "errors": []
  }
}
```

## Features

✅ **Automatic Detection** - Classifies files by name pattern
✅ **Working Parsers** - Uses proven parsers from `/server/scripts`
✅ **Correct Categories** - Expenses mapped to proper functions
✅ **Batch Processing** - Processes all PDFs in order
✅ **Error Handling** - Continues on individual file errors
✅ **Audit Logging** - All actions logged to admin database
✅ **Progress Tracking** - Real-time feedback on processing

## Example Folder Structure

```
budget-pdfs/
├── pr 1 prihodi 2025.pdf          → Income (108 items)
├── pr 2 razhod 2025.pdf           → Expenses (73 items)
├── Pr 10 indik razcheti-2025-d122.pdf → Indicators
├── Pr 11 indik razcheti-2025-d332.pdf → Indicators
├── ...
├── Pr 42 ZAEM JESSICA-A1-5.pdf    → Loans
├── pr 54 kmetstva-plan-2025.pdf   → Villages (51 items)
└── Pr 57 Prognoza 2026-2028.pdf   → Forecasts (329 items)
```

## Database Impact

After processing a full year folder:
- `budget_income`: ~108 items, 621M лв
- `budget_expenses`: ~73 items, 283M лв (correct categories!)
- `budget_indicators`: ~116 items, 68M лв
- `budget_loans`: ~7 items, 49M лв
- `budget_villages`: ~51 items, 7.4M лв
- `budget_forecasts`: ~329 items

## Error Handling

- Individual file errors don't stop processing
- Failed files are reported in `errors` array
- Successful files are stored even if others fail
- All actions logged to audit trail

## Security

- Requires admin authentication
- All actions logged with user, IP, timestamp
- File paths validated to prevent directory traversal
- Only PDF files processed

## Performance

- Processes ~70 PDFs in ~30-60 seconds
- Parallel processing not implemented (sequential for reliability)
- Memory efficient (streams PDFs)

## Troubleshooting

**"No PDF files found"**
- Check folder path is correct
- Ensure folder contains .pdf files

**"Permission denied"**
- Check folder permissions
- Use absolute path

**"Some files failed"**
- Check `errors` array in response
- Individual file issues don't affect others
- Re-run for failed files only

## Next Steps

After upload:
1. Check frontend Budget page: http://localhost:5173/budget
2. Verify data in all tabs (Income, Expenses, etc.)
3. Check audit logs in admin interface
