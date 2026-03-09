/**
 * Admin Database Management Routes
 * 
 * Provides CRUD operations for all main database tables
 * WRITES TO MAIN DATABASE (not admin database)
 */

const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAuditEvent } = require('../db/pool');

// ==========================================
// MAIN DATABASE CONNECTION
// ==========================================
const mainDbConfig = {
  host: process.env.MAIN_DB_HOST || 'localhost',
  port: parseInt(process.env.MAIN_DB_PORT || '5432'),
  database: process.env.MAIN_DB_NAME || 'open_zagora',
  user: process.env.MAIN_DB_USER || 'postgres',
  password: process.env.MAIN_DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.MAIN_DB_SSL_CA
  } : false
};

const mainPool = new Pool(mainDbConfig);

// Handle pool errors
mainPool.on('error', (err, client) => {
  console.error('Unexpected error on idle main database client', err);
});

// ==========================================
// TABLE CONFIGURATION
// Defines schemas for all supported tables
// ==========================================
const tableConfigs = {
  projects: {
    tableName: 'projects',
    columns: [
      // Basic Information
      { name: 'project_code', type: 'varchar(50)', required: false, editable: true },
      { name: 'title', type: 'varchar(500)', required: true, editable: true },
      { name: 'description', type: 'text', required: false, editable: true },
      { name: 'detailed_description', type: 'text', required: false, editable: true },
      
      // Status & Priority
      { name: 'status', type: 'varchar(50)', required: false, editable: true, default: 'planned' },
      { name: 'priority', type: 'varchar(20)', required: false, editable: true, default: 'normal' },
      
      // Budget Information
      { name: 'budget', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'budget_spent', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'funding_source', type: 'varchar(255)', required: false, editable: true },
      { name: 'budget_category', type: 'varchar(100)', required: false, editable: true },
      
      // Contractor Information
      { name: 'contractor', type: 'varchar(255)', required: false, editable: true },
      { name: 'contractor_contact', type: 'text', required: false, editable: true },
      { name: 'contract_number', type: 'varchar(100)', required: false, editable: true },
      { name: 'contract_value', type: 'decimal(15,2)', required: false, editable: true },
      
      // Location Information
      { name: 'address', type: 'varchar(500)', required: false, editable: true },
      { name: 'lat', type: 'decimal(10,8)', required: false, editable: true },
      { name: 'lng', type: 'decimal(11,8)', required: false, editable: true },
      { name: 'municipality', type: 'varchar(100)', required: false, editable: true },
      { name: 'settlement', type: 'varchar(100)', required: false, editable: true },
      
      // Timeline
      { name: 'start_date', type: 'date', required: false, editable: true },
      { name: 'end_date', type: 'date', required: false, editable: true },
      { name: 'actual_start_date', type: 'date', required: false, editable: true },
      { name: 'actual_end_date', type: 'date', required: false, editable: true },
      { name: 'duration_days', type: 'integer', required: false, editable: true },
      
      // Project Type
      { name: 'project_type', type: 'varchar(100)', required: false, editable: true },
      { name: 'category', type: 'varchar(100)', required: false, editable: true },
      
      // Additional Information
      { name: 'raw_text', type: 'text', required: false, editable: true },
      { name: 'notes', type: 'text', required: false, editable: true },
      { name: 'documents', type: 'jsonb', required: false, editable: true },
      
      // Public Visibility
      { name: 'public_visible', type: 'boolean', required: false, editable: true, default: true },
      { name: 'citizen_votes_enabled', type: 'boolean', required: false, editable: true, default: true },
      
      // Metadata
      { name: 'created_by', type: 'varchar(255)', required: false, editable: true },
      { name: 'approved_by', type: 'varchar(255)', required: false, editable: true },
      { name: 'approval_date', type: 'date', required: false, editable: true }
    ],
    displayName: 'Municipal Projects',
    description: 'Construction and infrastructure projects'
  },
  budget_items: {
    tableName: 'budget_items',
    columns: [
      { name: 'category', type: 'varchar(255)', required: true, editable: true },
      { name: 'amount', type: 'decimal(15,2)', required: true, editable: true },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'description', type: 'text', required: false, editable: true }
    ],
    displayName: 'Budget Items',
    description: 'Budget allocations by category'
  },
  council_votes: {
    tableName: 'council_votes',
    columns: [
      { name: 'session_date', type: 'date', required: true, editable: true },
      { name: 'proposal_title', type: 'varchar(500)', required: true, editable: true },
      { name: 'vote_yes', type: 'integer', required: false, editable: true, default: 0 },
      { name: 'vote_no', type: 'integer', required: false, editable: true, default: 0 },
      { name: 'vote_abstain', type: 'integer', required: false, editable: true, default: 0 },
      { name: 'result', type: 'varchar(50)', required: false, editable: true },
      { name: 'raw_text', type: 'text', required: false, editable: true }
    ],
    displayName: 'Council Votes',
    description: 'Municipal council voting sessions'
  },
  budget_documents: {
    tableName: 'budget_documents',
    columns: [
      { name: 'filename', type: 'varchar(255)', required: true, editable: true },
      { name: 'original_name', type: 'varchar(500)', required: false, editable: true },
      { name: 'year', type: 'integer', required: false, editable: true },
      { name: 'document_type', type: 'varchar(100)', required: false, editable: true },
      { name: 'document_subtype', type: 'varchar(100)', required: false, editable: true },
      { name: 'category', type: 'varchar(255)', required: false, editable: true },
      { name: 'uploaded_by', type: 'varchar(255)', required: false, editable: false },
      { name: 'file_size', type: 'bigint', required: false, editable: false },
      { name: 'page_count', type: 'integer', required: false, editable: false },
      { name: 'status', type: 'varchar(50)', required: false, editable: true },
      { name: 'raw_text', type: 'text', required: false, editable: false },
      { name: 'parsed_data', type: 'jsonb', required: false, editable: false }
    ],
    displayName: 'Budget Documents',
    description: 'Uploaded PDF document metadata'
  },
  budget_income: {
    tableName: 'budget_income',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'code', type: 'varchar(50)', required: true, editable: true },
      { name: 'name', type: 'varchar(500)', required: true, editable: true },
      { name: 'amount', type: 'decimal(15,2)', required: true, editable: true }
    ],
    displayName: 'Budget Income',
    description: 'Budget income entries by code'
  },
  budget_expenses: {
    tableName: 'budget_expenses',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'code', type: 'varchar(50)', required: true, editable: true },
      { name: 'name', type: 'varchar(500)', required: true, editable: true },
      { name: 'function_code', type: 'varchar(50)', required: false, editable: true },
      { name: 'function_name', type: 'varchar(255)', required: false, editable: true },
      { name: 'program_name', type: 'varchar(255)', required: false, editable: true },
      { name: 'amount', type: 'decimal(15,2)', required: true, editable: true }
    ],
    displayName: 'Budget Expenses',
    description: 'Budget expense entries'
  },
  budget_indicators: {
    tableName: 'budget_indicators',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'indicator_code', type: 'varchar(50)', required: true, editable: true },
      { name: 'code', type: 'varchar(50)', required: true, editable: true },
      { name: 'indicator_name', type: 'varchar(500)', required: true, editable: true },
      { name: 'amount_approved', type: 'decimal(15,2)', required: true, editable: true },
      { name: 'amount_executed', type: 'decimal(15,2)', required: false, editable: true }
    ],
    displayName: 'Budget Indicators',
    description: 'Performance indicators and metrics'
  },
  budget_loans: {
    tableName: 'budget_loans',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'loan_type', type: 'varchar(100)', required: true, editable: true },
      { name: 'loan_code', type: 'varchar(50)', required: false, editable: true },
      { name: 'original_amount', type: 'decimal(15,2)', required: true, editable: true },
      { name: 'remaining_amount', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'interest_rate', type: 'decimal(5,2)', required: false, editable: true },
      { name: 'purpose', type: 'text', required: false, editable: true }
    ],
    displayName: 'Budget Loans',
    description: 'Loan information and debt management'
  },
  budget_villages: {
    tableName: 'budget_villages',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'year', type: 'integer', required: true, editable: true },
      { name: 'code', type: 'varchar(50)', required: true, editable: true },
      { name: 'name', type: 'varchar(255)', required: true, editable: true },
      { name: 'state_personnel', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'state_maintenance', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'local_total', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'total_amount', type: 'decimal(15,2)', required: true, editable: true }
    ],
    displayName: 'Village Budgets',
    description: 'Kmetstvo (village) budget allocations'
  },
  budget_forecasts: {
    tableName: 'budget_forecasts',
    columns: [
      { name: 'document_id', type: 'uuid', required: true, editable: false },
      { name: 'code', type: 'varchar(50)', required: true, editable: true },
      { name: 'name', type: 'varchar(255)', required: true, editable: true },
      { name: 'amount_2024', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'amount_2025', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'amount_2026', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'amount_2027', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'amount_2028', type: 'decimal(15,2)', required: false, editable: true }
    ],
    displayName: 'Budget Forecasts',
    description: 'Multi-year budget projections'
  },
  citizen_votes: {
    tableName: 'citizen_votes',
    columns: [
      { name: 'project_id', type: 'uuid', required: true, editable: true },
      { name: 'vote_type', type: 'varchar(10)', required: true, editable: true },
      { name: 'created_at', type: 'timestamp', required: false, editable: false }
    ],
    displayName: 'Citizen Votes',
    description: 'Public opinion votes on projects'
  },
  eop_data: {
    tableName: 'eop_data',
    columns: [
      { name: 'eop_id', type: 'varchar(100)', required: false, editable: true },
      { name: 'source_url', type: 'text', required: false, editable: true },
      { name: 'title', type: 'varchar(1000)', required: false, editable: true },
      { name: 'description', type: 'text', required: false, editable: true },
      { name: 'status', type: 'varchar(50)', required: false, editable: true },
      { name: 'budget', type: 'decimal(15,2)', required: false, editable: true },
      { name: 'currency', type: 'varchar(3)', required: false, editable: true },
      { name: 'contractor', type: 'varchar(500)', required: false, editable: true },
      { name: 'contract_number', type: 'varchar(100)', required: false, editable: true },
      { name: 'awarding_type', type: 'varchar(100)', required: false, editable: true },
      { name: 'procurement_type', type: 'varchar(100)', required: false, editable: true },
      { name: 'cpv_code', type: 'varchar(20)', required: false, editable: true },
      { name: 'address', type: 'varchar(500)', required: false, editable: true },
      { name: 'settlement', type: 'varchar(100)', required: false, editable: true },
      { name: 'municipality', type: 'varchar(100)', required: false, editable: true },
      { name: 'lat', type: 'decimal(10,8)', required: false, editable: true },
      { name: 'lng', type: 'decimal(11,8)', required: false, editable: true },
      { name: 'start_date', type: 'date', required: false, editable: true },
      { name: 'end_date', type: 'date', required: false, editable: true },
      { name: 'publication_date', type: 'date', required: false, editable: true },
      { name: 'raw_data', type: 'jsonb', required: false, editable: true }
    ],
    displayName: 'EOP Tenders',
    description: 'Public procurement data from eop.bg'
  }
};

