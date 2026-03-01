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
const { parseIncome, parseExpenses, parseVillages, parseLoans, parseForecasts, parseIndicators } = require('../parsers');

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

    // Determine document type from filename
    const lowerFilename = originalname.toLowerCase();
    let classification = { type: documentType, year: new Date().getFullYear(), description: originalname };
    
    if (lowerFilename.includes('prihod') || lowerFilename.includes('pr 1')) {
      classification = { type: 'income', year: 2025, description: 'Income Budget' };
    } else if (lowerFilename.includes('razhod') || lowerFilename.includes('pr 2')) {
      classification = { type: 'expense', year: 2025, description: 'Expense Budget' };
    } else if (lowerFilename.includes('kmetstva') || lowerFilename.includes('pr 54')) {
      classification = { type: 'village', year: 2025, description: 'Village Budget' };
    } else if (lowerFilename.includes('zaem')) {
      classification = { type: 'loan', year: 2025, description: 'Loan Document' };
    } else if (lowerFilename.includes('prognoza') || lowerFilename.includes('pr 57')) {
      classification = { type: 'forecast', year: 2025, description: 'Budget Forecast' };
    } else if (lowerFilename.match(/indik|d\d{3}/i)) {
      classification = { type: 'indicator', year: 2025, description: 'Budget Indicator' };
    }
    
    console.log(`📋 [ADMIN] Document classified as: ${classification.type} for year ${classification.year}`);

    // Parse document with appropriate parser
    let parsedResult = { success: false, items: [], type: classification.type };
    
    if (classification.type === 'income') {
      const items = parseIncome(filePath, mainPool);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.amount, 0) };
      }
    } else if (classification.type === 'expense') {
      const items = parseExpenses(filePath, mainPool);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.amount, 0) };
      }
    } else if (classification.type === 'village') {
      const items = parseVillages(filePath, mainPool);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.total_amount, 0) };
      }
    } else if (classification.type === 'loan') {
      const items = parseLoans(filePath, mainPool, originalname);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.original_amount, 0) };
      }
    } else if (classification.type === 'forecast') {
      const items = parseForecasts(filePath, mainPool);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.amount_2025, 0) };
      }
    } else if (classification.type === 'indicator') {
      const items = parseIndicators(filePath, mainPool, originalname);
      if (items.length > 0) {
        parsedResult = { success: true, items, totalAmount: items.reduce((s, i) => s + i.amount_approved, 0) };
      }
    }
    
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
      for (const item of parsedResult.items) {
        try {
          if (parsedResult.type === 'income') {
            await mainPool.query(
              'INSERT INTO budget_income (document_id, year, code, name, amount) VALUES ($1, $2, $3, $4, $5)',
              [documentId, classification.year, item.code, item.name, item.amount]
            );
          } else if (parsedResult.type === 'expense') {
            await mainPool.query(
              'INSERT INTO budget_expenses (document_id, year, function_code, function_name, program_name, amount) VALUES ($1, $2, $3, $4, $5, $6)',
              [documentId, classification.year, item.function_code, item.function_name, item.program_name, item.amount]
            );
          } else if (parsedResult.type === 'indicator') {
            await mainPool.query(
              'INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved, amount_executed) VALUES ($1, $2, $3, $4, $5, $6)',
              [documentId, classification.year, item.indicator_code, item.indicator_name, item.amount_approved, item.amount_executed]
            );
          } else if (parsedResult.type === 'loan') {
            await mainPool.query(
              'INSERT INTO budget_loans (document_id, year, loan_type, loan_code, original_amount, remaining_amount, interest_rate, purpose) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
              [documentId, classification.year, item.loan_type, item.loan_code, item.original_amount, item.remaining_amount, item.interest_rate, item.purpose]
            );
          } else if (parsedResult.type === 'village') {
            await mainPool.query(
              'INSERT INTO budget_villages (document_id, year, code, name, state_personnel, state_maintenance, local_total, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
              [documentId, classification.year, item.code, item.name, item.state_personnel, item.state_maintenance, item.local_total, item.total_amount]
            );
          } else if (parsedResult.type === 'forecast') {
            await mainPool.query(
              'INSERT INTO budget_forecasts (document_id, code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
              [documentId, item.code, item.name, item.amount_2024, item.amount_2025, item.amount_2026, item.amount_2027, item.amount_2028]
            );
          }
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
// POST /api/admin/upload/folder
// Upload and parse a folder of PDF files (Admin only)
// Accepts a folder path on the server or a zip file
// ==========================================
router.post('/folder', async (req, res) => {
  let auditLogId = null;
  
  try {
    const { folderPath, year } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ 
        error: 'No folder path provided',
        message: 'Please provide a folder path containing PDF files'
      });
    }

    console.log(`📁 [ADMIN] Processing folder: ${folderPath} for year ${year} by ${req.user.username}`);

    // Resolve the folder path
    const fullPath = path.isAbsolute(folderPath) ? folderPath : path.join(__dirname, '..', folderPath);
    
    // Check if path exists
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        error: 'Invalid folder path',
        message: 'The provided path is not a directory'
      });
    }

    // Read all files in the directory
    const files = await fs.readdir(fullPath);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      return res.status(400).json({
        error: 'No PDF files found',
        message: 'The folder does not contain any PDF files'
      });
    }

    console.log(`📁 [ADMIN] Found ${pdfFiles.length} PDF files in folder`);

    // Log upload attempt
    auditLogId = await logAuditEvent({
      adminUserId: req.user.id,
      action: 'folder_upload_attempt',
      resourceType: 'pdf_folder',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        folderPath: folderPath,
        fullPath: fullPath,
        year: year,
        fileCount: pdfFiles.length,
        files: pdfFiles
      },
      success: true
    });

    // Process each PDF file
    const results = [];
    const errors = [];
    
    // Sort PDFs to process in order (pr1, pr2, pr3, etc.)
    pdfFiles.sort();
    
    for (const pdfFile of pdfFiles) {
      try {
        const filePath = path.join(fullPath, pdfFile);
        console.log(`📄 [ADMIN] Processing: ${pdfFile}`);
        
        // Read and parse PDF
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        const rawText = pdfData.text;
        
        // Parse with working parsers in sequence (same as import-all-budget-data.sh)
        const fileYear = parseInt(year) || 2025;
        let parsedResult = { success: false, items: [], type: 'unknown' };
        
        // Step 1: Try income parser
        if (pdfFile.toLowerCase().includes('prihod') || pdfFile.toLowerCase().includes('pr 1')) {
          const items = parseIncome(filePath, mainPool);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'income', totalAmount: items.reduce((s, i) => s + i.amount, 0) };
          }
        }
        
        // Step 2: Try expense parser
        if (!parsedResult.success && (pdfFile.toLowerCase().includes('razhod') || pdfFile.toLowerCase().includes('pr 2'))) {
          const items = parseExpenses(filePath, mainPool);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'expense', totalAmount: items.reduce((s, i) => s + i.amount, 0) };
          }
        }
        
        // Step 3: Try village parser
        if (!parsedResult.success && (pdfFile.toLowerCase().includes('kmetstva') || pdfFile.toLowerCase().includes('pr 54'))) {
          const items = parseVillages(filePath, mainPool);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'village', totalAmount: items.reduce((s, i) => s + i.total_amount, 0) };
          }
        }
        
        // Step 4: Try loan parser
        if (!parsedResult.success && pdfFile.toLowerCase().includes('zaem')) {
          const items = parseLoans(filePath, mainPool, pdfFile);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'loan', totalAmount: items.reduce((s, i) => s + i.original_amount, 0) };
          }
        }
        
        // Step 5: Try forecast parser
        if (!parsedResult.success && (pdfFile.toLowerCase().includes('prognoza') || pdfFile.toLowerCase().includes('pr 57'))) {
          const items = parseForecasts(filePath, mainPool);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'forecast', totalAmount: items.reduce((s, i) => s + i.amount_2025, 0) };
          }
        }
        
        // Step 6: Try indicator parser
        if (!parsedResult.success && pdfFile.match(/indik|d\d{3}/i)) {
          const items = parseIndicators(filePath, mainPool, pdfFile);
          if (items.length > 0) {
            parsedResult = { success: true, items, type: 'indicator', totalAmount: items.reduce((s, i) => s + i.amount_approved, 0) };
          }
        }
        
        // Store document metadata
        const classification = { type: parsedResult.type, year: fileYear, description: pdfFile };
        const docResult = await storeDocumentMetadata({
          filename: pdfFile,
          originalName: pdfFile,
          year: fileYear,
          documentType: classification.type,
          documentSubtype: classification.subtype,
          category: classification.description,
          uploadedBy: req.user.username,
          fileSize: pdfBuffer.length,
          pageCount: pdfData.numpages,
          rawText: rawText,
          parsedData: parsedResult,
          status: parsedResult.success ? 'parsed' : 'error'
        });

        const documentId = docResult.id;

        // Store parsed data in appropriate tables
        let storedItems = 0;
        if (parsedResult.items && parsedResult.items.length > 0) {
          for (const item of parsedResult.items) {
            try {
              if (parsedResult.type === 'income') {
                await mainPool.query(
                  'INSERT INTO budget_income (document_id, year, code, name, amount) VALUES ($1, $2, $3, $4, $5)',
                  [documentId, fileYear, item.code, item.name, item.amount]
                );
              } else if (parsedResult.type === 'expense') {
                await mainPool.query(
                  'INSERT INTO budget_expenses (document_id, year, function_code, function_name, program_name, amount) VALUES ($1, $2, $3, $4, $5, $6)',
                  [documentId, fileYear, item.function_code, item.function_name, item.program_name, item.amount]
                );
              } else if (parsedResult.type === 'indicator') {
                await mainPool.query(
                  'INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved, amount_executed) VALUES ($1, $2, $3, $4, $5, $6)',
                  [documentId, fileYear, item.indicator_code, item.indicator_name, item.amount_approved, item.amount_executed]
                );
              } else if (parsedResult.type === 'loan') {
                await mainPool.query(
                  'INSERT INTO budget_loans (document_id, year, loan_type, loan_code, original_amount, remaining_amount, interest_rate, purpose) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                  [documentId, fileYear, item.loan_type, item.loan_code, item.original_amount, item.remaining_amount, item.interest_rate, item.purpose]
                );
              } else if (parsedResult.type === 'village') {
                await mainPool.query(
                  'INSERT INTO budget_villages (document_id, year, code, name, state_personnel, state_maintenance, local_total, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                  [documentId, fileYear, item.code, item.name, item.state_personnel, item.state_maintenance, item.local_total, item.total_amount]
                );
              } else if (parsedResult.type === 'forecast') {
                await mainPool.query(
                  'INSERT INTO budget_forecasts (document_id, code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                  [documentId, item.code, item.name, item.amount_2024, item.amount_2025, item.amount_2026, item.amount_2027, item.amount_2028]
                );
              }
              storedItems++;
            } catch (err) {
              console.error(`Error storing item from ${pdfFile}:`, err.message);
            }
          }
        }

        results.push({
          file: pdfFile,
          success: true,
          documentId: documentId,
          type: parsedResult.type,
          year: fileYear,
          itemsStored: storedItems,
          totalAmount: parsedResult.totalAmount || 0,
          pages: pdfData.numpages
        });
        
        console.log(`✅ [ADMIN] ${pdfFile}: ${parsedResult.type}, ${storedItems} items, ${(parsedResult.totalAmount || 0).toLocaleString()} лв`);
        
      } catch (fileError) {
        console.error(`❌ [ADMIN] Error processing ${pdfFile}:`, fileError.message);
        errors.push({
          file: pdfFile,
          error: fileError.message
        });
      }
    }

    // Calculate summary
    const incomeCount = results.filter(r => r.type === 'income').length;
    const expenseCount = results.filter(r => r.type === 'expense').length;
    const indicatorCount = results.filter(r => r.type === 'indicator').length;
    const loanCount = results.filter(r => r.type === 'loan').length;
    const villageCount = results.filter(r => r.type === 'village').length;
    const forecastCount = results.filter(r => r.type === 'forecast').length;
    const totalItemsStored = results.reduce((sum, r) => sum + r.itemsStored, 0);
    const totalAmount = results.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // Update audit log with success
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'folder_upload_success',
      resourceType: 'pdf_folder',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        folderPath: folderPath,
        year: year,
        totalFiles: pdfFiles.length,
        processedSuccessfully: results.length,
        failedFiles: errors.length,
        incomeDocuments: incomeCount,
        expenseDocuments: expenseCount,
        indicatorDocuments: indicatorCount,
        loanDocuments: loanCount,
        totalItemsStored: totalItemsStored,
        results: results.map(r => ({ file: r.file, type: r.type, items: r.itemsStored, amount: r.totalAmount })),
        errors: errors
      },
      success: true
    });

    res.status(201).json({
      success: true,
      message: `Folder processed successfully. ${results.length} files processed, ${totalItemsStored} items stored.`,
      data: {
        folderPath: folderPath,
        year: year,
        totalFiles: pdfFiles.length,
        processedSuccessfully: results.length,
        failedFiles: errors.length,
        summary: {
          income: incomeCount,
          expenses: expenseCount,
          indicators: indicatorCount,
          loans: loanCount,
          villages: villageCount,
          forecasts: forecastCount,
          totalItems: totalItemsStored,
          totalAmount: totalAmount
        },
        results: results,
        errors: errors,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error processing folder:', error);
    
    // Log failure
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'folder_upload_failed',
      resourceType: 'pdf_folder',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        folderPath: req.body.folderPath,
        year: req.body.year,
        error: error.message
      },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to process folder',
      message: error.message
    });
  }
});

