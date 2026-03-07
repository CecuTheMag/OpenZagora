/**
 * Authentication Routes
 * 
 * Admin login/logout and session management
 * COMPLETELY SEPARATE from main application
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool, logAuditEvent, updateLastLogin, recordFailedLogin, isAccountLocked } = require('../db/pool');
const { generateToken, authenticate } = require('../middleware/auth');

// ==========================================
// POST /api/auth/login
// Authenticate admin user and return JWT
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    // Check if account is locked
    const locked = await isAccountLocked(username);
    if (locked) {
      await logAuditEvent({
        action: 'login_attempt_locked',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { username, reason: 'account_locked' },
        success: false,
        errorMessage: 'Account is temporarily locked due to too many failed attempts'
      });

      return res.status(423).json({
        error: 'Account locked',
        message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
      });
    }

    // Find user by username
    const userResult = await pool.query(
      'SELECT id, username, email, password_hash, role, is_active FROM admin_users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      // Log failed login attempt (user not found)
      await logAuditEvent({
        action: 'login_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { username, reason: 'user_not_found' },
        success: false,
        errorMessage: 'Invalid username or password'
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid username or password'
      });
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (!user.is_active) {
      await logAuditEvent({
        action: 'login_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { username, reason: 'account_inactive' },
        success: false,
        errorMessage: 'Account is deactivated'
      });

      return res.status(401).json({
        error: 'Account deactivated',
        message: 'This account has been deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Record failed login attempt
      await recordFailedLogin(username);

      await logAuditEvent({
        adminUserId: user.id,
        action: 'login_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { username, reason: 'invalid_password' },
        success: false,
        errorMessage: 'Invalid username or password'
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid username or password'
      });
    }

    // Update last login timestamp
    await updateLastLogin(user.id);

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Log successful login
    await logAuditEvent({
      adminUserId: user.id,
      action: 'login_success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { 
        username,
        role: user.role,
        token_issued: true
      },
      success: true
    });

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

// ==========================================
// POST /api/auth/logout
// Logout admin user (client should discard token)
// ==========================================
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Log logout event
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'logout',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        username: req.user.username,
        token_jti: req.user.tokenJti
      },
      success: true
    });

    // In a stateless JWT system, we can't truly "invalidate" the token
    // until it expires. However, we can add it to a revocation list
    // if we want to implement token blacklisting.
    
    // For now, we just acknowledge the logout
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout'
    });
  }
});

// ==========================================
// GET /api/auth/me
// Get current authenticated user info
// ==========================================
router.get('/me', authenticate, async (req, res) => {
  try {
    // Get fresh user data from database
    const userResult = await pool.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM admin_users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User no longer exists'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          lastLogin: user.last_login,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: 'An error occurred while retrieving user information'
    });
  }
});

// ==========================================
// POST /api/auth/change-password
// Change admin user password
// ==========================================
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM admin_users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User no longer exists'
      });
    }

    const currentHash = userResult.rows[0].password_hash;

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, currentHash);

    if (!isValidPassword) {
      await logAuditEvent({
        adminUserId: req.user.id,
        action: 'password_change_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'invalid_current_password' },
        success: false,
        errorMessage: 'Current password is incorrect'
      });

      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    // Log password change
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'password_changed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { success: true },
      success: true
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An error occurred while changing password'
    });
  }
});

// ==========================================
// GET /api/auth/verify
// Verify token validity (for client-side checks)
// ==========================================
router.get('/verify', authenticate, (req, res) => {
  // If we get here, token is valid (authenticate middleware passed)
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user
    }
  });
});

module.exports = router;
