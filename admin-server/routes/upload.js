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
const { pool, logAuditEvent } = require('../db/pool');
const { DocumentClassifier, parseDocument, getInsertStatements } = require('../parsers');

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

    // Save raw data to JSON backup
    const rawData = {
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
    await fs.writeFile(parsedFilePath, JSON.stringify(rawData, null, 2));

    // Classify document and use smart parsing
    const classifier = new DocumentClassifier();
    const classification = classifier.classify(originalname);
    
    console.log(`📋 [ADMIN] Document classified as: ${classification.type} (${classification.subtype}) for year ${classification.year}`);

    // Parse document with appropriate parser
    const parsedResult = parseDocument(rawText, classification);
    
    if (!parsedResult.success) {
      console.warn(`⚠️ [ADMIN] Parsing had issues:`, parsedResult.errors);
    }

    // Store document metadata
    const docResult = await storeDocumentMetadata({
      filename: filename,
      originalName: originalname,
      year: classification.year || new Date().getFullYear(),
      documentType: classification.type,
      documentSubtype: classification.subtype,
      category: classification.description,
      uploadedBy: req.user.username,
      fileSize: size,
      pageCount: pdfData.numpages,
      rawText: rawText,
      parsedData: parsedResult,
      status: parsedResult.success ? 'parsed' : 'error'
    });

    const documentId = docResult.id;

    // Store parsed data in appropriate tables
    let storedItems = 0;
    if (parsedResult.items && parsedResult.items.length > 0) {
      const statements = getInsertStatements(parsedResult, documentId);
      
      for (const stmt of statements) {
        try {
          await mainPool.query(stmt.query, stmt.params);
          storedItems++;
        } catch (err) {
          console.error('Error storing parsed item:', err);
        }
      }
    }

    // Also store in legacy tables for backward compatibility
    let legacyResult = null;
    if (documentType === 'budget' || classification.type === 'income' || classification.type === 'expense') {
      legacyResult = await storeBudgetDocument(rawText, filename, customTitle || classification.description);
    } else if (documentType === 'project') {
      legacyResult = await storeProjectDocument(rawText, filename, customTitle, customDescription);
    } else if (documentType === 'vote' || documentType === 'council_vote') {
      legacyResult = await storeVoteDocument(rawText, filename, customTitle);
    }

    // Update audit log with success
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_success',
      resourceType: 'pdf',
      resourceId: documentId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        originalName: originalname,
        fileName: filename,
        documentType: classification.type,
        documentSubtype: classification.subtype,
        year: classification.year,
        pageCount: pdfData.numpages,
        textLength: rawText.length,
        itemsParsed: parsedResult.items ? parsedResult.items.length : 0,
        itemsStored: storedItems,
        classification: classification,
        legacyTable: legacyResult ? legacyResult.table : null
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
        documentType: classification.type,
        documentSubtype: classification.subtype,
        year: classification.year,
        pageCount: pdfData.numpages,
        textLength: rawText.length,
        textPreview: rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''),
        classification: classification,
        parsedData: {
          totalItems: parsedResult.totalItems || 0,
          totalAmount: parsedResult.totalAmount || parsedResult.totalApproved || 0,
          items: parsedResult.items ? parsedResult.items.slice(0, 5) : [] // First 5 items only
        },
        storedItems: storedItems,
        documentId: documentId,
        legacyResult: legacyResult,
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

// Store document metadata in budget_documents table
async function storeDocumentMetadata(metadata) {
  const query = `
    INSERT INTO budget_documents 
    (filename, original_name, year, document_type, document_subtype, category, 
     uploaded_by, file_size, page_count, raw_text, parsed_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `;
  
  const params = [
    metadata.filename,
    metadata.originalName,
    metadata.year,
    metadata.documentType,
    metadata.documentSubtype,
    metadata.category,
    metadata.uploadedBy,
    metadata.fileSize,
    metadata.pageCount,
    metadata.rawText.substring(0, 10000), // Limit raw text storage
    JSON.stringify(metadata.parsedData),
    metadata.status
  ];
  
  const result = await mainPool.query(query, params);
  
  return {
    table: 'budget_documents',
    id: result.rows[0].id
  };
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
// ==========================================
// GET /api/admin/upload/status
// Check upload endpoint status
// ==========================================
router.get('/status', async (req, res) => {
  // Get supported document types from classifier
  const classifier = new DocumentClassifier();
  const supportedTypes = classifier.getSupportedTypes();
  
  res.json({
    status: 'ready',
    acceptedTypes: ['application/pdf'],
    maxFileSize: '50MB',
    supportedDocumentTypes: supportedTypes.map(t => ({
      type: t.type,
      subtype: t.subtype,
      description: t.description,
      pattern: t.regex.toString()
    })),
    smartParsing: true,
    authenticated: true,
    user: {
      username: req.user.username,
      role: req.user.role
    }
  });
});

// ==========================================
// GET /api/admin/upload/documents
// Get list of uploaded documents with metadata
// ==========================================
router.get('/documents', async (req, res) => {
  try {
    const { year, type, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id,
        filename,
        original_name,
        year,
        document_type,
        document_subtype,
        category,
        uploaded_by,
        uploaded_at,
        file_size,
        page_count,
        status,
        (SELECT COUNT(*) FROM budget_income WHERE document_id = budget_documents.id) as income_count,
        (SELECT COUNT(*) FROM budget_expenses WHERE document_id = budget_documents.id) as expenses_count,
        (SELECT COUNT(*) FROM budget_indicators WHERE document_id = budget_documents.id) as indicators_count,
        (SELECT COUNT(*) FROM budget_loans WHERE document_id = budget_documents.id) as loans_count
      FROM budget_documents
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (year) {
      query += ` AND year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }
    
    if (type) {
      query += ` AND document_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY uploaded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await mainPool.query(query, params);
    
    res.json({
      success: true,
      data: {
        documents: result.rows,
        total: result.rows.length,
        filters: { year, type }
      }
    });
    
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message
    });
  }
});

module.exports = router;
