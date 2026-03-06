/**
 * Open Zagora - Express Server
 * 
 * Main server file for the municipal transparency dashboard API.
 * Handles PDF uploads, database operations, and serves data to the frontend.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database pool and test connection
const { testConnection, initSchema } = require('./db/pool');

// Import route handlers
const uploadRoutes = require('./routes/upload');
const projectRoutes = require('./routes/projects');
const budgetRoutes = require('./routes/budget');
const voteRoutes = require('./routes/votes');
const fileRoutes = require('./routes/files');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE SETUP
// ==========================================

// Enable CORS for all origins (configure for production)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed list
    const allowedOrigins = [
      'http://localhost:5173',
      'http://192.168.88.210:5173',
      process.env.CLIENT_URL || 'http://localhost:5173'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Note: PDF files are now served through /api/files route for better error handling

// ==========================================
// API ROUTES
// ==========================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Open Zagora API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount route handlers
app.use('/api/upload', uploadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/files', fileRoutes);

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
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

const startServer = async () => {
  // Test database connection before starting server
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }
  
  // Initialize database schema if needed
  const schemaInitialized = await initSchema();
  if (!schemaInitialized) {
    console.error('⚠️ Warning: Failed to initialize database schema. Some features may not work.');
  }
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

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
startServer();
