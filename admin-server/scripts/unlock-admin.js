/**
 * Script to unlock admin account
 * Run this if the admin account gets locked due to failed login attempts
 */

const { pool } = require('../db/pool');

const unlockAdmin = async () => {
  try {
    const result = await pool.query(
      `UPDATE admin_users 
       SET failed_login_attempts = 0, 
           locked_until = NULL 
       WHERE username = 'admin'
       RETURNING username, failed_login_attempts, locked_until`
    );

    if (result.rows.length > 0) {
      console.log('✅ Admin account unlocked successfully');
      console.log('   Username:', result.rows[0].username);
      console.log('   Failed attempts reset to:', result.rows[0].failed_login_attempts);
      console.log('   Lock status:', result.rows[0].locked_until || 'Not locked');
    } else {
      console.log('❌ Admin user not found');
    }
  } catch (err) {
    console.error('❌ Failed to unlock admin account:', err.message);
  } finally {
    await pool.end();
  }
};

unlockAdmin();
