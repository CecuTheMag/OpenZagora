/**
 * EOP Data Fetcher
 * Fetches tender data from EOP API and saves to JSON file
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class EOPDataFetcher {
  constructor() {
    this.baseUrl = 'https://service.eop.bg/NX1Service.svc/GetPublicBuyerProfileTendersBySpecified';
    this.organizationId = 21609;
    this.batchSize = 100;
    this.totalRecords = 627;
    this.dataDir = path.join(__dirname, '../data');
    this.jsonFilePath = path.join(this.dataDir, 'tenders_stara_zagora.json');
    
    this.headers = {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    };
  }

  /**
   * Fetch all tenders from EOP API
   */
  async fetchTenders() {
    const allTenders = [];
    
    for (let startIdx = 1; startIdx <= this.totalRecords; startIdx += this.batchSize) {
      const endIdx = Math.min(startIdx + this.batchSize - 1, this.totalRecords);
      
      const payload = {
        searchParameters: {
          StartIndex: startIdx,
          EndIndex: endIdx,
          PropertyFilters: [],
          SearchText: null,
          SearchProperty: null,
          OrderAscending: false,
          OrderColumn: 'CreatedDate',
          Keywords: [],
          UserId: null
        },
        organizationId: this.organizationId
      };
      
      console.log(`Fetching tenders ${startIdx}-${endIdx}...`);
      
      try {
        const response = await axios.post(this.baseUrl, payload, {
          headers: this.headers,
          timeout: 30000
        });
        
        const tenders = response.data?.CurrentPageResults || [];
        allTenders.push(...tenders);
        
        console.log(`✓ Got ${tenders.length} tenders`);
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`✗ Error fetching batch ${startIdx}-${endIdx}:`, error.message);
        continue;
      }
    }
    
    return allTenders;
  }

  /**
   * Parse date from /Date(timestamp)/ format
   */
  parseDate(dateStr) {
    try {
      if (dateStr && dateStr.includes('Date(')) {
        const timestamp = parseInt(dateStr.split('(')[1].split(')')[0]) / 1000;
        return new Date(timestamp * 1000).toISOString();
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return dateStr;
  }

  /**
   * Clean and format tender data
   */
  cleanTenders(tenders) {
    return tenders.map(tender => ({
      id: tender.Id,
      tenderId: tender.TenderId,
      name: tender.TenderName,
      description: tender.TenderDescription,
      specialNumber: tender.SpecialNumber,
      status: tender.Status,
      createdDate: this.parseDate(tender.CreatedDate),
      publishedDate: this.parseDate(tender.PublicationDate),
      deadline: this.parseDate(tender.Deadline),
      procedureType: tender.ProcedureType,
      isEUFunding: tender.IsEUFunding,
      isFrameworkAgreement: tender.IsFrameworkAgreement,
      isGreenCriteria: tender.IsGreenCriteria,
      organizationId: tender.OrganizationId,
      guid: tender.Guid
    }));
  }

  /**
   * Save data to JSON file
   */
  async saveToJson(data) {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });
    
    await fs.writeFile(
      this.jsonFilePath, 
      JSON.stringify(data, null, 2), 
      'utf8'
    );
    
    console.log(`✓ Saved ${data.length} tenders to ${this.jsonFilePath}`);
    console.log(`File size: ${(JSON.stringify(data).length / 1024).toFixed(2)} KB`);
  }

  /**
   * Main fetch and save process
   */
  async fetchAndSave() {
    try {
      console.log(`🚀 Fetching all ${this.totalRecords} tenders from Stara Zagora...`);
      
      // Fetch raw tenders
      const rawTenders = await this.fetchTenders();
      console.log(`📊 Retrieved ${rawTenders.length} tenders total`);
      
      // Clean and format
      console.log('Processing tenders...');
      const cleanedTenders = this.cleanTenders(rawTenders);
      
      // Save to JSON
      await this.saveToJson(cleanedTenders);
      
      return {
        success: true,
        total: cleanedTenders.length,
        filePath: this.jsonFilePath
      };
      
    } catch (error) {
      console.error('❌ Fetch process failed:', error);
      throw error;
    }
  }

  /**
   * Get existing JSON data
   */
  async getExistingData() {
    try {
      const data = await fs.readFile(this.jsonFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new EOPDataFetcher();