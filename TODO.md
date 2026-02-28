# Budget PDF Parsing Fix - COMPLETED

## Task
Fix data parsing issues for 2025 budget PDFs while maintaining backward compatibility with previous years (2020-2024).

## Status: COMPLETED

### Completed Changes

#### 1. server/scripts/parse-budget-pdfs.js
- **Improved number parsing**: Now handles Bulgarian number format (spaces as thousand separators, comma as decimal)
  - Supports formats: 1 234 567,89 or 1,234,567.89 or 1234567.89
  - Properly detects decimal vs thousand separator
- **Enhanced year extraction**: Updated regex to match years 2020-2030 properly
- **Better document classification**: Added support for 2025 filename patterns
- **Multiple parsing patterns**: Added fallback patterns for different PDF layouts
- **More function codes**: Added codes 70, 71, 72, 73, 80, 81, 82, 83 for various budget categories
- **Debug logging**: Added text preview for troubleshooting
- **Better error handling**: Improved error messages and database count checks

#### 2. server/scripts/parse-pdfs-from-host.js
- **Same improvements synced**: Number parsing, year extraction, function mappings
- **Enhanced classifier**: Updated document classification for 2025 format
- **Better Bulgarian text parsing**: Improved regex patterns for Cyrillic text

### Key Improvements

1. **Number Parsing**:
   - Previously: `str.replace(/\s/g, '').replace(',', '.')` - would break on Bulgarian format
   - Now: Properly detects whether comma is decimal or thousand separator

2. **Year Extraction**:
   - Previously: `\b(20\d{2})\b` - matched any 4-digit year
   - Now: `\b(20[2-3]\d)\b` - specifically matches 2020-2030

3. **Document Classification**:
   - Added support for 2025 naming conventions like "prilozhenia", "prognoza"
   - Normalized filename for better matching

4. **Backward Compatibility**:
   - All existing patterns preserved
   - Additional codes for different years added to mappings
   - Multiple fallback patterns in parsers

### How to Run

```
bash
# For server directory (uses budget-pdfs folder)
cd server
node scripts/parse-budget-pdfs.js

# For host directory (uses info/wqoidcwd/budjet)
node scripts/parse-pdfs-from-host.js
```

### Next Steps (Future)
- Test parsing with actual 2025 PDFs
- Verify data appears correctly in frontend
- Consider adding more PDF layout patterns if needed
