/**
 * data.egov.bg API Client
 * Fetches open government data for Stara Zagora region
 */

const axios = require('axios');

const EGOV_BASE_URL = 'https://data.egov.bg/api/3/action';

class EgovApiClient {
    constructor() {
        this.client = axios.create({
            baseURL: EGOV_BASE_URL,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OpenZagora/1.0'
            }
        });
    }

    /**
     * Search for datasets related to Stara Zagora
     */
    async searchDatasets(query = 'Стара Загора', limit = 50) {
        try {
            const response = await this.client.get('/package_search', {
                params: { q: query, limit }
            });
            
            if (response.data?.success && response.data?.result?.results) {
                return response.data.result.results.map(this.transformDataset);
            }
            
            return [];
        } catch (error) {
            console.error('Error searching e-gov datasets:', error.message);
            return [];
        }
    }

    /**
     * Get specific dataset by name
     */
    async getDataset(datasetName) {
        try {
            const response = await this.client.get('/package_show', {
                params: { id: datasetName }
            });
            
            if (response.data?.success && response.data?.result) {
                return this.transformDataset(response.data.result);
            }
            
            return null;
        } catch (error) {
            console.error(`Error fetching dataset ${datasetName}:`, error.message);
            return null;
        }
    }

    /**
     * Get all available packages/datasets
     */
    async getAllDatasets(limit = 100) {
        try {
            const response = await this.client.get('/package_list', {
                params: { limit }
            });
            
            if (response.data?.success && response.data?.result) {
                return response.data.result;
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching package list:', error.message);
            return [];
        }
    }

    /**
     * Get all resources for a dataset
     */
    async getDatasetResources(datasetName) {
        try {
            const dataset = await this.getDataset(datasetName);
            return dataset?.resources || [];
        } catch (error) {
            console.error(`Error fetching resources for ${datasetName}:`, error.message);
            return [];
        }
    }

    /**
     * Transform dataset to our format
     */
    transformDataset(dataset) {
        return {
            external_id: dataset.id,
            dataset_name: dataset.name,
            title: dataset.title,
            description: dataset.notes,
            category: dataset.groups?.[0]?.name || 'general',
            source_url: dataset.url,
            resources: (dataset.resources || []).map(r => ({
                name: r.name,
                format: r.format,
                url: r.url,
                description: r.description
            })),
            tags: dataset.tags || [],
            created: dataset.created,
            modified: dataset.metadata_modified
        };
    }

    /**
     * Get all relevant Stara Zagora datasets
     */
    async getStaraZagoraData() {
        const datasets = await this.searchDatasets('Стара Загора', 50);
        
        return datasets || [];
    }
}

module.exports = new EgovApiClient();