// ==========================================
// POST /api/admin/upload/zip
// Upload and parse a zip file containing PDF files (Admin only)
// ==========================================
router.post('/zip', upload.single('zip'), async (req, res) => {
  let auditLogId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No zip file provided',
        message: 'Please select a zip file containing PDF files'
      });
    }

    const { year } = req.body;
    const { path: filePath, originalname, size } = req.file;

    console.log(`📦 [ADMIN] Processing zip: ${originalname} for year ${year} by ${req.user.username}`);

    // Extract zip file
    const extractDir = path.join(__dirname, '..', 'uploads', 'extracted', path.basename(filePath, '.zip'));
    await fs.mkdir(extractDir, { recursive: true });
    
    // Use node-stream-zip or Adm-zip (need to check if installed)
    // For now, return a message that zip extraction needs to be implemented
    // This is a placeholder - actual implementation would use a zip library
    
    // Log upload attempt
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'zip_upload_attempt',
      resourceType: 'pdf_zip',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        originalName: originalname,
        fileName: req.file.filename,
        year: year,
        fileSize: size
      },
      success: true
    });

    res.status(201).json({
      success: true,
      message: 'Zip file uploaded. Please use the /folder endpoint with the extracted path.',
      data: {
        uploadedZip: originalname,
        extractTo: extractDir,
        nextStep: 'Use POST /api/admin/upload/folder with folderPath = ' + extractDir,
        note: 'Zip extraction needs to be implemented. Please extract manually and use folder upload.'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error processing zip:', error);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'zip_upload_failed',
      resourceType: 'pdf_zip',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        fileName: req.file?.originalname,
        error: error.message
      },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to process zip file',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/upload/status
// Check upload endpoint status
// ==========================================
router.get('/status', async (req, res) => {
  res.json({
    status: 'ready',
    acceptedTypes: ['application/pdf'],
    maxFileSize: '50MB',
    supportedDocumentTypes: [
      { type: 'income', description: 'Income Budget (prihodi, pr 1)' },
      { type: 'expense', description: 'Expense Budget (razhodi, pr 2)' },
      { type: 'village', description: 'Village Budget (kmetstva, pr 54)' },
      { type: 'loan', description: 'Loan Documents (zaem)' },
      { type: 'forecast', description: 'Budget Forecast (prognoza, pr 57)' },
      { type: 'indicator', description: 'Budget Indicators (indik, d###)' }
    ],
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
