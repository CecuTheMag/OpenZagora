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
      return;
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
};

// Export the pool and test function
module.exports = {
  pool,
  testConnection,
  // Helper function for running queries
  query: (text, params) => pool.query(text, params),
};