// ==========================================
// AUTHENTICATION MIDDLEWARE
// All database routes require admin authentication
// ==========================================
router.use(authenticate);
router.use(requireAdmin);

// ==========================================
// GET /api/admin/database/tables
// Get list of all available tables
// ==========================================
router.get('/tables', async (req, res) => {
  try {
    const tables = Object.keys(tableConfigs).map(key => ({
      id: key,
      name: tableConfigs[key].tableName,
      displayName: tableConfigs[key].displayName,
      description: tableConfigs[key].description,
      columnCount: tableConfigs[key].columns.length
    }));

    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      error: 'Failed to fetch tables',
      message: error.message
    });
  }
});

// ==========================================
// DELETE /api/admin/database/:table/clear
// Clear all records from a specific table (MUST COME BEFORE /:table)
// ==========================================
router.delete('/:table/clear', async (req, res) => {
  try {
    const { table } = req.params;
    const { confirm } = req.body;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    if (confirm !== 'CLEAR_TABLE') {
      return res.status(400).json({
        error: 'Invalid confirmation',
        message: 'Please send { "confirm": "CLEAR_TABLE" } to clear the table'
      });
    }

    const config = tableConfigs[table];
    const countResult = await mainPool.query(`SELECT COUNT(*) as count FROM ${config.tableName}`);
    const deletedCount = parseInt(countResult.rows[0].count);

    await mainPool.query(`DELETE FROM ${config.tableName}`);

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_table_clear',
      resourceType: table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { table: config.tableName, deletedCount },
      success: true
    });

    res.json({
      success: true,
      message: `All records cleared from ${config.tableName}`,
      data: { table: config.tableName, deletedCount, clearedAt: new Date().toISOString() }
    });

  } catch (error) {
    console.error(`Error clearing table ${req.params.table}:`, error);
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_table_clear_error',
      resourceType: req.params.table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message },
      success: false,
      errorMessage: error.message
    });
    res.status(500).json({ error: 'Failed to clear table', message: error.message });
  }
});

