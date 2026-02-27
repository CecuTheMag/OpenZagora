/**
 * Loan Parser (ZAEM - Заеми)
 * 
 * Parses loan and debt documents
 * Extracts loan types, creditors, amounts, and terms
 */

const BaseParser = require('./BaseParser');

class LoanParser extends BaseParser {
    constructor() {
        super();
        this.documentType = 'loan';
    }

    /**
     * Parse loan document
     * @param {string} text - Raw text from PDF
     * @param {Object} metadata - Document metadata
     * @returns {Object} Parsed loan data
     */
    parse(text, metadata) {
        this.errors = [];
        this.warnings = [];
        
        const lines = this.extractLines(text);
        const year = metadata.year || this.extractYear(text) || new Date().getFullYear();
        const loanType = metadata.subtype || this.extractLoanType(text) || 'unknown';
        
        // Extract title
        const title = this.extractTitle(lines, loanType);
        
        // Parse loan items
        const items = this.parseLoanItems(lines, year, loanType);
        
        // Calculate totals
        const totalOriginal = items.reduce((sum, item) => sum + (item.originalAmount || 0), 0);
        const totalRemaining = items.reduce((sum, item) => sum + (item.remainingAmount || 0), 0);
        
        return {
            documentType: this.documentType,
            loanType: loanType,
            year: year,
            title: title,
            totalItems: items.length,
            totalOriginalAmount: totalOriginal,
            totalRemainingAmount: totalRemaining,
            items: items,
            rawText: text.substring(0, 5000),
            ...this.getResults()
        };
    }

    /**
     * Extract loan type from text
     * @param {string} text - Text to search
     * @returns {string|null} Loan type or null
     */
    extractLoanType(text) {
        const types = [
            { pattern: /JESSICA/i, name: 'JESSICA' },
            { pattern: /FLAG/i, name: 'FLAG' },
            { pattern: /FUG/i, name: 'FUG' },
            { pattern: /UBB/i, name: 'UBB' },
            { pattern: /FSMC/i, name: 'FSMC' },
            { pattern: /RBB/i, name: 'RBB' }
        ];
        
        for (const type of types) {
            if (type.pattern.test(text)) {
                return type.name.toLowerCase();
            }
        }
        
        return null;
    }

    /**
     * Extract document title
     * @param {Array} lines - Document lines
     * @param {string} loanType - Loan type
     * @returns {string} Extracted title
     */
    extractTitle(lines, loanType) {
        const titlePatterns = [
            /заем|loan/i,
            /дълг|debt/i,
            /погашение|repayment/i,
            new RegExp(loanType, 'i')
        ];
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            for (const pattern of titlePatterns) {
                if (pattern.test(line)) {
                    return line;
                }
            }
        }
        
