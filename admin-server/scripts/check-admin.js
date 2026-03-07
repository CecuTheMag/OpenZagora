/**
 * Check and create admin user
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.ADMIN_DB_HOST || 'localhost',
  port: process.env.ADMIN_DB_PORT || 5433,
  database: process.env.ADMIN_DB_NAME || 'openzagora_admin',
  user: process.env.ADMIN_DB_USER || 'admin_user',
  password: process.env.ADMIN_DB_PASSWORD || 'admin_pass',
});

const checkAndCreateAdmin = async () => {
  try {
    // Check if admin user exists
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
    
    if (result.rows.length === 0) {
      console.log('Creating admin user...');
      const passwordHash = await bcrypt.hash('admin123', 12);
      
      await pool.query(`
        INSERT INTO admin_users (username, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', 'admin@openzagora.local', passwordHash, 'super_admin', true]);
      
      console.log('✅ Admin user created successfully');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
      console.log('   Username:', result.rows[0].username);
      console.log('   Role:', result.rows[0].role);
      console.log('   Active:', result.rows[0].is_active);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
};

checkAndCreateAdmin();