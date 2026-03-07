/**
 * ЦАИС ЕОП Scraper
 * Scrapes public procurement data from eop.bg
 * 
 * Note: This scraper is for educational/research purposes.
 * Always respect the website's terms of service and robots.txt.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Base URL for ЦАИС ЕОП
const EOP_BASE_URL = 'https://app.eop.bg';

// Search URLs
const EOP_SEARCH_URL = `${EOP_BASE_URL}/tender`;

class EOPScraper {
    constructor() {
        this.client = axios.create({
            baseURL: EOP_BASE_URL,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
            }
        });
    }

    /**
     * Fetch tender search results page
     */
    async fetchTenders(page = 1, status = 'active') {
        try {
            // Try to get data from the today page which lists all tenders
            const response = await this.client.get('/today', {
                params: { page }
            });
            
            return this.parseTenderList(response.data);
        } catch (error) {
            console.error('Error fetching tenders:', error.message);
            return [];
        }
    }

    /**
     * Parse tender list HTML
     */
    parseTenderList(html) {
        const $ = cheerio.load(html);
        const tenders = [];
        
        // Try multiple selectors for tender rows
        const rows = $('table tbody tr, .tender-row, .result-row, [class*="tender"]');
        
        rows.each((index, row) => {
            try {
                const tender = this.parseTenderRow($, row);
                if (tender && tender.title) {
                    tenders.push(tender);
                }
            } catch (e) {
                // Skip invalid rows
            }
        });
        
        // If no structured data found, try to extract from links
        if (tenders.length === 0) {
            $('a[href*="/tender/"]').each((i, link) => {
                const href = $(link).attr('href');
                const title = $(link).text().trim();
                
                if (title && href) {
                    const eopId = this.extractTenderId(href);
                    if (eopId) {
                        tenders.push({
                            eop_id: eopId,
                            source_url: `${EOP_BASE_URL}${href}`,
                            title: title.substring(0, 500)
                        });
                    }
                }
            });
        }
        
        return tenders;
    }

    /**
     * Parse individual tender row
     */
    parseTenderRow($, row) {
        const $row = $(row);
        
        // Extract tender ID from various sources
        let eopId = null;
        let link = $row.find('a[href*="/tender"]').first();
        
        if (link.length) {
            const href = link.attr('href');
            eopId = this.extractTenderId(href);
        }
        
        if (!eopId) {
            // Try to get from data attributes
            eopId = $row.attr('data-id') || $row.attr('data-tender-id');
        }
        
        const title = $row.find('td:nth-child(2), .title, [class*="title"]').first().text().trim() 
            || $row.find('a').first().text().trim();
        
        if (!title) return null;
        
        // Extract budget
        let budget = null;
        const budgetText = $row.find('td:nth-child(4), .budget, [class*="budget"]').text();
        if (budgetText) {
            budget = this.parseBudget(budgetText);
        }
        
        // Extract status
        let status = 'active';
        const statusText = $row.find('td:nth-child(5), .status, [class*="status"]').text().toLowerCase();
        if (statusText.includes('закрит') || statusText.includes('closed')) {
            status = 'completed';
        } else if (statusText.includes('чернова') || statusText.includes('draft')) {
            status = 'planned';
        }
        
        return {
            eop_id: eopId || `tender-${Date.now()}`,
            source_url: link.length ? `${EOP_BASE_URL}${link.attr('href')}` : `${EOP_BASE_URL}/tender/${eopId}`,
            title: title.substring(0, 1000),
            status,
            budget,
            currency: 'BGN'
        };
    }

    /**
     * Extract tender ID from URL
     */
    extractTenderId(url) {
        if (!url) return null;
        
        // Match patterns like /tender/123456 or tenderId=123456
        const match = url.match(/\/tender[\/=](\d+)/) 
            || url.match(/tender-(\d+)/)
            || url.match(/(\d{5,})/);
        
        return match ? match[1] : null;
    }

    /**
     * Parse budget string to number
     */
    parseBudget(text) {
        if (!text) return null;
        
        // Remove currency symbols and spaces
        const cleaned = text.replace(/[^\d.,]/g, '').replace(/\s/g, '');
        
        // Handle Bulgarian number format (1 234 567,89 -> 1234567.89)
        const normalized = cleaned.replace(/(\d)\.(\d{3})/g, '$1$2').replace(',', '.');
        
        const budget = parseFloat(normalized);
        return isNaN(budget) ? null : budget;
    }

    /**
     * Fetch detailed tender information
     */
    async fetchTenderDetails(tenderId) {
        try {
            const response = await this.client.get(`/tender/${tenderId}`);
            return this.parseTenderDetails(response.data);
        } catch (error) {
            console.error(`Error fetching tender ${tenderId}:`, error.message);
            return null;
        }
    }

    /**
     * Parse tender details page
     */
    parseTenderDetails(html) {
        const $ = cheerio.load(html);
        const details = {};
        
        // Extract various fields based on common patterns
        $('table td, .detail-row, [class*="detail"]').each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            const label = $el.prev().text().trim().toLowerCase();
            
            if (label.includes('номер') || text.includes('П003')) {
                details.eop_id = text;
            } else if (label.includes('наименование') || label.includes('title')) {
                details.title = text;
            } else if (label.includes('стартова') || label.includes('budget')) {
                details.budget = this.parseBudget(text);
            } else if (label.includes('изпълнител') || label.includes('contractor')) {
                details.contractor = text;
            } else if (label.includes('срок') || label.includes('deadline')) {
                details.end_date = this.parseDate(text);
            }
        });
        
        return details;
    }

    /**
     * Parse Bulgarian date format
     */
    parseDate(text) {
        if (!text) return null;
        
        // Bulgarian format: DD.MM.YYYY or DD-MM-YYYY
        const match = text.match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/);
        if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        
        return null;
    }

    /**
     * Search tenders by keyword
     */
    async searchTenders(keyword, limit = 50) {
        try {
            const response = await this.client.get('/search', {
                params: { 
                    q: keyword,
                    limit 
                }
            });
            
            return this.parseTenderList(response.data);
        } catch (error) {
            console.error('Error searching tenders:', error.message);
            return [];
        }
    }

}

module.exports = new EOPScraper();

