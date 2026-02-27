/**
 * Base Parser Class
 * 
 * Provides common parsing functionality for all budget document types
 */

class BaseParser {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Clean and normalize extracted text
     * @param {string} text - Raw text from PDF
     * @returns {string} Cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/\n+/g, '\n')          // Normalize newlines
            .replace(/[^\S\n]+/g, ' ')      // Remove extra spaces
            .trim();
    }

    /**
     * Extract lines from text
     * @param {string} text - Text to split
     * @returns {Array} Array of non-empty lines
     */
    extractLines(text) {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    /**
     * Try to parse a number from various formats
     * @param {string} value - String value to parse
     * @returns {number|null} Parsed number or null
     */
    parseNumber(value) {
        if (!value) return null;
        
        // Remove spaces, replace comma with dot
        const cleaned = value
            .toString()
            .replace(/\s/g, '')
            .replace(/,/g, '.')
            .replace(/[^\d.-]/g, '');
        
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    /**
     * Extract amount in BGN from text
     * @param {string} text - Text to search
     * @returns {number|null} Extracted amount or null
     */
    extractAmount(text) {
        if (!text) return null;
        
        // Look for patterns like "1 234 567.89" or "1234567.89" followed by лв/lv/BGN
        const patterns = [
            /(\d[\d\s,.]*)\s*(?:лв|lv|bgn|BGN|лв\.)/i,
            /(\d{1,3}(?:\s\d{3})*(?:,\d{2})?)/,
            /(\d+(?:,\d{2})?)/
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const num = this.parseNumber(match[1]);
                if (num !== null && num > 0) {
                    return num;
                }
            }
        }
        
        return null;
    }

    /**
     * Extract year from text
     * @param {string} text - Text to search
     * @returns {number|null} Extracted year or null
     */
    extractYear(text) {
        if (!text) return null;
        
        const yearMatch = text.match(/\b(20[2-3]\d)\b/);
        return yearMatch ? parseInt(yearMatch[1]) : null;
    }

    /**
     * Extract date from text
     * @param {string} text - Text to search
     * @returns {Date|null} Extracted date or null
     */
    extractDate(text) {
        if (!text) return null;
        
        // Bulgarian date formats: DD.MM.YYYY, DD/MM/YYYY
        const datePatterns = [
            /(\d{1,2})[./](\d{1,2})[./](20\d{2})/,
            /(\d{1,2})[./](\d{1,2})[./](\d{2})/
        ];
        
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // JS months are 0-based
                let year = parseInt(match[3]);
                if (year < 100) year += 2000;
                
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        return null;
    }

    /**
     * Parse a table from text (rows with aligned columns)
     * @param {Array} lines - Array of text lines
     * @param {Object} options - Parsing options
     * @returns {Array} Array of parsed rows
     */
    parseTable(lines, options = {}) {
        const {
            startPattern = null,     // Pattern to start parsing
            endPattern = null,       // Pattern to end parsing
            minColumns = 2,          // Minimum columns to consider a row
            headerLines = 0          // Number of header lines to skip
        } = options;

        const rows = [];
        let started = !startPattern;
        let lineIndex = 0;

        for (const line of lines) {
            lineIndex++;
            
            // Check for start
            if (!started && startPattern && startPattern.test(line)) {
                started = true;
                continue;
            }
            
            // Check for end
            if (endPattern && endPattern.test(line)) {
                break;
            }
            
            if (!started) continue;
            if (lineIndex <= headerLines) continue;

            // Try to split into columns
            const columns = this.splitColumns(line);
            if (columns.length >= minColumns) {
                rows.push(columns);
            }
        }

        return rows;
    }

    /**
     * Split a line into columns
     * @param {string} line - Line to split
     * @returns {Array} Array of column values
     */
    splitColumns(line) {
        // Try multiple strategies
        const strategies = [
            // Tab-separated
            () => line.split('\t').map(c => c.trim()).filter(c => c),
            // Multiple spaces (3+)
            () => line.split(/\s{3,}/).map(c => c.trim()).filter(c => c),
            // Fixed positions (for aligned tables)
            () => this.splitFixedColumns(line)
        ];

        for (const strategy of strategies) {
            const result = strategy();
            if (result.length >= 2) {
                return result;
            }
        }

        return [line];
    }

    /**
     * Split line by fixed column positions
     * @param {string} line - Line to split
     * @returns {Array} Array of column values
     */
    splitFixedColumns(line) {
        // This is a simplified version - could be enhanced with actual column detection
        const positions = [0, 20, 50, 70, 90]; // Example positions
        const columns = [];
        
        for (let i = 0; i < positions.length; i++) {
            const start = positions[i];
            const end = positions[i + 1] || line.length;
            const value = line.substring(start, end).trim();
            if (value) {
                columns.push(value);
            }
        }
        
        return columns;
    }

    /**
     * Add error to log
     * @param {string} message - Error message
     */
    addError(message) {
        this.errors.push(message);
    }

    /**
     * Add warning to log
     * @param {string} message - Warning message
     */
    addWarning(message) {
        this.warnings.push(message);
    }

    /**
     * Get parsing results with errors and warnings
     * @returns {Object} Results object
     */
    getResults() {
        return {
            success: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    /**
     * Main parse method - to be implemented by subclasses
     * @param {string} text - Raw text from PDF
     * @param {Object} metadata - Document metadata
     * @returns {Object} Parsed data
     */
    parse(text, metadata) {
        throw new Error('Parse method must be implemented by subclass');
    }
}

module.exports = BaseParser;
