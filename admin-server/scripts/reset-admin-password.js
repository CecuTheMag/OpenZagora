/**
 * Script to reset admin password
 * Run this if you can't log in with admin/admin123
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const resetPassword = async () => {
  try {
    // Check if admin user exists
    const checkResult = await pool.query(
      'SELECT id, username, email, role, is_active, failed_login_attempts, locked_until FROM admin_users WHERE username = $1',
      ['admin']
    );

    if (checkResult.rows.length === 0) {
      console.log('❌ Admin user not found. Creating new admin user...');
      
      // Create admin user with password admin123
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      const insertResult = await pool.query(
        `INSERT INTO admin_users (username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, role, is_active`,
        ['admin', 'admin@openzagora.local', hashedPassword, 'admin', true]
      );
      
      console.log('✅ Admin user created successfully');
      console.log('   Username:', insertResult.rows[0].username);
      console.log('   Email:', insertResult.rows[0].email);
      console.log('   Role:', insertResult.rows[0].role);
      console.log('   Active:', insertResult.rows[0].is_active);
      console.log('\n🔑 You can now log in with:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      
    } else {
      const user = checkResult.rows[0];
      console.log('ℹ️  Admin user found:');
      console.log('   ID:', user.id);
      console.log('   Username:', user.username);
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      console.log('   Active:', user.is_active);
      console.log('   Failed attempts:', user.failed_login_attempts);
      console.log('   Locked until:', user.locked_until);
      
      // Reset password and unlock account
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await pool.query(
        `UPDATE admin_users 
         SET password_hash = $1, 
             failed_login_attempts = 0, 
             locked_until = NULL,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE username = $2`,
        [hashedPassword, 'admin']
      );
      
      console.log('\n✅ Admin password reset successfully');
      console.log('🔓 Account unlocked');
      console.log('\n🔑 You can now log in with:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
};

resetPassword();
