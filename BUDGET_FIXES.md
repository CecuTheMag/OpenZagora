# Budget Data Issues - Diagnosis & Fixes

## Issues Found

### 1. ✅ FIXED: Database Schema Not Applied
**Problem:** Parsers were trying to insert into tables that didn't exist in the main database.
**Solution:** Applied `budget_schema.sql` which creates all necessary tables:
- `budget_income` - Income data (108 items, 621M лв)
- `budget_expenses` - Expense data (73 items, 283M лв)  
- `budget_indicators` - Budget indicators (116 items)
- `budget_loans` - Municipal loans (7 loans, 44M лв)
- `budget_villages` - Village budgets (51 villages, 7.4M лв)
- `budget_forecasts` - Multi-year forecasts

### 2. ✅ FIXED: Parsers Not Running
**Problem:** Expense, village, loan, and forecast parsers hadn't been executed.
**Solution:** Ran all parsers successfully:
- `expense-parser.js` - ✅ 73 expenses imported
- `village-parser.js` - ✅ 51 villages imported
- `loan-parser-fixed.js` - ✅ 7 loans imported
- `forecast-parser.js` - ⚠️ No data (PDF parsing issue)

### 3. ⚠️ PARTIAL: Income Chart Labels Show "Category 1, 2, 3"
**Problem:** Frontend `getIncomeCategoryName()` function uses simplified 2-digit codes, but database has full codes like "31-11", "13-00", "27-00".
**Root Cause:** The income codes in the database are more specific than the frontend expects.
**Impact:** Charts show generic labels instead of descriptive names.

**Solution Options:**
A. Update frontend to handle full codes (e.g., "31" → "Transfers from State Budget")
B. Add a mapping table in the database
C. Enhance the parser to extract category from the first 2 digits

### 4. ⚠️ ISSUE: Expense Categories Incorrectly Mapped
**Problem:** The expense parser maps department names to categories using keyword matching, resulting in wrong assignments:
- "Детски градини" (Kindergartens) → "Отбрана и сигурност" (Defense & Security) ❌
- "Неспециализирани училища" (Schools) → "Отбрана и сигурност" (Defense & Security) ❌

**Root Cause:** The parser's category detection logic is flawed. It should use the function code from the PDF structure, not keyword matching.

**Solution:** Rewrite expense parser to:
1. Extract function codes from PDF (e.g., "Функция 04 - Образование")
2. Map departments to their parent function
3. Use official Bulgarian budget function codes

### 5. ✅ FIXED: Missing Database Column
**Problem:** `budget_loans` table was missing `term_months` column.
**Solution:** Added column to schema.

## Current Database Status

```
Category | Items | Total
---------|-------|-------------
Income   | 108   | 621,106,653 лв
Expenses | 73    | 282,957,888 лв
Villages | 51    | 7,391,508 лв
Loans    | 7     | 48,759,939 лв
```

## Frontend Display Issues

### Why Expenses Tab Shows Data But Charts Don't
The expenses ARE in the database and the API returns them correctly. However:

1. **Chart grouping issue**: The frontend groups by `function_code` (e.g., "д. 322"), but these are department codes, not function codes.
2. **Category names**: The `program_name` field has incorrect mappings due to parser logic.

### Why Income Chart Shows "Category 1, 2, 3"
The frontend's `getIncomeCategoryName()` function only handles 2-digit codes:
```javascript
'01': 'Tax Revenue',
'02': 'Non-Tax Revenue',
...
```

But the database has codes like:
- `31-11` (should map to '31' → 'Transfers from State Budget')
- `13-00` (should map to '13' → 'Property Taxes')
- `27-00` (should map to '27' → 'Municipal Fees')

## Recommended Fixes (Priority Order)

### HIGH PRIORITY
1. **Fix expense parser category mapping** - Use function codes from PDF structure
2. **Update frontend income chart** - Extract first 2 digits from codes for mapping

### MEDIUM PRIORITY  
3. **Add proper Bulgarian budget function names** - Use official classifications
4. **Fix forecast parser** - Currently returns 0 items

### LOW PRIORITY
5. **Add data validation** - Ensure amounts are reasonable
6. **Add error handling** - Better logging for parser failures

## Quick Fixes for Frontend

### Fix Income Chart Labels
In `BudgetPage.jsx`, update the `useMemo` for `incomeChartData`:

```javascript
const incomeChartData = useMemo(() => {
  const grouped = {}
  incomeData.forEach(item => {
    // Extract first 2 digits from codes like "31-11" → "31"
    const code = item.code?.split('-')[0] || '00'
    grouped[code] = (grouped[code] || 0) + parseFloat(item.amount || 0)
  })
  return Object.entries(grouped)
    .map(([code, value]) => ({ 
      name: getIncomeCategoryName(code), 
      value,
      code
    }))
    .sort((a, b) => b.value - a.value)
}, [incomeData])
```

### Fix Expense Categories
The expense data needs to be re-parsed with correct function mapping. The current data has wrong categories.

## Files Modified

1. ✅ `/server/db/budget_schema.sql` - Added `term_months` column
2. ✅ `/server/scripts/expense-parser.js` - Fixed DB connection, added program_name
3. ✅ `/server/scripts/ultimate-budget-parser.js` - Fixed DB connection
4. ✅ `/server/scripts/setup-and-populate.sh` - New setup script
5. ✅ `/server/scripts/check-db-status.sh` - New diagnostic script

## Next Steps

1. Run the frontend and verify income chart now shows proper labels
2. Fix expense parser to use correct function codes
3. Re-run expense parser to populate correct categories
4. Test all tabs in the Budget page
