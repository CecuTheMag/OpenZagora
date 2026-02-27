/**
 * Indicator Parser (pr9+ - Индикативни разчети)
 * 
 * Parses budget indicator documents (d122, d332, d369, d532, d538, etc.)
 * These are detailed budget calculations by department/indicator
 */

const BaseParser = require('./BaseParser');

class IndicatorParser extends BaseParser {
    constructor() {
        super();
        this.documentType = 'indicator';
    }

    /**
     * Parse indicator document
     * @param {string} text - Raw text from PDF
     * @param {Object} metadata - Document metadata
     * @returns {Object} Parsed indicator data
     */
    parse(text, metadata) {
        this.errors = [];
        this.warnings = [];
        
        const lines = this.extractLines(text);
        const year = metadata.year || this.extractYear(text) || new Date().getFullYear();
        const indicatorCode = metadata.subtype || this.extractIndicatorCode(text) || 'unknown';
        
        // Extract title
        const title = this.extractTitle(lines, indicatorCode);
        
        // Parse indicator items
        const items = this.parseIndicatorItems(lines, year, indicatorCode);
        
        // Calculate totals
        const totalApproved = items.reduce((sum, item) => sum + (item.amountApproved || 0), 0);
        const totalExecuted = items.reduce((sum, item) => sum + (item.amountExecuted || 0), 0);
        
        return {
            documentType: this.documentType,
            indicatorCode: indicatorCode,
            year: year,
            title: title,
            totalItems: items.length,
            totalApproved: totalApproved,
            totalExecuted: totalExecuted,
            items: items,
            rawText: text.substring(0, 5000),
            ...this.getResults()
        };
    }

    /**
     * Extract indicator code from text or filename
     * @param {string} text - Text to search
     * @returns {string|null} Indicator code or null
     */
    extractIndicatorCode(text) {
        const match = text.match(/d(\d{3})/i);
        return match ? `d${match[1]}` : null;
    }

    /**
     * Extract document title
     * @param {Array} lines - Document lines
     * @param {string} indicatorCode - Indicator code
     * @returns {string} Extracted title
     */
    extractTitle(lines, indicatorCode) {
        const titlePatterns = [
            /индикативен\s+разчет/i,
            /индикативни\s+разчети/i,
            /бюджет/i,
            new RegExp(`d${indicatorCode}`, 'i')
        ];
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            for (const pattern of titlePatterns) {
                if (pattern.test(line)) {
                    return line;
                }
            }
        }
        
