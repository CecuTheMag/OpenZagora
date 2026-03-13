-- Add unique constraints to prevent duplicate budget entries

-- Budget Income: unique on year, code, name, and amount
ALTER TABLE budget_income 
DROP CONSTRAINT IF EXISTS budget_income_unique;

ALTER TABLE budget_income 
ADD CONSTRAINT budget_income_unique 
UNIQUE (year, code, name, amount);

-- Budget Expenses: unique on year, function_code, function_name, and amount
ALTER TABLE budget_expenses 
DROP CONSTRAINT IF EXISTS budget_expenses_unique;

ALTER TABLE budget_expenses 
ADD CONSTRAINT budget_expenses_unique 
UNIQUE (year, function_code, function_name, amount);

-- Budget Indicators: unique on year, indicator_code, indicator_name, and amount_approved
ALTER TABLE budget_indicators 
DROP CONSTRAINT IF EXISTS budget_indicators_unique;

ALTER TABLE budget_indicators 
ADD CONSTRAINT budget_indicators_unique 
UNIQUE (year, indicator_code, indicator_name, amount_approved);

-- Budget Villages: unique on year, code, name, and total_amount
ALTER TABLE budget_villages 
DROP CONSTRAINT IF EXISTS budget_villages_unique;

ALTER TABLE budget_villages 
ADD CONSTRAINT budget_villages_unique 
UNIQUE (year, code, name, total_amount);

-- Budget Forecasts: unique on code, name, and amount_2025
ALTER TABLE budget_forecasts 
DROP CONSTRAINT IF EXISTS budget_forecasts_unique;

ALTER TABLE budget_forecasts 
ADD CONSTRAINT budget_forecasts_unique 
UNIQUE (code, name, amount_2025);

-- Budget Loans: unique on year, loan_type, and original_amount
ALTER TABLE budget_loans 
DROP CONSTRAINT IF EXISTS budget_loans_unique;

ALTER TABLE budget_loans 
ADD CONSTRAINT budget_loans_unique 
UNIQUE (year, loan_type, loan_code, original_amount);
