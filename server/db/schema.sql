-- Open Zagora Database Schema
-- PostgreSQL schema for municipal transparency dashboard

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table: Stores municipal projects with location data
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code VARCHAR(50), -- Unique project code (e.g., PRJ-2025-001)
    title VARCHAR(500) NOT NULL,
    description TEXT,
    detailed_description TEXT, -- Extended description
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled', 'on_hold')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Budget Information
    budget DECIMAL(15, 2),
    budget_spent DECIMAL(15, 2) DEFAULT 0,
    funding_source VARCHAR(255), -- EU funds, municipal budget, state budget, etc.
    budget_category VARCHAR(100), -- Infrastructure, Education, Healthcare, etc.
    
    -- Contractor Information
    contractor VARCHAR(255),
    contractor_contact TEXT,
    contract_number VARCHAR(100),
    contract_value DECIMAL(15, 2),
    
    -- Location Information
    address VARCHAR(500),
    lat DECIMAL(10, 8), -- Latitude for map
    lng DECIMAL(11, 8), -- Longitude for map
    municipality VARCHAR(100), -- Municipality/district
    settlement VARCHAR(100), -- Village/town name
    
    -- Timeline
    start_date DATE,
    end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    duration_days INTEGER,
    
    -- Project Type
    project_type VARCHAR(100), -- Construction, Renovation, Maintenance, etc.
    category VARCHAR(100), -- Public Works, Education, Health, etc.
    
    -- Additional Information
    raw_text TEXT, -- Original parsed text from PDF
    notes TEXT,
    documents JSONB, -- Array of document references
    
    -- Public Interaction
    public_visible BOOLEAN DEFAULT true,
    citizen_votes_enabled BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    approval_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Budget items table: Stores budget allocations by category
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Council votes table: Records municipal council voting sessions
CREATE TABLE IF NOT EXISTS council_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_date DATE NOT NULL,
    proposal_title VARCHAR(500) NOT NULL,
    vote_yes INTEGER DEFAULT 0,
    vote_no INTEGER DEFAULT 0,
    vote_abstain INTEGER DEFAULT 0,
    result VARCHAR(50), -- passed, rejected, postponed
    raw_text TEXT, -- Original parsed text from PDF
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Citizen votes table: Stores public opinion votes on projects
CREATE TABLE IF NOT EXISTS citizen_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('for', 'against')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_dates_actual ON projects(actual_start_date, actual_end_date);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(lat, lng);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(project_code);
CREATE INDEX IF NOT EXISTS idx_projects_budget_category ON projects(budget_category);
CREATE INDEX IF NOT EXISTS idx_projects_funding_source ON projects(funding_source);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_visible ON projects(public_visible);
CREATE INDEX IF NOT EXISTS idx_budget_year ON budget_items(year);
CREATE INDEX IF NOT EXISTS idx_council_dates ON council_votes(session_date);
CREATE INDEX IF NOT EXISTS idx_citizen_project ON citizen_votes(project_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to projects table
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO projects (title, description, budget, contractor, start_date, end_date, status, lat, lng) VALUES
('Central Park Renovation', 'Complete renovation of the central municipal park including new playgrounds and walking paths', 250000.00, 'Stara Zagora Construction Ltd.', '2024-03-01', '2024-08-15', 'active', 42.4257, 25.6344),
('New Library Wing', 'Construction of a new wing for the municipal library with modern facilities', 450000.00, 'BuildRight Construction', '2024-01-15', '2024-12-30', 'active', 42.4234, 25.6389),
('Road Resurfacing - Main Street', 'Resurfacing and modernization of Main Street from city center to north exit', 180000.00, 'RoadWorks Bulgaria', '2023-09-01', '2024-02-28', 'completed', 42.4212, 25.6321),
('Solar Panel Installation', 'Installation of solar panels on municipal buildings', 320000.00, 'Green Energy Solutions', '2024-06-01', '2024-10-15', 'planned', 42.4278, 25.6367);

INSERT INTO budget_items (category, amount, year, description) VALUES
('Infrastructure', 850000.00, 2024, 'Roads, bridges, and public transport'),
('Education', 420000.00, 2024, 'Schools, libraries, and educational programs'),
('Healthcare', 380000.00, 2024, 'Medical facilities and public health'),
('Environment', 290000.00, 2024, 'Parks, green spaces, and environmental projects'),
('Culture', 150000.00, 2024, 'Museums, theaters, and cultural events'),
('Public Safety', 210000.00, 2024, 'Police, fire department, and emergency services');


DO $$
BEGIN
  IF (SELECT COUNT(*) FROM council_votes) = 0 THEN
    INSERT INTO council_votes (session_date, proposal_title, vote_yes, vote_no, vote_abstain, result) VALUES
    ('2024-01-25', 'Приемане на бюджета на Община Стара Загора за 2024 г.', 33, 5, 3, 'passed'),
    ('2024-01-25', 'Актуализация на Наредбата за определяне и администриране на местни такси и цени на услуги', 29, 8, 4, 'passed'),
    ('2024-02-22', 'Отпускане на средства за ремонт на Общински пазар – централна сграда', 27, 9, 5, 'passed'),
    ('2024-02-22', 'Предложение за увеличение на данък върху недвижимите имоти с 15%', 14, 21, 6, 'rejected'),
    ('2024-03-14', 'Одобряване на Програма за управление и разпореждане с общинска собственост за 2024 г.', 31, 6, 4, 'passed'),
    ('2024-03-14', 'Разрешение за изработване на ПУП за разширение на Индустриална зона „Загоре"', 26, 10, 5, 'passed'),
    ('2024-04-18', 'Приемане на Общинска програма за закрила на детето 2024–2026 г.', 38, 2, 1, 'passed'),
    ('2024-04-18', 'Отдаване под наем на общински терен за изграждане на фотоволтаична централа', 19, 16, 6, 'passed'),
    ('2024-04-18', 'Именуване на нова улица в кв. „Три чучура" на „Проф. д-р Иван Станев"', 22, 11, 8, 'passed'),
    ('2024-05-23', 'Одобряване на Годишен доклад за наблюдение на изпълнението на Общинския план за развитие 2021–2027 г.', 35, 3, 3, 'passed'),
    ('2024-05-23', 'Кандидатстване по Програма „Развитие на регионите" 2021–2027 за рехабилитация на ул. „Цар Иван Шишман"', 30, 7, 4, 'passed'),
    ('2024-06-20', 'Предложение за закриване на ОУ „Христо Смирненски" – с. Богомилово поради демографски причини', 17, 18, 6, 'rejected'),
    ('2024-06-20', 'Приемане на Наредба за реда и условията за поставяне на преместваеми обекти', 24, 12, 5, 'passed'),
    ('2024-07-18', 'Отпускане на еднократна финансова помощ на граждани в затруднено положение – II тримесечие 2024 г.', 39, 1, 1, 'passed'),
    ('2024-07-18', 'Разрешение за провеждане на Международен фолклорен фестивал „Загора" – август 2024 г.', 37, 2, 2, 'passed'),
    ('2024-09-19', 'Актуализация на бюджета на Община Стара Загора за 2024 г. – трето тримесечие', 28, 9, 4, 'passed'),
    ('2024-09-19', 'Предложение за изграждане на нов детски кът в Южен парк', 33, 5, 3, 'passed'),
    ('2024-09-19', 'Отчет за изпълнение на решенията на Общинския съвет за I полугодие на 2024 г.', 36, 2, 3, 'passed'),
    ('2024-10-17', 'Приемане на Наредба за условията и реда за записване в общинските детски градини', 31, 6, 4, 'passed'),
    ('2024-10-17', 'Въвеждане на синя зона за паркиране в централната градска част', 20, 15, 6, 'passed'),
    ('2024-10-17', 'Отпускане на средства за неотложен ремонт на покрива на СУ „Максим Горки"', 38, 1, 2, 'passed'),
    ('2024-11-21', 'Приемане на Програма за енергийна ефективност на общинските сгради 2025–2027 г.', 29, 8, 4, 'passed'),
    ('2024-11-21', 'Отпускане на субсидия на „Тролейбусен транспорт" ЕООД за 2025 г.', 25, 12, 4, 'passed'),
    ('2024-11-21', 'Продажба на общински имот в кв. „Железник" – УПИ XIV-5318', 16, 19, 6, 'rejected'),
    ('2024-12-19', 'Приемане на бюджетна прогноза на Община Стара Загора за периода 2025–2027 г.', 32, 6, 3, 'passed'),
    ('2024-12-19', 'Одобряване на план за действие за общинските концесии за 2025 г.', 27, 9, 5, 'passed'),
    ('2023-01-26', 'Приемане на бюджета на Община Стара Загора за 2023 г.', 30, 7, 4, 'passed'),
    ('2023-02-23', 'Одобряване на Общинска стратегия за развитие на социалните услуги 2023–2026 г.', 34, 4, 3, 'passed'),
    ('2023-03-16', 'Изграждане на велоалея по бул. „Цар Симеон Велики"', 21, 14, 6, 'passed'),
    ('2023-04-20', 'Кандидатстване по ПNRR за саниране на многофамилни жилищни сгради', 36, 3, 2, 'passed'),
    ('2023-05-18', 'Увеличение на такса „Битови отпадъци" с 10% за 2024 г.', 18, 17, 6, 'passed'),
    ('2023-06-22', 'Приемане на Наредба за управление на общинските горски територии', 28, 9, 4, 'passed'),
    ('2023-09-21', 'Отчет за изпълнение на бюджета на Община Стара Загора към 30.06.2023 г.', 35, 3, 3, 'passed'),
    ('2023-10-19', 'Закриване на Дом за стари хора – с. Хан Аспарухово и преместване на потребителите', 13, 22, 6, 'rejected'),
    ('2023-11-23', 'Приемане на Програма за развитие на туризма в Община Стара Загора 2024–2026 г.', 31, 6, 4, 'passed'),
    ('2023-12-21', 'Приемане на бюджетна прогноза за периода 2024–2026 г.', 29, 8, 4, 'passed');
  END IF;
END $$;
