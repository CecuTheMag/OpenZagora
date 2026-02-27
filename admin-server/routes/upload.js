/**
 * Admin PDF Upload Routes
 * 
 * Handles PDF uploads from admin interface
 * WRITES TO MAIN DATABASE (not admin database)
 * This is the bridge between admin system and main application data
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { Pool } = require('pg');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAuditEvent } = require('../db/pool');

// ==========================================
// MAIN DATABASE CONNECTION
// This connects to the PUBLIC database to store PDFs
// ==========================================
const mainDbConfig = {
  host: process.env.MAIN_DB_HOST || 'localhost',
  port: parseInt(process.env.MAIN_DB_PORT || '5432'),
  database: process.env.MAIN_DB_NAME || 'openzagora',
  user: process.env.MAIN_DB_USER || 'postgres',
  password: process.env.MAIN_DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.MAIN_DB_SSL_CA
  } : false
};

const mainPool = new Pool(mainDbConfig);

// Handle pool errors
mainPool.on('error', (err, client) => {
  console.error('Unexpected error on idle main database client', err);
});

// ==========================================
// MULTER CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const parsedDir = path.join(__dirname, '..', 'parsed');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(parsedDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `admin-${uniqueSuffix}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for admin uploads
  }
});

// ==========================================
// AUTHENTICATION MIDDLEWARE
// All upload routes require admin authentication
// ==========================================
router.use(authenticate);
router.use(requireAdmin);

// ==========================================
// POST /api/admin/upload
// Upload and parse PDF file (Admin only)
// ==========================================
router.post('/', upload.single('pdf'), async (req, res) => {
  let auditLogId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No PDF file provided',
        message: 'Please select a PDF file to upload'
      });
    }

    const { path: filePath, originalname, filename, size } = req.file;
    const documentType = req.body.type || 'unknown';
    const customTitle = req.body.title || null;
    const customDescription = req.body.description || null;

    console.log(`📄 [ADMIN] Processing PDF: ${originalname} (Type: ${documentType}) by ${req.user.username}`);

    // Log upload attempt
    auditLogId = await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_attempt',
      resourceType: 'pdf',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        originalName: originalname,
        fileName: filename,
        documentType: documentType,
        fileSize: size,
        customTitle: customTitle,
        customDescription: customDescription
      },
      success: true
    });

    // Read and parse PDF
    const pdfBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(pdfBuffer);
    const rawText = pdfData.text;

    console.log(`✅ [ADMIN] PDF parsed successfully. Pages: ${pdfData.numpages}, Text length: ${rawText.length}`);

    // Save parsed data to JSON backup
    const parsedData = {
      uploadedBy: req.user.username,
      uploadedById: req.user.id,
      originalName: originalname,
      fileName: filename,
      documentType: documentType,
      parsedAt: new Date().toISOString(),
      pageCount: pdfData.numpages,
      textLength: rawText.length,
      customTitle: customTitle,
      customDescription: customDescription,
      rawText: rawText
    };

    const parsedFilePath = path.join(__dirname, '..', 'parsed', `${filename}.json`);
    await fs.writeFile(parsedFilePath, JSON.stringify(parsedData, null, 2));

    // Store in MAIN database based on document type
    let dbResult = null;
    let resourceId = null;
    
    switch (documentType) {
      case 'project':
        dbResult = await storeProjectDocument(rawText, filename, customTitle, customDescription);
        resourceId = dbResult.id;
        break;
      case 'budget':
        dbResult = await storeBudgetDocument(rawText, filename, customTitle);
        resourceId = dbResult.id;
        break;
      case 'vote':
      case 'council_vote':
        dbResult = await storeVoteDocument(rawText, filename, customTitle);
        resourceId = dbResult.id;
        break;
      default:
        // Store as generic document in projects table with unknown type
        dbResult = await storeGenericDocument(rawText, filename, customTitle, customDescription);
        resourceId = dbResult.id;
    }

    // Update audit log with success
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_success',
      resourceType: 'pdf',
      resourceId: resourceId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        originalName: originalname,
        fileName: filename,
        documentType: documentType,
        pageCount: pdfData.numpages,
        textLength: rawText.length,
        databaseTable: dbResult.table,
        databaseId: resourceId
      },
      success: true
    });

    res.status(201).json({
      success: true,
      message: 'PDF uploaded and parsed successfully',
      data: {
        uploadedBy: req.user.username,
        originalName: originalname,
        fileName: filename,
        documentType: documentType,
        pageCount: pdfData.numpages,
        textLength: rawText.length,
        textPreview: rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''),
        databaseResult: dbResult,
        parsedFile: parsedFilePath,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error processing PDF:', error);
    
    // Log failure
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_failed',
      resourceType: 'pdf',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        fileName: req.file?.originalname,
        error: error.message
      },
      success: false,
      errorMessage: error.message
    });

    // Clean up uploaded file if processing failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }

    res.status(500).json({
      error: 'Failed to process PDF',
      message: error.message
    });
  }
});

// ==========================================
// DATABASE STORAGE FUNCTIONS
// These write to the MAIN database
// ==========================================

async function storeProjectDocument(text, filename, customTitle, customDescription) {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Use custom title if provided, otherwise extract from text
  let title = customTitle || lines[0] || 'Untitled Project';
  if (!customTitle) {
    const projectLine = lines.find(line => 
      line.toLowerCase().includes('проект') || 
      line.toLowerCase().includes('project')
    );
    if (projectLine && projectLine.length < 200) {
      title = projectLine;
    }
  }

  // Try to extract budget
  const budgetMatch = text.match(/(\d[\d\s]*)\s*(лв|lv|bgn|BGN|€|\$)/);
  const budget = budgetMatch ? parseFloat(budgetMatch[1].replace(/\s/g, '')) : null;

  const description = customDescription || text.substring(0, 1000);

  const query = `
    INSERT INTO projects (title, description, budget, raw_text, status)\n    VALUES ($1, $2, $3, $4, 'planned')
    RETURNING id
  `;
  
  const result = await mainPool.query(query, [
    title.substring(0, 500),
    description,
    budget,
    text
  ]);

  return { 
    table: 'projects', 
    id: result.rows[0].id,
    extractedTitle: title,
    extractedBudget: budget
  };
}

async function storeBudgetDocument(text, filename, customTitle) {
  const query = `
    INSERT INTO budget_items (category, amount, year, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  
  // Try to extract year
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  
  // Try to extract amount
  const amountMatch = text.match(/(\d[\d\s]*)\s*(лв|lv|bgn|BGN)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/\s/g, '')) : 0;

  const category = customTitle || 'Uncategorized';

  const result = await mainPool.query(query, [
    category,
    amount,
    year,
    text.substring(0, 500)
  ]);

  return { 
    table: 'budget_items', 
    id: result.rows[0].id,
    extractedYear: year,
    extractedAmount: amount
  };
}

async function storeVoteDocument(text, filename, customTitle) {
  const query = `
    INSERT INTO council_votes (session_date, proposal_title, raw_text, result)
    VALUES ($1, $2, $3, 'unknown')
    RETURNING id
  `;
  
  // Try to extract date
  const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  let sessionDate = new Date();
  if (dateMatch) {
    sessionDate = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
  }

  const lines = text.split('\n').filter(line => line.trim());
  const title = customTitle || lines[0] || 'Unknown Proposal';

  const result = await mainPool.query(query, [
    sessionDate,
    title.substring(0, 500),
    text
  ]);

  return { 
    table: 'council_votes', 
    id: result.rows[0].id,
    extractedDate: sessionDate
  };
}

async function storeGenericDocument(text, filename, customTitle, customDescription) {
  // Store as project with unknown type
  return storeProjectDocument(text, filename, customTitle || 'Unknown Document', customDescription);
}

// ==========================================
// GET /api/admin/upload/history
// Get upload history for current admin user
// ==========================================
router.get('/history', async (req, res) => {
  try {
    const auditResult = await pool.query(
      `SELECT 
        id,
        action,
        resource_type,
        resource_id,
        details,
        success,
        created_at
      FROM audit_logs
      WHERE admin_user_id = $1 
        AND action IN ('upload_success', 'upload_failed')
      ORDER BY created_at DESC
      LIMIT 50`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        uploads: auditResult.rows,
        total: auditResult.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching upload history:', error);
    res.status(500).json({
      error: 'Failed to fetch upload history',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/upload/status
// Check upload endpoint status
// ==========================================
router.get('/status', (req, res) => {
  res.json({
    status: 'ready',
    acceptedTypes: ['application/pdf'],
    maxFileSize: '50MB',
    supportedDocumentTypes: ['project', 'budget', 'vote', 'council_vote', 'unknown'],
    authenticated: true,
    user: {
      username: req.user.username,
      role: req.user.role
    }
  });
});

module.exports = router;
