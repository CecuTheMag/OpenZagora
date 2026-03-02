const express = require('express');
const fileRoutes = require('./routes/files');

const app = express();
app.use('/api/files', fileRoutes);

// Test the route
app.listen(3001, () => {
  console.log('Test server running on port 3001');
  console.log('Test URLs:');
  console.log('- http://localhost:3001/api/files/list');
  console.log('- http://localhost:3001/api/files/Pr%2040%20indik%20razcheti-2025-d898.pdf');
});