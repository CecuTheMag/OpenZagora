/**
 * Income Parser (pr1 - Приходи)
 * 
 * Parses budget income/revenue documents
 * Extracts income categories, codes, and amounts
 */

const BaseParser = require('./BaseParser');

class IncomeParser extends BaseParser {
    constructor() {
        super();
        this.documentType = 'income';
    }

    /**
     * Parse income document
     * @param {string} text - Raw text from PDF
     * @param {Object} metadata - Document metadata
     * @returns {Object} Parsed income data
     */
    parse(text, metadata) {
        this.errors = [];
        this.warnings = [];
        
        const lines = this.extractLines(text);
        const year = metadata.year || this.extractYear(text) || new Date().getFullYear();
        
        // Extract title from first few lines
        const title = this.extractTitle(lines);
        
        // Parse income items
        const items = this.parseIncomeItems(lines, year);
        
        // Calculate totals
        const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        return {
            documentType: this.documentType,
            year: year,
            title: title,
            totalItems: items.length,
            totalAmount: totalAmount,
            items: items,
            rawText: text.substring(0, 5000), // Store first 5000 chars
            ...this.getResults()
        };
    }

    /**
     * Extract document title
     * @param {Array} lines - Document lines
     * @returns {string} Extracted title
     */
    extractTitle(lines) {
        // Look for title in first 5 lines
        const titlePatterns = [
            /приложение\s*№?\s*1/i,
            /приходи/i,
            /бюджет/i,
            /община\s+стара\s+загора/i
        ];
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            for (const pattern of titlePatterns) {
                if (pattern.test(line)) {
                    // Return this line plus next if it's a continuation
                    if (i + 1 < lines.length && lines[i + 1].length < 100) {
                        return `${line} ${lines[i + 1]}`.trim();
                    }
                    return line;
                }
            }
        }
        
        return 'Budget Income Document';
    }

    /**
     * Parse income items from document
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @returns {Array} Array of income items
     */
    parseIncomeItems(lines, year) {
        const items = [];
        let rowOrder = 0;
        
        // Patterns for income item detection
        const itemPatterns = [
            // Code + Name + Amount pattern
            /^(\d{2,3})\s+(.+?)\s+(\d[\d\s,.]+)\s*(?:лв|lv|bgn)?$/i,
            // Code at start, amount at end
            /^(\d{2,3})\s+(.+?)\s+(\d[\d\s,.]+)$/,
            // Just code and name (amount on next line)
            /^(\d{2,3})\s+(.+)$/
        ];
        
        // Skip header lines
        let started = false;
        const startPatterns = [
            /код|code/i,
            /наименование|name/i,
            /приходи|income/i,
            /раздел|section/i
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if we've reached the data section
            if (!started) {
                for (const pattern of startPatterns) {
                    if (pattern.test(line)) {
                        started = true;
                        // Skip a few more header lines
                        i += 2;
                        break;
                    }
                }
                continue;
            }
            
            // Try to parse income item
            const item = this.parseIncomeLine(line, lines[i + 1], year);
            
            if (item) {
                rowOrder++;
                item.rowOrder = rowOrder;
                items.push(item);
                
                // If we used the next line for amount, skip it
                if (item._usedNextLine) {
                    i++;
                }
            }
        }
        
        // If no items found with structured parsing, try alternative method
        if (items.length === 0) {
            return this.parseIncomeItemsAlternative(lines, year);
        }
        
        return items;
    }

    /**
     * Parse a single income line
     * @param {string} line - Current line
     * @param {string} nextLine - Next line (for multi-line items)
     * @param {number} year - Document year
     * @returns {Object|null} Parsed item or null
     */
    parseIncomeLine(line, nextLine, year) {
        // Try to match income code pattern (01, 02, 03, etc.)
        const codeMatch = line.match(/^(\d{2,3})\s+(.+)$/);
        if (!codeMatch) return null;
        
        const code = codeMatch[1];
        let name = codeMatch[2].trim();
        let amount = null;
        let amountPrevious = null;
        let amountPlan = null;
        
        // Try to extract amount from current line
        const amountMatch = name.match(/(.+?)\s+(\d[\d\s,.]+)\s*(?:лв|lv|bgn)?$/i);
        if (amountMatch) {
            name = amountMatch[1].trim();
            amount = this.parseNumber(amountMatch[2]);
        } else if (nextLine) {
            // Try to get amount from next line
            const nextAmount = this.extractAmount(nextLine);
            if (nextAmount !== null && nextAmount > 1000) { // Sanity check
                amount = nextAmount;
                // Mark that we used next line
                return {
                    code: code,
                    name: name,
                    amount: amount,
                    amountPreviousYear: null,
                    amountPlan: null,
                    year: year,
                    _usedNextLine: true
                };
            }
        }
        
        // Clean up name
        name = this.cleanItemName(name);
        
        return {
            code: code,
            name: name,
            amount: amount,
            amountPreviousYear: amountPrevious,
            amountPlan: amountPlan,
            year: year
        };
    }

    /**
     * Alternative parsing method for income items
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @returns {Array} Array of income items
     */
    parseIncomeItemsAlternative(lines, year) {
        const items = [];
        let rowOrder = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for lines starting with 2-3 digit codes
            const match = line.match(/^(\d{2,3})\s+(.+)$/);
            if (!match) continue;
            
            const code = match[1];
            const rest = match[2];
            
            // Try to extract name and amount
            const parts = rest.split(/\s{2,}/);
            if (parts.length >= 2) {
                const name = this.cleanItemName(parts[0]);
                const amount = this.parseNumber(parts[parts.length - 1]);
                
                if (name && name.length > 2) {
                    rowOrder++;
                    items.push({
                        code: code,
                        name: name,
                        amount: amount,
                        amountPreviousYear: null,
                        amountPlan: null,
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
            .substring(0, 500); // Limit length
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
                INSERT INTO budget_income 
                (document_id, year, code, name, amount, amount_previous_year, amount_plan, row_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `;
            
            const params = [
                documentId,
                item.year,
                item.code,
                item.name,
                item.amount,
                item.amountPreviousYear,
                item.amountPlan,
                item.rowOrder
            ];
            
            statements.push({ query, params });
        }
        
        return statements;
    }
}

module.exports = IncomeParser;
