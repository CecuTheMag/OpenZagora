/**
 * Authentication Middleware
 * 
 * Enterprise-grade JWT authentication and authorization
 * COMPLETELY SEPARATE from main application
 */

const jwt = require('jsonwebtoken');
const { pool, logAuditEvent } = require('../db/pool');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'openzagora-admin';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'openzagora-admin-api';

/**
 * Generate JWT token for authenticated user
 */
const generateToken = (user) => {
  const payload = {
    sub: user.id, // Subject (user ID)
    username: user.username,
    email: user.email,
    role: user.role,
    jti: require('crypto').randomUUID(), // Unique token ID for revocation
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  const options = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256']
    });
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authorization token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const { valid, decoded, error } = verifyToken(token);
    
    if (!valid) {
      // Log failed authentication attempt
      await logAuditEvent({
        action: 'auth_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: error, token_present: true },
        success: false,
        errorMessage: error
      });

      return res.status(401).json({
        error: 'Invalid token',
        message: error
      });
    }

    // Check if user still exists and is active
    const userResult = await pool.query(
      'SELECT id, username, email, role, is_active FROM admin_users WHERE id = $1',
      [decoded.sub]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await logAuditEvent({
        adminUserId: user.id,
        action: 'auth_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'inactive_account' },
        success: false,
        errorMessage: 'Account is deactivated'
      });

      return res.status(401).json({
        error: 'Account deactivated',
        message: 'This account has been deactivated'
      });
    }

    // Attach user info to request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenJti: decoded.jti
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Authorization Middleware - Admin Role Required
 * Ensures user has admin or super_admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated to access this resource'
    });
  }

  if (!['admin', 'super_admin'].includes(req.user.role)) {
    // Log unauthorized access attempt
    logAuditEvent({
      adminUserId: req.user.id,
      action: 'unauthorized_access',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { 
        required_role: 'admin',
        actual_role: req.user.role,
        path: req.path,
        method: req.method
      },
      success: false,
      errorMessage: 'Insufficient privileges'
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource'
    });
  }

  next();
};

/**
 * Authorization Middleware - Super Admin Role Required
 * Ensures user has super_admin role only
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated to access this resource'
    });
  }

  if (req.user.role !== 'super_admin') {
    logAuditEvent({
      adminUserId: req.user.id,
      action: 'unauthorized_access',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { 
        required_role: 'super_admin',
        actual_role: req.user.role,
        path: req.path,
        method: req.method
      },
      success: false,
      errorMessage: 'Super admin privileges required'
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'Super admin privileges required'
    });
  }

  next();
};

/**
 * Optional Authentication Middleware
 * Attaches user info if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const { valid, decoded } = verifyToken(token);

    if (valid) {
      const userResult = await pool.query(
        'SELECT id, username, email, role FROM admin_users WHERE id = $1 AND is_active = true',
        [decoded.sub]
      );

      if (userResult.rows.length > 0) {
        req.user = {
          id: userResult.rows[0].id,
          username: userResult.rows[0].username,
          email: userResult.rows[0].email,
          role: userResult.rows[0].role
        };
      }
    }

    next();
  } catch (err) {
    // Silently continue without auth
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