        return `${loanType.toUpperCase()} Loan Document`;
    }

    /**
     * Parse loan items from document
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @param {string} loanType - Loan type
     * @returns {Array} Array of loan items
     */
    parseLoanItems(lines, year, loanType) {
        const items = [];
        let rowOrder = 0;
        
        // Skip header lines
        let started = false;
        const startPatterns = [
            /кредитор|creditor/i,
            /заем|loan/i,
            /договор|contract/i,
            /проект|project/i
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if we've reached the data section
            if (!started) {
                for (const pattern of startPatterns) {
                    if (pattern.test(line)) {
                        started = true;
                        i += 2;
                        break;
                    }
                }
                continue;
            }
            
            // Parse loan item
            const item = this.parseLoanLine(line, lines, i, year, loanType);
            if (item) {
                rowOrder++;
                item.rowOrder = rowOrder;
                items.push(item);
                
                // If we consumed additional lines, adjust index
                if (item._linesConsumed) {
                    i += item._linesConsumed;
                }
            }
        }
        
        // If no items found, try alternative method
        if (items.length === 0) {
            return this.parseLoanItemsAlternative(lines, year, loanType);
        }
        
        return items;
    }

    /**
     * Parse a single loan line
     * @param {string} line - Current line
     * @param {Array} allLines - All document lines
     * @param {number} index - Current line index
     * @param {number} year - Document year
     * @param {string} loanType - Loan type
     * @returns {Object|null} Parsed item or null
     */
    parseLoanLine(line, allLines, index, year, loanType) {
        // Look for loan patterns
        // Common patterns:
        // "A1-5 Project Name 1234567.89 987654.32"
        // "Drama Theater 500000.00 400000.00 2024-2025"
        
        // Try to extract loan code/identifier
        const codeMatch = line.match(/^([A-Z]\d+-\d+|П\d+|P\d+)/i);
        const loanCode = codeMatch ? codeMatch[1] : null;
        
        // Try to extract amounts
        const amounts = this.extractAllAmounts(line);
        
        // Try to extract dates
        const dates = this.extractDateRange(line);
        
        // Try to extract purpose/project name
        let purpose = line;
        if (loanCode) {
            purpose = purpose.replace(loanCode, '');
        }
        // Remove amounts and dates from purpose
        purpose = purpose.replace(/\d[\d\s,.]*(?:лв|lv|bgn)?/gi, '');
        purpose = purpose.replace(/\d{4}-\d{4}/g, '');
        purpose = this.cleanItemName(purpose);
        
        if (!purpose || purpose.length < 3) {
            // Try to get purpose from next line
            if (index + 1 < allLines.length) {
                const nextLine = allLines[index + 1];
                if (nextLine.length > 5 && !nextLine.match(/^\d/)) {
                    purpose = this.cleanItemName(nextLine);
                    return {
                        loanType: loanType,
                        loanCode: loanCode,
                        creditor: this.getCreditorName(loanType),
                        originalAmount: amounts[0] || null,
                        remainingAmount: amounts[1] || null,
                        interestRate: null,
                        startDate: dates.start,
                        endDate: dates.end,
                        purpose: purpose,
                        monthlyPayment: null,
                        year: year,
                        _linesConsumed: 1
                    };
                }
            }
        }
        
        if (amounts.length > 0 || purpose.length > 5) {
            return {
                loanType: loanType,
                loanCode: loanCode,
                creditor: this.getCreditorName(loanType),
                originalAmount: amounts[0] || null,
                remainingAmount: amounts[1] || null,
                interestRate: null,
                startDate: dates.start,
                endDate: dates.end,
                purpose: purpose,
                monthlyPayment: amounts[2] || null,
                year: year
            };
        }
        
        return null;
    }

    /**
     * Extract all amounts from a line
     * @param {string} line - Line to parse
     * @returns {Array} Array of amounts
     */
    extractAllAmounts(line) {
        const amounts = [];
        const pattern = /(\d[\d\s,.]*)\s*(?:лв|lv|bgn)?/gi;
        let match;
        
        while ((match = pattern.exec(line)) !== null) {
            const num = this.parseNumber(match[1]);
            if (num !== null && num > 1000) { // Filter small numbers
                amounts.push(num);
            }
        }
        
        return amounts;
    }

    /**
     * Extract date range from text
     * @param {string} text - Text to search
     * @returns {Object} Object with start and end dates
     */
    extractDateRange(text) {
        const match = text.match(/(\d{4})-(\d{4})/);
        if (match) {
            return {
                start: new Date(parseInt(match[1]), 0, 1),
                end: new Date(parseInt(match[2]), 11, 31)
            };
        }
        
        // Try single year
        const yearMatch = text.match(/\b(20\d{2})\b/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            return {
                start: new Date(year, 0, 1),
                end: new Date(year, 11, 31)
            };
        }
        
        return { start: null, end: null };
    }

    /**
     * Get creditor name based on loan type
     * @param {string} loanType - Loan type
     * @returns {string} Creditor name
     */
    getCreditorName(loanType) {
        const creditors = {
            'jessica': 'JESSICA - Joint European Support for Sustainable Investment in City Areas',
            'flag': 'FLAG - Financial Instrument for the Environment',
            'fug': 'FUG - Fund for Urban Growth',
            'ubb': 'UBB - United Bulgarian Bank',
            'fsmc': 'FSMC - Financial Services and Markets Commission',
            'rbb': 'RBB - Regional Development Bank'
        };
        
        return creditors[loanType.toLowerCase()] || 'Unknown Creditor';
    }

    /**
     * Alternative parsing method for loan items
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @param {string} loanType - Loan type
     * @returns {Array} Array of loan items
     */
    parseLoanItemsAlternative(lines, year, loanType) {
        const items = [];
        let rowOrder = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for lines with project names and amounts
            const hasAmount = line.match(/\d[\d\s,.]*(?:лв|lv|bgn)/i);
            const hasYear = line.match(/\d{4}-\d{4}/);
            
            if (hasAmount || hasYear) {
                const amounts = this.extractAllAmounts(line);
                const dates = this.extractDateRange(line);
                
                // Extract purpose - remove codes, amounts, dates
                let purpose = line
                    .replace(/[A-Z]\d+-\d+/gi, '')
                    .replace(/\d[\d\s,.]*(?:лв|lv|bgn)?/gi, '')
                    .replace(/\d{4}-\d{4}/g, '')
                    .trim();
                
                // If purpose is too short, try next line
                if (purpose.length < 5 && i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (nextLine.length > 5 && !nextLine.match(/^\d/)) {
                        purpose = nextLine;
                        i++;
                    }
                }
                
                purpose = this.cleanItemName(purpose);
                
                if (purpose.length > 3 || amounts.length > 0) {
                    rowOrder++;
                    items.push({
                        loanType: loanType,
                        loanCode: null,
                        creditor: this.getCreditorName(loanType),
                        originalAmount: amounts[0] || null,
                        remainingAmount: amounts[1] || null,
                        interestRate: null,
                        startDate: dates.start,
                        endDate: dates.end,
                        purpose: purpose || 'Loan Payment',
                        monthlyPayment: amounts[2] || null,
                        year: year,
                        rowOrder: rowOrder
                    });
                }
            }
        }
        
        return items;
    }

    /**
     * Clean up item name
     * @param {string} name - Raw name
     * @returns {string} Cleaned name
     */
    cleanItemName(name) {
        return name
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-а-яА-Я]/g, ' ')
            .trim()
            .substring(0, 500);
    }

    /**
     * Get SQL insert statements for parsed data
     * @param {Object} parsedData - Data from parse() method
     * @param {string} documentId - UUID of the budget_documents record
     * @returns {Array} Array of {query, params} objects
     */
    getInsertStatements(parsedData, documentId) {
        const statements = [];
        
        for (const item of parsedData.items) {
            const query = `
                INSERT INTO budget_loans 
                (document_id, year, loan_type, loan_code, creditor, original_amount, 
                 remaining_amount, interest_rate, start_date, end_date, purpose, 
                 monthly_payment, row_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `;
            
            const params = [
                documentId,
                item.year,
                item.loanType,
                item.loanCode,
                item.creditor,
                item.originalAmount,
                item.remainingAmount,
                item.interestRate,
                item.startDate,
                item.endDate,
                item.purpose,
                item.monthlyPayment,
                item.rowOrder
            ];
            
            statements.push({ query, params });
        }
        
        return statements;
    }
}

module.exports = LoanParser;
