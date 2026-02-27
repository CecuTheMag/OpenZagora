/**
 * Parsers Index
 * 
 * Exports all parsers and provides factory function
 */

const DocumentClassifier = require('./DocumentClassifier');
const IncomeParser = require('./IncomeParser');
const ExpenseParser = require('./ExpenseParser');
const IndicatorParser = require('./IndicatorParser');
const LoanParser = require('./LoanParser');

// Parser registry
const parsers = {
    income: IncomeParser,
    expense: ExpenseParser,
    indicator: IndicatorParser,
    loan: LoanParser
};

/**
 * Get appropriate parser for document type
 * @param {string} documentType - Document type from classifier
 * @returns {BaseParser|null} Parser instance or null
 */
function getParser(documentType) {
    const ParserClass = parsers[documentType];
    if (ParserClass) {
        return new ParserClass();
    }
    return null;
}

/**
 * Parse a document using appropriate parser
 * @param {string} text - Raw text from PDF
 * @param {Object} metadata - Document metadata from classifier
 * @returns {Object} Parsed data
 */
function parseDocument(text, metadata) {
    const parser = getParser(metadata.type);
    
    if (!parser) {
        return {
            success: false,
            errors: [`No parser available for document type: ${metadata.type}`],
            warnings: [],
            documentType: metadata.type,
            items: []
        };
    }
    
    return parser.parse(text, metadata);
}

/**
 * Get SQL statements for parsed data
 * @param {Object} parsedData - Data from parse() method
 * @param {string} documentId - UUID of budget_documents record
 * @returns {Array} Array of {query, params} objects
 */
function getInsertStatements(parsedData, documentId) {
    const parser = getParser(parsedData.documentType);
    
    if (!parser || !parser.getInsertStatements) {
        return [];
    }
    
    return parser.getInsertStatements(parsedData, documentId);
}

module.exports = {
    DocumentClassifier,
    IncomeParser,
    ExpenseParser,
    IndicatorParser,
    LoanParser,
    getParser,
    parseDocument,
    getInsertStatements
};
