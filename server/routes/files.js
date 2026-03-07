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
    
    // Find the file in one of the directories
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
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