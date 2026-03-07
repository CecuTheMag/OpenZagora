/**
 * Admin Database Pool Configuration
 * 
 * COMPLETELY SEPARATE from main application database
 * This connection pool is dedicated to admin authentication and audit logging
 */

const { Pool } = require('pg');
require('dotenv').config();

// Admin database configuration - separate from main DB
const adminDbConfig = {
  host: process.env.ADMIN_DB_HOST || 'localhost',
  port: parseInt(process.env.ADMIN_DB_PORT || '5433'), // Different port from main DB
  database: process.env.ADMIN_DB_NAME || 'openzagora_admin',
  user: process.env.ADMIN_DB_USER || 'admin_user',
  password: process.env.ADMIN_DB_PASSWORD || 'admin_pass',
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection not established
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.ADMIN_DB_SSL_CA // Path to CA certificate
  } : false
};

// Create the connection pool
const pool = new Pool(adminDbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle admin database client', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_database() as database_name');
    console.log('✅ Admin Database connected successfully');
    console.log(`   Database: ${result.rows[0].database_name}`);
    console.log(`   Server Time: ${result.rows[0].current_time}`);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Admin Database connection error:', err.message);
    console.error('   Please check your ADMIN_DB_* environment variables');
    return false;
  }
};

// Initialize database schema
const initSchema = async () => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    await pool.query(schemaSQL);
    console.log('✅ Admin Database schema initialized');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize admin database schema:', err.message);
    return false;
  }
};

// Log audit event
const logAuditEvent = async (eventData) => {
  const {
    adminUserId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    details,
    success = true,
    errorMessage = null
  } = eventData;

  try {
    const query = `
      INSERT INTO audit_logs (
        admin_user_id, action, resource_type, resource_id,
        ip_address, user_agent, details, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      adminUserId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      JSON.stringify(details),
      success,
      errorMessage
    ]);
    
    return result.rows[0].id;
  } catch (err) {
    console.error('Failed to log audit event:', err);
    // Don't throw - audit logging should not break functionality
    return null;
  }
};

// Update last login timestamp
const updateLastLogin = async (userId) => {
  try {
    await pool.query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0 WHERE id = $1',
      [userId]
    );
  } catch (err) {
    console.error('Failed to update last login:', err);
  }
};

// Record failed login attempt
const recordFailedLogin = async (username) => {
  try {
    await pool.query(
      `UPDATE admin_users 
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE 
             WHEN failed_login_attempts >= 4 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
             ELSE NULL 
           END
       WHERE username = $1`,
      [username]
    );
  } catch (err) {
    console.error('Failed to record failed login:', err);
  }
};

// Check if account is locked
const isAccountLocked = async (username) => {
  try {
    const result = await pool.query(
      'SELECT locked_until FROM admin_users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) return false;
    
    const lockedUntil = result.rows[0].locked_until;
    if (!lockedUntil) return false;
    
    return new Date() < new Date(lockedUntil);
  } catch (err) {
    console.error('Failed to check account lock status:', err);
    return false;
  }
};

module.exports = {
  pool,
  testConnection,
  initSchema,
  logAuditEvent,
  updateLastLogin,
  recordFailedLogin,
  isAccountLocked
};