// ==========================================
// POST /api/admin/database/clear
// Clear all data from all tables (MUST COME BEFORE /:table)
// ==========================================
router.post('/clear', async (req, res) => {
  const client = await mainPool.connect();
  
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'CLEAR_ALL_DATA') {
      return res.status(400).json({
        error: 'Invalid confirmation',
        message: 'Please send { "confirm": "CLEAR_ALL_DATA" } to clear the database'
      });
    }

    await client.query('BEGIN');

    const tablesToClear = [
      'citizen_votes', 'budget_forecasts', 'budget_villages', 'budget_loans',
      'budget_indicators', 'budget_expenses', 'budget_income', 'budget_documents',
      'council_votes', 'budget_items', 'projects', 'budget_summary', 'eop_data'
    ];

    const deletedCounts = {};

    for (const tableName of tablesToClear) {
      try {
        const result = await client.query(`DELETE FROM ${tableName} RETURNING id`);
        deletedCounts[tableName] = result.rowCount;
      } catch (err) {
        deletedCounts[tableName] = 0;
      }
    }

    await client.query('COMMIT');

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_clear',
      resourceType: 'database',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { deletedCounts, clearedBy: req.user.username },
      success: true
    });

    res.json({
      success: true,
      message: 'Database cleared successfully',
      data: { deletedCounts, clearedAt: new Date().toISOString() }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing database:', error);
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_clear_error',
      resourceType: 'database',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message },
      success: false,
      errorMessage: error.message
    });
    res.status(500).json({ error: 'Failed to clear database', message: error.message });
  } finally {
    client.release();
  }
});

