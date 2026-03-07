/**
 * Database Connection Pool Configuration
 * 
 * This module creates and exports a PostgreSQL connection pool using the 'pg' package.
 * The pool manages multiple database connections for efficient query handling.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool with configuration from environment variables
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'open_zagora',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  // Pool configuration for production readiness
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection not established
  // Retry configuration for Docker startup
  allowExitOnIdle: false,
  // Character encoding for Bulgarian/Cyrillic support
  options: '-c client_encoding=UTF8',
});

// Handle pool errors for unexpected database disconnections
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection on startup with retry logic
const testConnection = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
      return true;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ All database connection attempts failed');
        console.error('Please check your database configuration in .env file');
      }
    }
  }
  return false;
};

// Initialize database schema if tables don't exist
const initSchema = async () => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    console.log('🔍 Checking database schema...');
    
    // Check if projects table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'projects'
      ) as exists
    `);
    
    // Always try to create tables if they might not exist (use IF NOT EXISTS)
    // Main schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schemaSQL);
    console.log('✅ Main schema ready');
    
    // Data pipeline schema
    const pipelineSchemaPath = path.join(__dirname, 'data_pipeline_schema.sql');
    const pipelineSchemaSQL = await fs.readFile(pipelineSchemaPath, 'utf8');
    await pool.query(pipelineSchemaSQL);
    console.log('✅ Data pipeline schema ready');
    
    // Budget schema
    const budgetSchemaPath = path.join(__dirname, 'budget_schema.sql');
    try {
      const budgetSchemaSQL = await fs.readFile(budgetSchemaPath, 'utf8');
      await pool.query(budgetSchemaSQL);
      console.log('✅ Budget schema ready');
    } catch (err) {
      // Ignore if no budget schema
    }
    
    console.log('✅ All database schemas initialized');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize schema:', err.message);
    // Don't fail - try to continue anyway
    return true;
  }
};

// Export the pool and test function
module.exports = {
  pool,
  testConnection,
  initSchema,
  // Helper function for running queries
  query: (text, params) => pool.query(text, params),
};
