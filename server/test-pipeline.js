// Quick test script to check data pipeline
const dataPipeline = require('./services/dataPipeline');

(async () => {
    console.log('Testing data pipeline...\n');
    
    try {
        // Test OSM fetch
        console.log('1. Testing OSM fetch...');
        const osmResult = await dataPipeline.fetchOsmData();
        console.log('OSM Result:', osmResult);
        
        // Test EOP fetch
        console.log('\n2. Testing EOP fetch...');
        const eopResult = await dataPipeline.fetchEopData();
        console.log('EOP Result:', eopResult);
        
        // Check database
        console.log('\n3. Checking database...');
        const dbService = require('./services/dbService');
        const osmData = await dbService.getAllOsmData(10);
        const eopData = await dbService.getEopData(10);
        
        console.log(`OSM records in DB: ${osmData.length}`);
        console.log(`EOP records in DB: ${eopData.length}`);
        
        if (osmData.length > 0) {
            console.log('Sample OSM:', osmData[0]);
        }
        if (eopData.length > 0) {
            console.log('Sample EOP:', eopData[0]);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
