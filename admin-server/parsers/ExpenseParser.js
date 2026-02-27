/**
 * Expense Parser (pr2 - Разходи по дейности)
 * 
 * Parses budget expense documents by activity/function
 * Extracts function codes, program codes, and expense amounts
 */

const BaseParser = require('./BaseParser');

class ExpenseParser extends BaseParser {
    constructor() {
        super();
        this.documentType = 'expense';
    }

    /**
     * Parse expense document
     * @param {string} text - Raw text from PDF
     * @param {Object} metadata - Document metadata
     * @returns {Object} Parsed expense data
     */
    parse(text, metadata) {
        this.errors = [];
        this.warnings = [];
        
        const lines = this.extractLines(text);
        const year = metadata.year || this.extractYear(text) || new Date().getFullYear();
        
        // Extract title
        const title = this.extractTitle(lines);
        
        // Parse expense items
        const items = this.parseExpenseItems(lines, year);
        
        // Calculate totals
        const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        return {
            documentType: this.documentType,
            year: year,
            title: title,
            totalItems: items.length,
            totalAmount: totalAmount,
            items: items,
            rawText: text.substring(0, 5000),
            ...this.getResults()
        };
    }

    /**
     * Extract document title
     * @param {Array} lines - Document lines
     * @returns {string} Extracted title
     */
    extractTitle(lines) {
        const titlePatterns = [
            /приложение\s*№?\s*2/i,
            /разходи\s+по\s+дейности/i,
            /разходи/i,
            /бюджет/i
        ];
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            for (const pattern of titlePatterns) {
                if (pattern.test(line)) {
                    return line;
                }
            }
        }
        
        return 'Budget Expenses Document';
    }

    /**
     * Parse expense items from document
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @returns {Array} Array of expense items
     */
    parseExpenseItems(lines, year) {
        const items = [];
        let rowOrder = 0;
        let currentFunction = null;
        
        // Skip header lines
        let started = false;
        const startPatterns = [
            /функция|function/i,
            /програма|program/i,
            /разходи|expenses/i,
            /код|code/i
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if we've reached the data section
            if (!started) {
                for (const pattern of startPatterns) {
                    if (pattern.test(line)) {
                        started = true;
                        i += 2; // Skip header
                        break;
                    }
                }
                continue;
            }
            
            // Check for function header (e.g., "01 Общи държавни услуги")
            const functionMatch = line.match(/^(\d{2})\s+([А-Яа-яA-Za-z\s]+)$/);
            if (functionMatch && !line.match(/\d[\d\s,.]*лв/)) {
                currentFunction = {
                    code: functionMatch[1],
                    name: functionMatch[2].trim()
                };
                continue;
            }
            
            // Parse expense item
            const item = this.parseExpenseLine(line, currentFunction, year);
            if (item) {
                rowOrder++;
                item.rowOrder = rowOrder;
                items.push(item);
            }
        }
        
        // If no items found, try alternative method
        if (items.length === 0) {
            return this.parseExpenseItemsAlternative(lines, year);
        }
        
        return items;
    }

    /**
     * Parse a single expense line
     * @param {string} line - Current line
     * @param {Object} currentFunction - Current function context
     * @param {number} year - Document year
     * @returns {Object|null} Parsed item or null
     */
    parseExpenseLine(line, currentFunction, year) {
        // Look for patterns like:
        // "001 Общо управление 1234567.89"
        // "001 Общо управление 1234567.89 987654.32 246913.58..."
        
        const match = line.match(/^(\d{3})\s+(.+?)\s+(\d[\d\s,.]+)(?:\s+(\d[\d\s,.]+))?(?:\s+(\d[\d\s,.]+))?(?:\s+(\d[\d\s,.]+))?/);
        
        if (!match) return null;
        
        const programCode = match[1];
        const programName = match[2].trim();
        const amounts = match.slice(3).filter(a => a).map(a => this.parseNumber(a));
        
        return {
            functionCode: currentFunction?.code || null,
            functionName: currentFunction?.name || null,
            programCode: programCode,
            programName: this.cleanItemName(programName),
            amount: amounts[0] || null,
            amountPersonnel: amounts[1] || null,
            amountGoodsServices: amounts[2] || null,
            amountSubsidies: amounts[3] || null,
            amountCapital: amounts[4] || null,
            year: year
        };
    }

    /**
     * Alternative parsing method for expense items
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @returns {Array} Array of expense items
     */
    parseExpenseItemsAlternative(lines, year) {
        const items = [];
        let rowOrder = 0;
        let currentFunction = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Try to identify function headers
            const funcMatch = line.match(/^(\d{2})\s+([А-Яа-яA-Za-z\s]{10,})$/);
            if (funcMatch && !line.includes('лв')) {
                currentFunction = {
                    code: funcMatch[1],
                    name: funcMatch[2].trim()
                };
                continue;
            }
            
            // Try to parse program line
            const progMatch = line.match(/^(\d{3})\s+(.+)$/);
            if (progMatch) {
                const programCode = progMatch[1];
                const rest = progMatch[2];
                
                // Split by multiple spaces to separate name from amounts
                const parts = rest.split(/\s{2,}/);
                if (parts.length >= 2) {
                    const programName = this.cleanItemName(parts[0]);
                    const amounts = parts.slice(1).map(p => this.parseNumber(p)).filter(n => n !== null);
                    
                    if (programName && programName.length > 3) {
                        rowOrder++;
                        items.push({
                            functionCode: currentFunction?.code || null,
                            functionName: currentFunction?.name || null,
                            programCode: programCode,
                            programName: programName,
                            amount: amounts[0] || null,
                            amountPersonnel: amounts[1] || null,
                            amountGoodsServices: amounts[2] || null,
                            amountSubsidies: amounts[3] || null,
                            amountCapital: amounts[4] || null,
                            year: year,
                            rowOrder: rowOrder
                        });
                    }
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
                INSERT INTO budget_expenses 
                (document_id, year, function_code, function_name, program_code, program_name, 
                 amount, amount_personnel, amount_goods_services, amount_subsidies, amount_capital, row_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `;
            
            const params = [
                documentId,
                item.year,
                item.functionCode,
                item.functionName,
                item.programCode,
                item.programName,
                item.amount,
                item.amountPersonnel,
                item.amountGoodsServices,
                item.amountSubsidies,
                item.amountCapital,
                item.rowOrder
            ];
            
            statements.push({ query, params });
        }
        
        return statements;
    }
}

module.exports = ExpenseParser;
