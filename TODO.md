# Budget Upload Fix TODO

## Plan Breakdown
1. [ ] Update admin-server/routes/upload.js: Fix exec to cd parsers/ && ./import-all-budget-data.sh with proper cwd/env
2. [ ] Update admin-server/routes/budget.js: Copy to uploads/ (not /b/), fix exec to parsers/ sh
3. [ ] Test ZIP upload via admin interface
4. [ ] Test folder import
5. [ ] Verify DB data matches manual docker exec run
6. [ ] Complete ✅

Ready for implementation step-by-step.

