/**
 * Open Zagora Admin Server
 * 
 * Enterprise-grade admin backend with complete separation from main application.
 * Handles authentication, authorization, and PDF upload management.
 * 
 * SECURITY: This server connects to a COMPLETELY SEPARATE admin database
 * for authentication, while writing PDF data to the main application database.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import admin database pool and test connection
const { testConnection, initSchema } = require('./db/pool');

// Import route handlers
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');

// Initialize Express application
const app = express();
const PORT = process.env.ADMIN_PORT || 5001; // Different port from main server

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration - restrict to admin client only
const corsOptions = {
  origin: [
    'http://localhost:5174',
    'http://192.168.88.208:5174',
    process.env.ADMIN_CLIENT_URL || 'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many attempts',
    message: 'Too many login attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// General rate limiting for all other endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.'
  }
});

// ==========================================
// REQUEST PARSING
// ==========================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// STATIC FILES
// ==========================================

// Serve uploaded files (admin uploads only)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// API ROUTES
// ==========================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Open Zagora Admin API is running',
    service: 'admin',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin server is responding',
    cors: req.headers.origin
  });
});

// Apply rate limiting to auth routes
app.use('/api/auth/login', authLimiter);

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/admin/upload', uploadRoutes);

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

const startServer = async () => {
  try {
    // Test admin database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to admin database. Exiting...');
      process.exit(1);
    }

    // Initialize admin database schema
    const schemaInitialized = await initSchema();
    if (!schemaInitialized) {
      console.error('❌ Failed to initialize admin database schema. Exiting...');
      process.exit(1);
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Admin Server running on port ${PORT}`);
      console.log(`🔐 Authentication: JWT-based`);
      console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Admin Client URL: ${process.env.ADMIN_CLIENT_URL || 'http://localhost:5174'}`);
      console.log(`\n✅ Admin system is ready for enterprise use\n`);
    });

  } catch (err) {
    console.error('Failed to start admin server:', err);
    process.exit(1);
  }
};

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database pool
    const { pool } = require('./db/pool');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Replace the server reference for graceful shutdown
app.listen = () => server;

startServer();
