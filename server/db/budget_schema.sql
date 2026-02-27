-- Extended Budget Schema for Smart PDF Parsing
-- Adds structured tables for different budget document types

-- ==========================================
-- BUDGET DOCUMENTS METADATA
-- Stores info about all uploaded budget PDFs
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    year INTEGER NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'income', 'expense', 'indicator', 'loan', 'other'
    document_subtype VARCHAR(100), -- 'pr1', 'pr2', 'd122', 'd369', 'zaem', etc.
    category VARCHAR(255), -- Main category if applicable
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    file_size INTEGER,
    page_count INTEGER,
    raw_text TEXT, -- Full extracted text
    parsed_data JSONB, -- Structured extracted data
    status VARCHAR(50) DEFAULT 'pending' -- 'pending', 'parsed', 'error'
);

-- ==========================================
-- BUDGET INCOME (pr1 - Приходи)
-- Income/revenue data from budget documents
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_income (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES budget_documents(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    code VARCHAR(50), -- Income code (e.g., "01", "02", "03")
    name VARCHAR(500) NOT NULL, -- Income name/description
    amount DECIMAL(15, 2), -- Amount in BGN
    amount_previous_year DECIMAL(15, 2), -- Previous year for comparison
    amount_plan DECIMAL(15, 2), -- Planned amount
    notes TEXT,
    row_order INTEGER, -- To maintain document order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- BUDGET EXPENSES (pr2 - Разходи по дейности)
-- Expense data by activity/function
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES budget_documents(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    function_code VARCHAR(50), -- Function code (e.g., "01", "02")
    function_name VARCHAR(500), -- Function name
    program_code VARCHAR(50), -- Program code
    program_name VARCHAR(500), -- Program name
    amount DECIMAL(15, 2), -- Amount in BGN
    amount_personnel DECIMAL(15, 2), -- Personnel costs
    amount_goods_services DECIMAL(15, 2), -- Goods and services
    amount_subsidies DECIMAL(15, 2), -- Subsidies
    amount_capital DECIMAL(15, 2), -- Capital expenditures
    notes TEXT,
    row_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- BUDGET INDICATORS (pr9+ - Индикативни разчети)
-- Various budget indicators by department/code
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES budget_documents(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    indicator_code VARCHAR(50), -- e.g., "d122", "d332", "d369", "d532"
    indicator_name VARCHAR(500),
    department_code VARCHAR(50), -- Department/municipality code
    department_name VARCHAR(500),
    budget_chapter VARCHAR(50), -- Budget chapter
    amount_approved DECIMAL(15, 2), -- Approved amount
    amount_executed DECIMAL(15, 2), -- Executed amount
    amount_remaining DECIMAL(15, 2), -- Remaining amount
    percentage_executed DECIMAL(5, 2), -- Execution percentage
    notes TEXT,
    row_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- BUDGET LOANS (ZAEM - Заеми)
-- Loan and debt information
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES budget_documents(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    loan_type VARCHAR(100), -- Type of loan (e.g., "JESSICA", "FLAG", "FUG")
    loan_code VARCHAR(100), -- Loan identifier
    creditor VARCHAR(500), -- Creditor name
    original_amount DECIMAL(15, 2), -- Original loan amount
    remaining_amount DECIMAL(15, 2), -- Remaining to pay
    interest_rate DECIMAL(5, 2), -- Interest rate if available
    start_date DATE,
    end_date DATE,
    purpose TEXT, -- Purpose of the loan
    monthly_payment DECIMAL(15, 2), -- Monthly payment amount
    notes TEXT,
    row_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- BUDGET SUMMARY (Aggregated data by year)
-- Pre-calculated summaries for quick display
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL UNIQUE,
    total_income DECIMAL(15, 2),
    total_expenses DECIMAL(15, 2),
    total_loans DECIMAL(15, 2),
    deficit_surplus DECIMAL(15, 2),
    documents_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_budget_docs_year ON budget_documents(year);
CREATE INDEX IF NOT EXISTS idx_budget_docs_type ON budget_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_budget_income_year ON budget_income(year);
CREATE INDEX IF NOT EXISTS idx_budget_income_code ON budget_income(code);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_year ON budget_expenses(year);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_function ON budget_expenses(function_code);
CREATE INDEX IF NOT EXISTS idx_budget_indicators_year ON budget_indicators(year);
CREATE INDEX IF NOT EXISTS idx_budget_indicators_code ON budget_indicators(indicator_code);
CREATE INDEX IF NOT EXISTS idx_budget_loans_year ON budget_loans(year);
CREATE INDEX IF NOT EXISTS idx_budget_loans_type ON budget_loans(loan_type);

-- ==========================================
-- TRIGGER TO UPDATE SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION update_budget_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert summary for the year
    INSERT INTO budget_summary (year, total_income, last_updated)
    SELECT 
        year,
        SUM(amount),
        CURRENT_TIMESTAMP
    FROM budget_income
    WHERE year = COALESCE(NEW.year, OLD.year)
    GROUP BY year
    ON CONFLICT (year) 
    DO UPDATE SET 
        total_income = EXCLUDED.total_income,
        last_updated = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for income changes
DROP TRIGGER IF EXISTS trg_update_summary_income ON budget_income;
CREATE TRIGGER trg_update_summary_income
    AFTER INSERT OR UPDATE OR DELETE ON budget_income
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_summary();

-- Similar triggers for expenses and loans would be added here