// ==========================================
// GET /api/admin/database/stats/overview
// Get database statistics
// ==========================================
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = {};

    for (const [key, config] of Object.entries(tableConfigs)) {
      try {
        const result = await mainPool.query(
          `SELECT COUNT(*) as count FROM ${config.tableName}`
        );
        stats[key] = {
          tableName: config.tableName,
          displayName: config.displayName,
          count: parseInt(result.rows[0].count)
        };
      } catch (err) {
        stats[key] = {
          tableName: config.tableName,
          displayName: config.displayName,
          count: 0,
          error: err.message
        };
      }
    }

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_stats',
      resourceType: 'database',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { tables: Object.keys(stats) },
      success: true
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({
      error: 'Failed to fetch database stats',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/database/:table/schema
// Get schema for a specific table
// ==========================================
router.get('/:table/schema', async (req, res) => {
  try {
    const { table } = req.params;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error(`Error fetching schema for ${req.params.table}:`, error);
    res.status(500).json({
      error: 'Failed to fetch schema',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/database/:table
// Get records from a specific table
// ==========================================
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      sortBy = 'created_at', 
      sortOrder = 'DESC',
      year,
      status
    } = req.query;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT * FROM ${config.tableName}`;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (search) {
      const textColumns = config.columns.filter(c => 
        c.type.includes('varchar') || c.type.includes('text')
      );
      
      if (textColumns.length > 0) {
        const searchConditions = textColumns.map(col => 
          `${col.name} ILIKE $${paramIndex}`
        );
        conditions.push(`(${searchConditions.join(' OR ')})`);
        params.push(`%${search}%`);
        paramIndex++;
      }
    }

    if (year && config.columns.some(c => c.name === 'year')) {
      conditions.push(`year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }

    if (status && config.columns.some(c => c.name === 'status')) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const validSortColumns = config.columns.map(c => c.name);
    
    // Only use created_at for sorting if it exists in the table
    let sortColumn;
    if (validSortColumns.includes(sortBy)) {
      sortColumn = sortBy;
    } else if (validSortColumns.includes('created_at')) {
      sortColumn = 'created_at';
    } else if (validSortColumns.includes('id')) {
      sortColumn = 'id';
    } else if (validSortColumns.length > 0) {
      sortColumn = validSortColumns[0];
    } else {
      sortColumn = 'id'; // fallback
    }
    
    query += ` ORDER BY ${sortColumn} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    let countQuery = `SELECT COUNT(*) as total FROM ${config.tableName}`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const countParams = params.slice(0, -2);
    const countResult = await mainPool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    const result = await mainPool.query(query, params);

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_select',
      resourceType: table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        table: config.tableName,
        filters: { search, year, status },
        returnedRows: result.rows.length,
        totalRows: total
      },
      success: true
    });

    res.json({
      success: true,
      data: {
        records: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error(`Error fetching from ${req.params.table}:`, error);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_select_error',
      resourceType: req.params.table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to fetch records',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/admin/database/:table/:id
// Get a single record by ID
// ==========================================
router.get('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];
    const idColumn = config.columns.find(c => c.name === 'id')?.name || config.columns[0].name;

    const query = `SELECT * FROM ${config.tableName} WHERE ${idColumn} = $1`;
    const result = await mainPool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Record not found',
        message: `No record found with ${idColumn} = ${id}`
      });
    }

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_select_one',
      resourceType: table,
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { recordId: id },
      success: true
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error(`Error fetching record from ${req.params.table}:`, error);
    res.status(500).json({
      error: 'Failed to fetch record',
      message: error.message
    });
  }
});

// ==========================================
// POST /api/admin/database/:table
// Create a new record
// ==========================================
router.post('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];
    const editableColumns = config.columns.filter(c => c.editable);
    
    const missingFields = editableColumns
      .filter(c => c.required && !data[c.name] && data[c.name] !== 0)
      .map(c => c.name);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required: ${missingFields.join(', ')}`
      });
    }

    const insertColumns = [];
    const insertValues = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const column of editableColumns) {
      if (data[column.name] !== undefined && data[column.name] !== null) {
        insertColumns.push(column.name);
        insertValues.push(data[column.name]);
        placeholders.push(`$${paramIndex}`);
        paramIndex++;
      }
    }

    if (insertColumns.length === 0) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Please provide at least one field to insert'
      });
    }

    const query = `
      INSERT INTO ${config.tableName} (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await mainPool.query(query, insertValues);
    const newRecord = result.rows[0];

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_insert',
      resourceType: table,
      resourceId: newRecord.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        recordId: newRecord.id,
        data: data
      },
      success: true
    });

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: newRecord
    });
  } catch (error) {
    console.error(`Error inserting into ${req.params.table}:`, error);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_insert_error',
      resourceType: req.params.table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message, data: req.body },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to create record',
      message: error.message
    });
  }
});

// ==========================================
// PUT /api/admin/database/:table/:id
// Update an existing record
// ==========================================
router.put('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = req.body;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];
    const idColumn = config.columns.find(c => c.name === 'id')?.name || 'id';
    const editableColumns = config.columns.filter(c => c.editable && c.name !== idColumn);

    const updates = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const column of editableColumns) {
      if (data[column.name] !== undefined) {
        updates.push(`${column.name} = $${paramIndex}`);
        updateValues.push(data[column.name]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No data to update',
        message: 'Please provide at least one field to update'
      });
    }

    updateValues.push(id);

    const query = `
      UPDATE ${config.tableName}
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE ${idColumn} = $${paramIndex}
      RETURNING *
    `;

    const result = await mainPool.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Record not found',
        message: `No record found with ${idColumn} = ${id}`
      });
    }

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_update',
      resourceType: table,
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        recordId: id,
        data: data
      },
      success: true
    });

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error(`Error updating ${req.params.table}:`, error);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_update_error',
      resourceType: req.params.table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message, data: req.body },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to update record',
      message: error.message
    });
  }
});

// ==========================================
// DELETE /api/admin/database/:table/:id
// Delete a record
// ==========================================
router.delete('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;

    if (!tableConfigs[table]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table '${table}' is not supported`
      });
    }

    const config = tableConfigs[table];
    const idColumn = config.columns.find(c => c.name === 'id')?.name || 'id';

    const checkQuery = `SELECT * FROM ${config.tableName} WHERE ${idColumn} = $1`;
    const checkResult = await mainPool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Record not found',
        message: `No record found with ${idColumn} = ${id}`
      });
    }

    const deleteQuery = `DELETE FROM ${config.tableName} WHERE ${idColumn} = $1 RETURNING *`;
    const result = await mainPool.query(deleteQuery, [id]);

    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_delete',
      resourceType: table,
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        recordId: id,
        deletedData: checkResult.rows[0]
      },
      success: true
    });

    res.json({
      success: true,
      message: 'Record deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error(`Error deleting from ${req.params.table}:`, error);
    
    await logAuditEvent({
      adminUserId: req.user.id,
      action: 'db_delete_error',
      resourceType: req.params.table,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message, recordId: req.params.id },
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to delete record',
      message: error.message
    });
  }
});

module.exports = router;
