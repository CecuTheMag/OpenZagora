/**
 * Admin Budget Import Routes
 * 
 * Handles importing budget data from main server's PDF folder
 * Uses shell script execution to parse all PDFs
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAuditEvent } = require('../db/pool');

// ==========================================
// AUTHENTICATION MIDDLEWARE
// All budget routes require admin authentication
// ==========================================
router.use(authenticate);
router.use(requireAdmin);

// Default budget folder path (main server's budget PDFs)
const DEFAULT_BUDGET_FOLDER = '/app/budget-pdfs';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'b');

// ==========================================
// POST /api/admin/budget/import
// Import budget data from folder
// ==========================================
router.post('/import', async (req, res) => {
  let auditLogId = null;
  
  try {
    const { folderPath, clearExisting } = req.body;
    
    // Use provided path or default
    const sourceFolder = folderPath || DEFAULT_BUDGET_FOLDER;
    
    console.log(`📊 [ADMIN] Starting budget import from: ${sourceFolder}`);
    console.log(`👤 [ADMIN] User: ${req.user.username}`);

    // Log import attempt
    auditLogId = await logAuditEvent({
      adminUserId: req.user.id,
      action: 'budget_import_attempt',
      resourceType: 'budget',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        sourceFolder: sourceFolder,
        clearExisting: clearExisting || false
      },
      success: true
    });

    // Check if source folder exists
    try {
      await fs.access(sourceFolder);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Source folder not found',
        message: `The folder "${sourceFolder}" does not exist. Please provide a valid path.`
      });
    }

    // Read PDF files from source folder
    const files = await fs.readdir(sourceFolder);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files found',
        message: 'The source folder does not contain any PDF files.'
      });
    }

    console.log(`📄 [ADMIN] Found ${pdfFiles.length} PDF files`);

    // Create uploads directory if it doesn't exist
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Clear existing PDFs in uploads folder
    const existingFiles = await fs.readdir(UPLOADS_DIR);
    for (const file of existingFiles) {
      if (file.endsWith('.pdf')) {
        await fs.unlink(path.join(UPLOADS_DIR, file));
      }
    }

    // Copy PDFs from source folder
    let copiedCount = 0;
    for (const pdfFile of pdfFiles) {
      const srcPath = path.join(sourceFolder, pdfFile);
      const destPath = path.join(UPLOADS_DIR, pdfFile);
      await fs.copyFile(srcPath, destPath);
      copiedCount++;
      console.log(`   ✅ Copied: ${pdfFile}`);
    }

    console.log(`📂 [ADMIN] Copied ${copiedCount} PDF files to uploads folder`);

    // Execute the import script
    const scriptPath = path.join(__dirname, '..', 'scripts', 'import-all-budget-data.sh');
    
    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Import script not found',
        message: 'The import script is missing. Please contact the administrator.'
      });
    }

    console.log(`🚀 [ADMIN] Running import script...`);

    // Execute the shell script
    return new Promise((resolve, reject) => {
      // Use the source folder as argument
      exec(`sh "${scriptPath}" "${sourceFolder}"`, {
        cwd: path.join(__dirname, '..'),
        timeout: 300000 // 5 minutes timeout
      }, async (error, stdout, stderr) => {
        console.log(`📊 [ADMIN] Script output:\n${stdout}`);
        
        if (stderr) {
          console.warn(`⚠️ [ADMIN] Script warnings:\n${stderr}`);
        }

        if (error) {
          console.error(`❌ [ADMIN] Script error: ${error.message}`);
          
          // Log failure
          await logAuditEvent({
            adminUserId: req.user.id,
            action: 'budget_import_failed',
            resourceType: 'budget',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
              sourceFolder: sourceFolder,
              copiedFiles: copiedCount,
              error: error.message,
              stdout: stdout,
              stderr: stderr
            },
            success: false,
            errorMessage: error.message
          });

          return resolve(res.status(500).json({
            success: false,
            error: 'Import failed',
            message: error.message,
            details: stdout + stderr
          }));
        }

        // Parse the output to get summary - fix regex patterns to match script output
        let summary = {
          income: { items: 0, total: 0 },
          expenses: { items: 0, total: 0 },
          villages: { items: 0, total: 0 },
          loans: { items: 0, total: 0 },
          forecasts: { items: 0, total: 0 },
          indicators: { items: 0, total: 0 }
        };

        // Extract counts from script output - prioritize ✅ Imported lines (final results)
        // These are the actual imported counts from each parser
        
        // Income: Use "✅ Imported X income" or fall back to "Final Results" section
        const incomeImportedMatch = stdout.match(/✅ Imported (\d+) income/);
        if (incomeImportedMatch) {
          summary.income.items = parseInt(incomeImportedMatch[1]);
        } else {
          // Try to find in final results section
          const finalIncomeMatch = stdout.match(/Income items:\s*(\d+)/);
          if (finalIncomeMatch) summary.income.items = parseInt(finalIncomeMatch[1]);
        }
        
        // Expenses: Use "✅ Imported X expenses"
        const expenseImportedMatch = stdout.match(/✅ Imported (\d+) expenses/);
        if (expenseImportedMatch) {
          summary.expenses.items = parseInt(expenseImportedMatch[1]);
        }
        
        // Villages: Use "✅ Imported X villages"
        const villageImportedMatch = stdout.match(/✅ Imported (\d+) villages/);
        if (villageImportedMatch) {
          summary.villages.items = parseInt(villageImportedMatch[1]);
        }
        
        // Loans: Use "✅ Imported X loans"
        const loanImportedMatch = stdout.match(/✅ Imported (\d+) loans/);
        if (loanImportedMatch) {
          summary.loans.items = parseInt(loanImportedMatch[1]);
        }
        
        // Forecasts: Use "✅ Imported X forecasts"
        const forecastImportedMatch = stdout.match(/✅ Imported (\d+) forecasts/);
        if (forecastImportedMatch) {
          summary.forecasts.items = parseInt(forecastImportedMatch[1]);
        }
        
        // Indicators: Use "Final Results" section which has the total
        const finalIndicatorMatch = stdout.match(/Indicator items:\s*(\d+)/);
        if (finalIndicatorMatch) {
          summary.indicators.items = parseInt(finalIndicatorMatch[1]);
        }

        // Log success
        await logAuditEvent({
          adminUserId: req.user.id,
          action: 'budget_import_success',
          resourceType: 'budget',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            sourceFolder: sourceFolder,
            copiedFiles: copiedCount,
            summary: summary,
            output: stdout
          },
          success: true
        });

        console.log(`✅ [ADMIN] Budget import completed successfully`);

        return resolve(res.status(200).json({
          success: true,
          message: 'Budget data imported successfully',
          data: {
            sourceFolder: sourceFolder,
            filesCopied: copiedCount,
            pdfFiles: pdfFiles,
            summary: summary,
            output: stdout
          }
        }));
      });
    });

  } catch (error) {
    console.error('❌ [ADMIN] Budget import error:', error);
    
    // Log failure
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'budget_import_error',
      resourceType: 'budget',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        folderPath: req.body.folderPath,
        error: error.message
      },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Import failed',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/budget/status
// Check budget import status and configuration
// ==========================================
router.get('/status', async (req, res) => {
  try {
    // Check if source folder exists
    let sourceFolderExists = false;
    try {
      await fs.access(DEFAULT_BUDGET_FOLDER);
      sourceFolderExists = true;
    } catch (err) {
      sourceFolderExists = false;
    }

    // Check uploads folder
    let uploadsFolderStatus = { exists: false, pdfCount: 0 };
    try {
      const uploadsExists = await fs.access(UPLOADS_DIR);
      uploadsFolderStatus.exists = true;
      const files = await fs.readdir(UPLOADS_DIR);
      uploadsFolderStatus.pdfCount = files.filter(f => f.endsWith('.pdf')).length;
    } catch (err) {
      uploadsFolderStatus.exists = false;
    }

    res.json({
      success: true,
      data: {
        defaultSourceFolder: DEFAULT_BUDGET_FOLDER,
        sourceFolderExists: sourceFolderExists,
        uploadsFolder: UPLOADS_DIR,
        uploadsFolderStatus: uploadsFolderStatus,
        supportedDocumentTypes: [
          { type: 'income', pattern: 'prihodi, pr 1' },
          { type: 'expense', pattern: 'razhod, pr 2' },
          { type: 'village', pattern: 'kmetstva, pr 54' },
          { type: 'loan', pattern: 'zaem' },
          { type: 'forecast', pattern: 'prognoza, pr 57' },
          { type: 'indicator', pattern: 'indik, d###' }
        ]
      }
    });

  } catch (error) {
    console.error('Error checking budget status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/budget/files
// List PDF files in uploads folder
// ==========================================
router.get('/files', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    const fileDetails = [];
    for (const file of pdfFiles) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      fileDetails.push({
        name: file,
        size: stats.size,
        modified: stats.mtime
      });
    }

    res.json({
      success: true,
      data: {
        files: fileDetails,
        total: fileDetails.length
      }
    });

  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list files',
      message: error.message
    });
  }
});

module.exports = router;
