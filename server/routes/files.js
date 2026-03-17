/**
 * File Serving Routes
 * 
 * Serves uploaded PDF files and budget documents for viewing in the frontend
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * GET /api/files/list
 * 
 * List available PDF files
 */
router.get('/list', (req, res) => {
  try {
    const budgetDir = path.join(__dirname, '..', 'budget-pdfs');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    let files = [];
    
    // Get budget PDFs
    if (fs.existsSync(budgetDir)) {
      const budgetFiles = fs.readdirSync(budgetDir)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => ({
          name: file,
          type: 'budget',
          path: `/api/files/${encodeURIComponent(file)}`
        }));
      files = files.concat(budgetFiles);
    }
    
    // Get uploaded PDFs
    if (fs.existsSync(uploadsDir)) {
      const uploadedFiles = fs.readdirSync(uploadsDir)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => ({
          name: file,
          type: 'uploaded',
          path: `/api/files/${encodeURIComponent(file)}`
        }));
      files = files.concat(uploadedFiles);
    }
    
    res.json({
      success: true,
      files: files,
      count: files.length
    });
    
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      error: 'Error listing files',
      message: error.message 
    });
  }
});

/**
 * GET /api/files/:filename
 * 
 * Serve PDF files from uploads or budget-pdfs directory
 */
router.get('/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    
    // Check multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '..', 'uploads', filename),
      path.join(__dirname, '..', 'budget-pdfs', filename),
      path.join(__dirname, '..', 'parsed', filename)
    ];
    
    let filePath = null;
    
    // 1. Exact match
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        filePath = testPath
        break
      }
    }

    // 2. Fuzzy match — search budget-pdfs and all subdirs under root/info/wqoidcwd/budjet
    if (!filePath) {
      const searchDirs = [
        path.join(__dirname, '..', 'budget-pdfs'),
        path.join(__dirname, '..', 'root', 'info', 'wqoidcwd', 'budjet'),
      ]

      // Collect all PDFs recursively
      const allPdfs = []
      const collectPdfs = (dir) => {
        if (!fs.existsSync(dir)) return
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) collectPdfs(full)
          else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) allPdfs.push(full)
        }
      }
      searchDirs.forEach(collectPdfs)

      // Strip multer prefix: "admin-DIGITS-DIGITS-"
      const stripped = filename.replace(/^[^-]+-\d+-\d+-/, '').toLowerCase()
      const strippedNorm = stripped.replace(/[_]+/g, ' ')
      const words = strippedNorm.split(/[\s\W]+/).filter(w => w.length >= 2)

      let bestScore = 0
      let bestFile = null
      for (const fullPath of allPdfs) {
        const dfLower = path.basename(fullPath).toLowerCase().replace(/[_]+/g, ' ')
        const score = words.filter(w => dfLower.includes(w)).length
        if (score > bestScore) {
          bestScore = score
          bestFile = fullPath
        }
      }

      if (bestFile && bestScore >= 2) {
        filePath = bestFile
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ 
        error: 'File not found',
        filename: filename,
        searchedPaths: possiblePaths
      });
    }
    
    // Check if it's a PDF file
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;