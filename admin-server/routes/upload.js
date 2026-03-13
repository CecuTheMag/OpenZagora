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
const { Pool } = require('pg');
const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse');
const { execSync } = require('child_process');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool, logAuditEvent } = require('../db/pool');

// NOTE: Parsing is handled by shell script that runs individual parser scripts

// ==========================================
// MAIN DATABASE CONNECTION
// This connects to the PUBLIC database to store PDFs
// ==========================================
const mainDbConfig = {
  host: process.env.MAIN_DB_HOST || 'localhost',
  port: parseInt(process.env.MAIN_DB_PORT || '5432'),
  database: process.env.MAIN_DB_NAME || 'open_zagora',
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
    const budgetPdfDir = path.join(__dirname, '..', 'budget-pdfs');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(parsedDir, { recursive: true });
      await fs.mkdir(budgetPdfDir, { recursive: true });
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
  if (file.mimetype === 'application/pdf' || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and ZIP files are allowed'), false);
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
// HELPER FUNCTION: Process a single PDF file
// ==========================================
async function processSinglePdf(filePath, originalname, filename, req, mainPool) {
  // Extract text using pdf-parse (no external tools required)
  let rawText = '';
  let pageCount = null;

  try {
    const pdfBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(pdfBuffer);
    rawText = pdfData.text || '';
    pageCount = pdfData.numpages || null;
  } catch (err) {
    console.warn(`⚠️ [ADMIN] Could not extract text from ${originalname}:`, err.message);
    rawText = '';
  }

  console.log(`✅ [ADMIN] PDF parsed successfully: ${originalname}. Pages: ${pageCount}, Text length: ${rawText.length}`);

  // Save raw data to JSON backup
  const rawData = {
    uploadedBy: req.user.username,
    uploadedById: req.user.id,
    originalName: originalname,
    fileName: filename,
    parsedAt: new Date().toISOString(),
    pageCount: pageCount,
    textLength: rawText.length,
    rawText: rawText
  };

  const parsedFilePath = path.join(__dirname, '..', 'parsed', `${filename}.json`);
  await fs.writeFile(parsedFilePath, JSON.stringify(rawData, null, 2));

  // Determine document type from filename
  const lowerFilename = originalname.toLowerCase();
  let classification = { type: 'unknown', year: new Date().getFullYear(), description: originalname };
  
  // Use more specific patterns to avoid substring matches
  if (lowerFilename.includes('prihod') || /^pr 1 /.test(lowerFilename)) {
    classification = { type: 'income', year: 2025, description: 'Income Budget' };
  } else if (lowerFilename.includes('razhod') || /^pr 2 /.test(lowerFilename)) {
    classification = { type: 'expense', year: 2025, description: 'Expense Budget' };
  } else if (lowerFilename.includes('kmetstva') || /^pr 54 /.test(lowerFilename)) {
    classification = { type: 'village', year: 2025, description: 'Village Budget' };
  } else if (lowerFilename.includes('zaem')) {
    classification = { type: 'loan', year: 2025, description: 'Loan Document' };
  } else if (lowerFilename.includes('prognoza') || /^pr 57 /.test(lowerFilename)) {
    classification = { type: 'forecast', year: 2025, description: 'Budget Forecast' };
  } else if (lowerFilename.includes('indik') || /d\d{3}/.test(lowerFilename)) {
    classification = { type: 'indicator', year: 2025, description: 'Budget Indicator' };
  }
  
  console.log(`📋 [ADMIN] Document classified as: ${classification.type} for year ${classification.year}`);

  // Store PDF and mark for batch processing via shell script
  let parsedResult = { success: true, items: [], type: classification.type, message: 'PDF stored, will be parsed by batch script' };

  // Store document metadata
  const docResult = await storeDocumentMetadata({
    filename: filename,
    originalName: originalname,
    year: classification.year || new Date().getFullYear(),
    documentType: classification.type,
    documentSubtype: classification.subtype,
    category: classification.description,
    uploadedBy: req.user.username,
    fileSize: (await fs.stat(filePath)).size,
    pageCount: pageCount,
    rawText: rawText,
    parsedData: parsedResult,
    status: parsedResult.success ? 'parsed' : 'error'
  });

  const documentId = docResult.id;
  const storedItems = 0;
  
  console.log(`📦 [ADMIN] PDF stored with document ID ${documentId}. Run import-all-budget-data.sh to parse all PDFs.`);

  return {
    filename,
    originalname,
    classification,
    pageCount,
    rawText,
    parsedResult,
    storedItems,
    documentId,
    parsedFilePath
  };
}

// ==========================================
// POST /api/admin/upload
// Upload and parse PDF file or ZIP containing PDFs (Admin only)
// ==========================================
router.post('/', upload.single('file'), async (req, res) => {
  let auditLogId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file provided',
        message: 'Please select a PDF or ZIP file to upload'
      });
    }

    const { path: filePath, originalname, filename, size, mimetype } = req.file;
    const documentType = req.body.type || 'unknown';
    const customTitle = req.body.title || null;
    const customDescription = req.body.description || null;

    console.log(`📄 [ADMIN] Processing file: ${originalname} (Type: ${mimetype}) by ${req.user.username}`);

    // Log upload attempt
    auditLogId = await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_attempt',
      resourceType: mimetype.includes('zip') ? 'zip' : 'pdf',
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

    let processedFiles = [];

    if (mimetype.includes('zip')) {
      // Handle ZIP file
      console.log(`📦 [ADMIN] Extracting ZIP file: ${originalname}`);
      
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      
      // Create temp directory for extracted PDFs
      const tempDir = path.join(__dirname, '..', 'uploads', `temp-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      const budgetPdfDir = path.join(__dirname, '..', 'budget-pdfs');

      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.pdf')) {
          const pdfPath = path.join(tempDir, entry.entryName);
          await fs.mkdir(path.dirname(pdfPath), { recursive: true });
          await fs.writeFile(pdfPath, entry.getData());

          // Generate unique filename for this PDF
          const pdfFilename = `admin-${Date.now()}-${Math.round(Math.random() * 1E9)}-${entry.entryName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const finalPdfPath = path.join(__dirname, '..', 'uploads', pdfFilename);
          await fs.rename(pdfPath, finalPdfPath);

          // Also keep a copy in the budget-pdfs folder (for archive/inspection)
          const budgetPdfPath = path.join(budgetPdfDir, pdfFilename);
          await fs.copyFile(finalPdfPath, budgetPdfPath);

          try {
            const result = await processSinglePdf(finalPdfPath, entry.entryName, pdfFilename, req, mainPool);
            processedFiles.push(result);
          } catch (err) {
            console.error(`❌ [ADMIN] Error processing PDF ${entry.entryName}:`, err);
            processedFiles.push({
              filename: pdfFilename,
              originalname: entry.entryName,
              error: err.message
            });
          }
        }
      }
      
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning temp dir:', err);
      }
      
    } else {
      // Handle single PDF file
      try {
        const budgetPdfDir = path.join(__dirname, '..', 'budget-pdfs');
        const budgetPdfPath = path.join(budgetPdfDir, filename);
        await fs.copyFile(filePath, budgetPdfPath);

        const result = await processSinglePdf(filePath, originalname, filename, req, mainPool);
        processedFiles.push(result);
      } catch (err) {
        console.error(`❌ [ADMIN] Error processing PDF ${originalname}:`, err);
        processedFiles.push({
          filename,
          originalname,
          error: err.message
        });
      }
    }

    // Don't delete the uploaded file - keep it in uploads directory for viewing

    // Calculate totals
    const totalFiles = processedFiles.length;
    const successfulFiles = processedFiles.filter(f => !f.error).length;
    const totalItems = processedFiles.reduce((sum, f) => sum + (f.parsedResult?.items?.length || 0), 0);
    const totalAmount = processedFiles.reduce((sum, f) => sum + (f.parsedResult?.totalAmount || 0), 0);

    // Update audit log with success
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_success',
      resourceType: mimetype.includes('zip') ? 'zip' : 'pdf',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        originalName: originalname,
        fileName: filename,
        documentType: documentType,
        fileSize: size,
        totalFiles: totalFiles,
        successfulFiles: successfulFiles,
        totalItemsParsed: totalItems,
        totalAmount: totalAmount,
        processedFiles: processedFiles.map(f => ({
          originalName: f.originalname,
          documentType: f.classification?.type,
          itemsParsed: f.parsedResult?.items?.length || 0,
          error: f.error
        }))
      },
      success: true
    });

    // Trigger the import script to parse all PDFs
    console.log('🔄 [ADMIN] Triggering import-all-budget-data.sh to parse uploaded files...');
    try {
      execSync('cd /app/parsers && ./import-all-budget-data.sh', {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          MAIN_DB_HOST: 'db',
          MAIN_DB_PORT: '5432',
          MAIN_DB_NAME: 'open_zagora',
          MAIN_DB_USER: 'postgres',
          MAIN_DB_PASSWORD: 'postgres'
        },
        timeout: 300000,
        stdio: 'inherit',
        shell: '/bin/bash'
      });
      console.log('✅ [ADMIN] Parsing script completed');
    } catch (execError) {
      console.error('⚠️ [ADMIN] Parsing script error:', execError.message);
    }

    res.status(201).json({
      success: true,
      message: mimetype.includes('zip') ? 'ZIP uploaded and PDFs parsed successfully' : 'PDF uploaded and parsed successfully',
      data: {
        uploadedBy: req.user.username,
        originalName: originalname,
        fileName: filename,
        fileType: mimetype.includes('zip') ? 'zip' : 'pdf',
        totalFiles: totalFiles,
        successfulFiles: successfulFiles,
        totalItemsParsed: totalItems,
        totalAmount: totalAmount,
        processedFiles: processedFiles.map(f => ({
          originalName: f.originalname,
          fileName: f.filename,
          documentType: f.classification?.type,
          year: f.classification?.year,
          pageCount: f.pageCount,
          textLength: f.rawText?.length,
          itemsParsed: f.parsedResult?.items?.length || 0,
          totalAmount: f.parsedResult?.totalAmount || 0,
          documentId: f.documentId,
          error: f.error
        })),
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error processing file:', error);
    
    // Log failure
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'upload_failed',
      resourceType: req.file?.mimetype?.includes('zip') ? 'zip' : 'pdf',
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
      error: 'Failed to process file',
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
    INSERT INTO projects (title, description, budget, raw_text, status)
    VALUES ($1, $2, $3, $4, 'planned')
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
        
        // Generate unique filename - preserve original filename structure
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const uniqueFilename = `admin-${timestamp}-${random}-${pdfFile}`;
        const uploadPath = path.join(__dirname, '..', 'uploads', uniqueFilename);
        
        // Copy PDF to uploads directory
        try {
          await fs.copyFile(filePath, uploadPath);
          console.log(`📋 [ADMIN] Copied to: ${uploadPath}`);
          
          // Verify file was copied
          const stats = await fs.stat(uploadPath);
          console.log(`✅ [ADMIN] File verified: ${stats.size} bytes`);
        } catch (copyError) {
          console.error(`❌ [ADMIN] Failed to copy ${pdfFile}:`, copyError);
          throw copyError;
        }
        
        // Extract text using pdf-parse (no external tools required)
        let rawText = '';
        let pageCount = null;

        try {
          const pdfBuffer = await fs.readFile(uploadPath);
          const pdfData = await pdfParse(pdfBuffer);
          rawText = pdfData.text || '';
          pageCount = pdfData.numpages || null;
        } catch (err) {
          console.warn(`⚠️ [ADMIN] Could not extract text from ${pdfFile}:`, err.message);
          rawText = '';
        }
        
        // Classify document type
        const fileYear = parseInt(year) || 2025;
        let docType = 'unknown';
        
        if (pdfFile.toLowerCase().includes('prihod') || /^pr 1 /.test(pdfFile.toLowerCase())) {
          docType = 'income';
        } else if (pdfFile.toLowerCase().includes('razhod') || /^pr 2 /.test(pdfFile.toLowerCase())) {
          docType = 'expense';
        } else if (pdfFile.toLowerCase().includes('kmetstva') || /^pr 54 /.test(pdfFile.toLowerCase())) {
          docType = 'village';
        } else if (pdfFile.toLowerCase().includes('zaem')) {
          docType = 'loan';
        } else if (pdfFile.toLowerCase().includes('prognoza') || /^pr 57 /.test(pdfFile.toLowerCase())) {
          docType = 'forecast';
        } else if (pdfFile.toLowerCase().includes('indik') || /d\d{3}/.test(pdfFile)) {
          docType = 'indicator';
        }
        
        let parsedResult = { success: true, items: [], type: docType, message: 'PDF stored, will be parsed by batch script' };
        
        // Store document metadata with unique filename
        const classification = { type: parsedResult.type, year: fileYear, description: pdfFile };
        const fileStats = await fs.stat(uploadPath);
        const docResult = await storeDocumentMetadata({
          filename: uniqueFilename,
          originalName: pdfFile,
          year: fileYear,
          documentType: classification.type,
          documentSubtype: classification.subtype,
          category: classification.description,
          uploadedBy: req.user.username,
          fileSize: fileStats.size,
          pageCount: pageCount,
          rawText: rawText,
          parsedData: parsedResult,
          status: 'pending'
        });

        const documentId = docResult.id;
        const storedItems = 0;

        results.push({
          file: pdfFile,
          storedAs: uniqueFilename,
          success: true,
          documentId: documentId,
          type: parsedResult.type,
          year: fileYear,
          itemsStored: storedItems,
          totalAmount: 0,
          pages: pageCount,
          message: 'PDF stored. Run import-all-budget-data.sh to parse.'
        });
        
        console.log(`✅ [ADMIN] ${pdfFile} -> ${uniqueFilename}: ${parsedResult.type}`);
        
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
    const totalAmount = 0;

    console.log(`\n📦 [ADMIN] ${results.length} PDFs stored. To parse them, run: cd /app/parsers && ./import-all-budget-data.sh`);

    // Trigger the import script to parse all PDFs
    console.log('🔄 [ADMIN] Triggering import-all-budget-data.sh to parse uploaded files...');
    try {
      execSync('cd /app/parsers && ./import-all-budget-data.sh', {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          MAIN_DB_HOST: 'db',
          MAIN_DB_PORT: '5432',
          MAIN_DB_NAME: 'open_zagora',
          MAIN_DB_USER: 'postgres',
          MAIN_DB_PASSWORD: 'postgres'
        },
        timeout: 300000,
        stdio: 'inherit',
        shell: '/bin/bash'
      });
      console.log('✅ [ADMIN] Parsing script completed');
    } catch (execError) {
      console.error('⚠️ [ADMIN] Parsing script error:', execError.message);
    }

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
      message: `Folder processed successfully. ${results.length} PDFs stored. Run import-all-budget-data.sh to parse them.`,
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

// ==========================================
// GET /api/admin/upload/documents/:filename
// Download/view a specific PDF document
// ==========================================
router.get('/documents/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }
    
    // Try exact match first
    const possiblePaths = [
      path.join(__dirname, '..', 'uploads', filename),
      path.join(__dirname, '..', 'budget-pdfs', filename),
      path.join(__dirname, '..', 'parsed', filename)
    ];
    
    let foundPath = null;
    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath);
        foundPath = filePath;
        break;
      } catch (err) {
        // File not found in this location, try next
      }
    }
    
    // If not found, try to find by pattern (handle old sanitized names)
    if (!foundPath) {
      // Extract timestamp and random from filename: admin-{timestamp}-{random}-{originalname}
      const match = filename.match(/^admin-(\d+)-(\d+)-(.+)$/);
      if (match) {
        const [, timestamp, random, originalPart] = match;
        
        // Try to find files with same timestamp-random prefix
        const searchDirs = [
          path.join(__dirname, '..', 'uploads'),
          path.join(__dirname, '..', 'budget-pdfs')
        ];
        
        for (const dir of searchDirs) {
          try {
            const files = await fs.readdir(dir);
            const matchingFile = files.find(f => f.startsWith(`admin-${timestamp}-${random}-`));
            if (matchingFile) {
              foundPath = path.join(dir, matchingFile);
              console.log(`📄 [ADMIN] Found file by pattern: ${matchingFile}`);
              break;
            }
          } catch (err) {
            // Directory doesn't exist or can't read
          }
        }
      }
    }
    
    if (!foundPath) {
      return res.status(404).json({
        error: 'File not found',
        filename: filename,
        searchedPaths: possiblePaths,
        message: 'PDF file does not exist. It may have been deleted or not uploaded properly.'
      });
    }
    
    // Send the file
    res.sendFile(foundPath);
    
  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({
      error: 'Failed to serve document',
      message: error.message
    });
  }
});

// ==========================================
// POST /api/admin/upload/parse
// Trigger parsing of all uploaded PDFs
// ==========================================
router.post('/parse', async (req, res) => {
  try {
    console.log(`[ADMIN] ${req.user.username} triggered parsing script`);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'trigger_parse',
      resourceType: 'parser_script',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { triggeredBy: req.user.username },
      success: true
    });

    // Execute the parsing script
    const { execSync } = require('child_process');
    const scriptPath = path.join(__dirname, '..', 'parsers', 'import-all-budget-data.sh');
    
    try {
      const output = execSync(`cd ${path.dirname(scriptPath)} && bash import-all-budget-data.sh`, {
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });
      
      res.json({
        success: true,
        message: 'Parsing completed successfully',
        output: output
      });
    } catch (execError) {
      console.error('Parse script error:', execError.message);
      res.status(500).json({
        success: false,
        error: 'Parsing failed',
        message: execError.message
      });
    }
  } catch (error) {
    console.error('Error triggering parse:', error);
    res.status(500).json({
      error: 'Failed to trigger parsing',
      message: error.message
    });
  }
});

module.exports = router;
