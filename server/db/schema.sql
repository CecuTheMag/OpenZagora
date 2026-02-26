-- Open Zagora Database Schema
-- PostgreSQL schema for municipal transparency dashboard

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table: Stores municipal projects with location data
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    budget DECIMAL(15, 2),
    contractor VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'planned', -- planned, active, completed, cancelled
    lat DECIMAL(10, 8), -- Latitude for map
    lng DECIMAL(11, 8), -- Longitude for map
    raw_text TEXT, -- Original parsed text from PDF
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
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
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

INSERT INTO council_votes (session_date, proposal_title, vote_yes, vote_no, vote_abstain, result) VALUES
('2024-01-15', 'Approval of 2024 Municipal Budget', 31, 4, 2, 'passed'),
('2024-02-20', 'Central Park Renovation Project', 28, 7, 2, 'passed'),
('2024-03-10', 'New Parking Regulations', 22, 12, 3, 'passed'),
('2024-04-05', 'Sister City Agreement with Thessaloniki', 35, 1, 1, 'passed'),
('2024-05-15', 'Municipal Tax Increase Proposal', 15, 19, 3, 'rejected');
