/**
 * Document Classifier
 * 
 * Identifies budget document type based on filename patterns
 * Supports Bulgarian municipal budget documents from Stara Zagora
 */

class DocumentClassifier {
    constructor() {
        // Document type patterns based on filename analysis
        this.patterns = {
            // Income documents (pr1, prihodi)
            income: {
                regex: /(?:^|\s|_)(?:pr\s*1|prihodi|приходи|pr1|income)(?:\s|_|\.|$)/i,
                type: 'income',
                subtype: 'pr1',
                description: 'Budget Income (Приходи)'
            },
            
            // Expense documents (pr2, razhodi, razhod)
            expenses: {
                regex: /(?:^|\s|_)(?:pr\s*2|razhodi|разходи|razhod|expenses?)(?:\s|_|\.|$)/i,
                type: 'expense',
                subtype: 'pr2',
                description: 'Budget Expenses by Activity (Разходи по дейности)'
            },
            
            // Transitional balance (pr3)
            transitional: {
                regex: /(?:^|\s|_)(?:pr\s*3|prehoden|преходен|ostatyk|остатък|transitional)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'pr3',
                description: 'Transitional Balance'
            },
            
            // Capital expenditures (pr4, KV)
            capital: {
                regex: /(?:^|\s|_)(?:pr\s*4|kv|кв|capital)(?:\s|_|\.|$)/i,
                type: 'expense',
                subtype: 'pr4',
                description: 'Capital Expenditures (КВ)'
            },
            
            // Targeted subsidy (pr5, celeva subsidiq)
            subsidy: {
                regex: /(?:^|\s|_)(?:pr\s*5|celeva|целева|subsidia|subsidy)(?:\s|_|\.|$)/i,
                type: 'expense',
                subtype: 'pr5',
                description: 'Targeted Subsidy (Целева субсидия)'
            },
            
            // Loan repayments (pr6)
            loanRepayment: {
                regex: /(?:^|\s|_)(?:pr\s*6|pogasheniq|погашения|repayment)(?:\s|_|\.|$)/i,
                type: 'loan',
                subtype: 'pr6',
                description: 'Loan Repayments'
            },
            
            // Transitional targeted (pr7)
            transitionalTargeted: {
                regex: /(?:^|\s|_)(?:pr\s*7|celeva\s*prehodna)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'pr7',
                description: 'Transitional Targeted Subsidy'
            },
            
            // Section 40 (pr8)
            section40: {
                regex: /(?:^|\s|_)(?:pr\s*8|§\s*40|paragraf\s*40|чл\s*40)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'pr8',
                description: 'Section 40 (§40)'
            },
            
            // Indicators - various codes (pr9+)
            indicators: {
                regex: /(?:^|\s|_)(?:pr\s*(?:9|[1-9]\d)|indik|индик|razchet|разчет|d\d{3})(?:\s|_|\.|$)/i,
                type: 'indicator',
                subtype: null, // Will be extracted from filename
                description: 'Budget Indicators'
            },
            
            // Loans (ZAEM)
            loans: {
                regex: /(?:^|\s|_)(?:zaem|заем|loan|credit)(?:\s|_|\.|$)/i,
                type: 'loan',
                subtype: 'zaem',
                description: 'Loans (Заеми)'
            },
            
            // Municipal spending (FUG)
            municipal: {
                regex: /(?:^|\s|_)(?:fug|фуг|municipal)(?:\s|_|\.|$)/i,
                type: 'expense',
                subtype: 'fug',
                description: 'Municipal Spending (ФУГ)'
            },
            
            // Mayor offices plan (kmetstva)
            mayorOffices: {
                regex: /(?:^|\s|_)(?:kmetstva|кметства|mayor)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'kmetstva',
                description: 'Mayor Offices Plan'
            },
            
            // Payment schedule
            paymentSchedule: {
                regex: /(?:^|\s|_)(?:plan\s*grafik|план\s*график|razplashtane|разплащане)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'payment_schedule',
                description: 'Payment Schedule'
            },
            
            // Forecast/Projection (Prognoza)
            forecast: {
                regex: /(?:^|\s|_)(?:prognoza|прогноза|forecast|projection)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'forecast',
                description: 'Budget Forecast'
            },
            
            // Public discussion protocol
            protocol: {
                regex: /(?:^|\s|_)(?:protokol|протокол|obsazhdane|обсъждане)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'protocol',
                description: 'Public Discussion Protocol'
            },
            
            // Distributors (razporediteli)
            distributors: {
                regex: /(?:^|\s|_)(?:razporediteli|разпоредители|distributors)(?:\s|_|\.|$)/i,
                type: 'other',
                subtype: 'razporediteli',
                description: 'Budget Distributors'
            }
        };
    }

    /**
     * Classify a document based on its filename
     * @param {string} filename - The filename to classify
     * @returns {Object} Classification result with type, subtype, year, etc.
     */
    classify(filename) {
        const normalizedName = filename.toLowerCase();
        const result = {
            filename: filename,
            type: 'unknown',
            subtype: null,
            year: this.extractYear(filename),
            description: 'Unknown Document',
            confidence: 0
        };

        // Try to match against all patterns
        for (const [key, pattern] of Object.entries(this.patterns)) {
            if (pattern.regex.test(normalizedName)) {
                result.type = pattern.type;
                result.subtype = pattern.subtype;
                result.description = pattern.description;
                result.confidence = 0.8; // High confidence for pattern match
                
                // For indicators, try to extract the specific code
                if (result.type === 'indicator') {
                    const indicatorMatch = filename.match(/d(\d{3})/i);
                    if (indicatorMatch) {
                        result.subtype = `d${indicatorMatch[1]}`;
                        result.description = `Budget Indicator d${indicatorMatch[1]}`;
                    }
                }
                
                // For loans, try to extract loan type
                if (result.type === 'loan') {
                    const loanTypes = ['JESSICA', 'FLAG', 'FUG', 'UBB', 'FSMC'];
                    for (const loanType of loanTypes) {
                        if (normalizedName.includes(loanType.toLowerCase())) {
                            result.subtype = loanType.toLowerCase();
                            result.description = `${loanType} Loan`;
                            break;
                        }
                    }
                }
                
                break; // Stop at first match
            }
        }

        // If no pattern matched, try to extract year at least
        if (result.type === 'unknown') {
            result.confidence = 0.1;
        }

        return result;
    }

    /**
     * Extract year from filename
     * @param {string} filename - The filename to extract year from
     * @returns {number|null} The extracted year or null
     */
    extractYear(filename) {
        // Look for 4-digit year patterns (2020-2030)
        const yearMatch = filename.match(/\b(20[2-3]\d)\b/);
        if (yearMatch) {
            return parseInt(yearMatch[1]);
        }
        
        // Look for 2-digit year patterns and convert
        const shortYearMatch = filename.match(/\b([2-3]\d)\b/);
        if (shortYearMatch) {
            const shortYear = parseInt(shortYearMatch[1]);
            if (shortYear >= 20 && shortYear <= 35) {
                return 2000 + shortYear;
            }
        }
        
        return null;
    }

    /**
     * Get all supported document types
     * @returns {Array} List of supported document types
     */
    getSupportedTypes() {
        return Object.keys(this.patterns).map(key => ({
            key: key,
            ...this.patterns[key]
        }));
    }

    /**
     * Batch classify multiple files
     * @param {Array} filenames - Array of filenames to classify
     * @returns {Array} Array of classification results
     */
    batchClassify(filenames) {
        return filenames.map(filename => this.classify(filename));
    }
}

module.exports = DocumentClassifier;
