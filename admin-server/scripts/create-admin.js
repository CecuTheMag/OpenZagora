const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.ADMIN_DB_HOST,
  port: process.env.ADMIN_DB_PORT,
  database: process.env.ADMIN_DB_NAME,
  user: process.env.ADMIN_DB_USER,
  password: process.env.ADMIN_DB_PASSWORD
});

async function createAdmin() {
  try {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@openzagora.local';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

    console.log('🔐 Creating admin user...');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(`
      INSERT INTO admin_users (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        is_active = EXCLUDED.is_active
      RETURNING id, username, email, role
    `, [username, email, passwordHash, 'super_admin', true]);

    console.log('✅ Admin user created/updated:');
    console.log(result.rows[0]);
    console.log('\n⚠️  IMPORTANT: Change the default password in production!');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
