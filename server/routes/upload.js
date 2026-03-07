/**
 * PDF Upload and Parsing Routes
 * 
 * Handles multipart form uploads of PDF files, parses them using pdf-parse,
 * stores the raw text in PostgreSQL, and saves the file to disk.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { pool } = require('../db/pool');

const router = express.Router();

// ==========================================
// MULTER CONFIGURATION
// ==========================================

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const parsedDir = path.join(__dirname, '..', 'parsed');
    
    // Ensure directories exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(parsedDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

// File filter to only accept PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Initialize multer with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// ==========================================
// ROUTE HANDLERS
// ==========================================

/**
 * POST /api/upload
 * 
 * Upload and parse a PDF file
 * Expects: multipart/form-data with 'pdf' field containing the file
 * Optional: 'type' field indicating document type (project, budget, vote)
 */
router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const { path: filePath, originalname, filename } = req.file;
    const documentType = req.body.type || 'unknown';

    console.log(`📄 Processing PDF: ${originalname} (Type: ${documentType})`);

    // Read the PDF file
    const pdfBuffer = await fs.readFile(filePath);

    // Parse PDF content
    const pdfData = await pdfParse(pdfBuffer);
    const rawText = pdfData.text;

    console.log(`✅ PDF parsed successfully. Pages: ${pdfData.numpages}, Text length: ${rawText.length}`);

    // Save parsed text to JSON file for backup
    const parsedData = {
      originalName: originalname,
      fileName: filename,
      filePath: filePath,
      documentType: documentType,
      parsedAt: new Date().toISOString(),
      pageCount: pdfData.numpages,
      textLength: rawText.length,
      rawText: rawText
    };

    const parsedFilePath = path.join(__dirname, '..', 'parsed', `${filename}.json`);
    await fs.writeFile(parsedFilePath, JSON.stringify(parsedData, null, 2));

    // Store in database based on document type
    let dbResult = null;
    
    switch (documentType) {
      case 'project':
        dbResult = await storeProjectDocument(rawText, filename);
        break;
      case 'budget':
        dbResult = await storeBudgetDocument(rawText, filename);
        break;
      case 'vote':
        dbResult = await storeVoteDocument(rawText, filename);
        break;
      default:
        // Store as generic document
        dbResult = { message: 'Document stored as raw text only' };
    }

    res.status(201).json({
      success: true,
      message: 'PDF uploaded and parsed successfully',
      data: {
        originalName: originalname,
        fileName: filename,
        documentType: documentType,
        pageCount: pdfData.numpages,
        textPreview: rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''),
        databaseResult: dbResult,
        parsedFile: parsedFilePath
      }
    });

  } catch (error) {
    console.error('❌ Error processing PDF:', error);
    
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

/**
 * Helper function to store project document
 * Extracts project information and stores in projects table
 */
async function storeProjectDocument(text, filename) {
  // Simple extraction - in production, use more sophisticated NLP
  const lines = text.split('\n').filter(line => line.trim());
  
  // Try to extract title (first non-empty line or line with "проект"/project)
  let title = lines[0] || 'Untitled Project';
  const projectLine = lines.find(line => 
    line.toLowerCase().includes('проект') || 
    line.toLowerCase().includes('project')
  );
  if (projectLine && projectLine.length < 200) {
    title = projectLine;
  }

  // Try to extract budget (look for numbers with currency)
  const budgetMatch = text.match(/(\d[\d\s]*)\s*(лв|lv|bgn|BGN|€|\$)/);
  const budget = budgetMatch ? parseFloat(budgetMatch[1].replace(/\s/g, '')) : null;

  const query = `
    INSERT INTO projects (title, description, raw_text, status)
    VALUES ($1, $2, $3, 'planned')
    RETURNING id
  `;
  
  const result = await pool.query(query, [
    title.substring(0, 500),
    text.substring(0, 1000),
    text
  ]);

  return { 
    table: 'projects', 
    id: result.rows[0].id,
    extractedTitle: title,
    extractedBudget: budget
  };
}

/**
 * Helper function to store budget document
 */
async function storeBudgetDocument(text, filename) {
  // Store as a budget item with extracted information
  const query = `
    INSERT INTO budget_items (category, amount, year, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  
  // Try to extract year from text
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  
  // Try to extract amount
  const amountMatch = text.match(/(\d[\d\s]*)\s*(лв|lv|bgn|BGN)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/\s/g, '')) : 0;

  const result = await pool.query(query, [
    'Uncategorized',
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

/**
 * Helper function to store vote document
 */
async function storeVoteDocument(text, filename) {
  // Store as council vote record
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
  const title = lines[0] || 'Unknown Proposal';

  const result = await pool.query(query, [
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

/**
 * GET /api/upload/status
 * 
 * Check upload endpoint status
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ready',
    acceptedTypes: ['application/pdf'],
    maxFileSize: '10MB',
    supportedDocumentTypes: ['project', 'budget', 'vote', 'unknown']
  });
});

module.exports = router;