        return `Budget Indicator ${indicatorCode}`;
    }

    /**
     * Parse indicator items from document
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @param {string} indicatorCode - Indicator code
     * @returns {Array} Array of indicator items
     */
    parseIndicatorItems(lines, year, indicatorCode) {
        const items = [];
        let rowOrder = 0;
        
        // Skip header lines
        let started = false;
        const startPatterns = [
            /код|code/i,
            /наименование|name/i,
            /разчет|calculation/i,
            /отдел|department/i
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
            
            // Parse indicator item
            const item = this.parseIndicatorLine(line, year, indicatorCode);
            if (item) {
                rowOrder++;
                item.rowOrder = rowOrder;
                items.push(item);
            }
        }
        
        // If no items found, try alternative method
        if (items.length === 0) {
            return this.parseIndicatorItemsAlternative(lines, year, indicatorCode);
        }
        
        return items;
    }

    /**
     * Parse a single indicator line
     * @param {string} line - Current line
     * @param {number} year - Document year
     * @param {string} indicatorCode - Indicator code
     * @returns {Object|null} Parsed item or null
     */
    parseIndicatorLine(line, year, indicatorCode) {
        // Look for patterns with department codes and amounts
        // Common patterns in Bulgarian budget documents:
        // "001 Община Стара Загора 1234567.89 987654.32 246913.57"
        
        const match = line.match(/^(\d{3})\s+(.+?)\s+(\d[\d\s,.]+)(?:\s+(\d[\d\s,.]+))?(?:\s+(\d[\d\s,.]+))?/);
        
        if (!match) return null;
        
        const deptCode = match[1];
        const deptName = match[2].trim();
        const amounts = match.slice(3).filter(a => a).map(a => this.parseNumber(a));
        
        return {
            indicatorCode: indicatorCode,
            indicatorName: this.getIndicatorName(indicatorCode),
            departmentCode: deptCode,
            departmentName: this.cleanItemName(deptName),
            budgetChapter: null, // Could be extracted from context
            amountApproved: amounts[0] || null,
            amountExecuted: amounts[1] || null,
            amountRemaining: amounts[2] || null,
            percentageExecuted: amounts[1] && amounts[0] ? 
                Math.round((amounts[1] / amounts[0]) * 100) : null,
            year: year
        };
    }

    /**
     * Alternative parsing method for indicator items
     * @param {Array} lines - Document lines
     * @param {number} year - Document year
     * @param {string} indicatorCode - Indicator code
     * @returns {Array} Array of indicator items
     */
    parseIndicatorItemsAlternative(lines, year, indicatorCode) {
        const items = [];
        let rowOrder = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for lines starting with 3-digit codes
            const match = line.match(/^(\d{3})\s+(.+)$/);
            if (!match) continue;
            
            const deptCode = match[1];
            const rest = match[2];
            
            // Split by multiple spaces
            const parts = rest.split(/\s{2,}/);
            if (parts.length >= 2) {
                const deptName = this.cleanItemName(parts[0]);
                const amounts = parts.slice(1)
                    .map(p => this.parseNumber(p))
                    .filter(n => n !== null && n > 1000); // Filter small numbers
                
                if (deptName && deptName.length > 3) {
                    rowOrder++;
                    items.push({
                        indicatorCode: indicatorCode,
                        indicatorName: this.getIndicatorName(indicatorCode),
                        departmentCode: deptCode,
                        departmentName: deptName,
                        budgetChapter: null,
                        amountApproved: amounts[0] || null,
                        amountExecuted: amounts[1] || null,
                        amountRemaining: amounts[2] || null,
                        percentageExecuted: amounts[1] && amounts[0] ? 
                            Math.round((amounts[1] / amounts[0]) * 100) : null,
                        year: year,
                        rowOrder: rowOrder
                    });
                }
            }
        }
        
        return items;
    }

    /**
     * Get human-readable indicator name
     * @param {string} code - Indicator code
     * @returns {string} Indicator name
     */
    getIndicatorName(code) {
        const names = {
            'd122': 'Administrative Services',
            'd332': 'Social Services',
            'd369': 'Education',
            'd532': 'Healthcare',
            'd538': 'Culture',
            'd589': 'Sports',
            'd619': 'Transport',
            'd621': 'Environment',
            'd629': 'Public Safety',
            'd849': 'Economic Development',
            'd898': 'Infrastructure',
            'd326': 'Social Assistance',
            'd606': 'Housing',
            'd714': 'Energy',
            'd746': 'Water Supply',
            'd752': 'Waste Management',
            'd759': 'Public Works',
            'd540': 'Youth Programs'
        };
        
        return names[code] || `Indicator ${code}`;
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
                INSERT INTO budget_indicators 
                (document_id, year, indicator_code, indicator_name, department_code, department_name,
                 budget_chapter, amount_approved, amount_executed, amount_remaining, 
                 percentage_executed, row_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `;
            
            const params = [
                documentId,
                item.year,
                item.indicatorCode,
                item.indicatorName,
                item.departmentCode,
                item.departmentName,
                item.budgetChapter,
                item.amountApproved,
                item.amountExecuted,
                item.amountRemaining,
                item.percentageExecuted,
                item.rowOrder
            ];
            
            statements.push({ query, params });
        }
        
        return statements;
    }
}

module.exports = IndicatorParser;
