/**
 * Budget API Routes
 * 
 * Provides endpoints for accessing parsed budget data
 * from uploaded PDF documents.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// ==========================================
// API ROUTES
// ==========================================

// GET /api/budget
// Get all budget items for a year (used by BudgetPage.jsx)
router.get('/', async (req, res) => {
  try {
    const { year, limit = 1000, offset = 0 } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const yearInt = parseInt(year);
    const limitInt = Math.min(parseInt(limit), 1000);
    const offsetInt = parseInt(offset);

    // Get income items
    const incomeResult = await pool.query(`
      SELECT 
        id,
        code,
        name as description,
        amount,
        'Income' as category,
        document_id,
        created_at
      FROM budget_income
      WHERE year = $1
      ORDER BY amount DESC
      LIMIT $2 OFFSET $3
    `, [yearInt, limitInt, offsetInt]);

    // Get expense items
    const expenseResult = await pool.query(`
      SELECT 
        id,
        function_code as code,
        function_name as name,
        amount,
        'Expenses' as category,
        document_id,
        created_at
      FROM budget_expenses
      WHERE year = $1
      ORDER BY amount DESC
      LIMIT $2 OFFSET $3
    `, [yearInt, limitInt, offsetInt]);

    // Combine and format results
    const allItems = [
      ...incomeResult.rows.map(item => ({
        ...item,
        amount: parseFloat(item.amount),
        type: 'income'
      })),
      ...expenseResult.rows.map(item => ({
        ...item,
        amount: parseFloat(item.amount),
        type: 'expense'
      }))
    ].sort((a, b) => b.amount - a.amount);

    // Get total count
    const countResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM budget_income WHERE year = $1) +
        (SELECT COUNT(*) FROM budget_expenses WHERE year = $1) as total
    `, [yearInt]);

    res.json({
      success: true,
      data: allItems,
      pagination: {
        year: yearInt,
        limit: limitInt,
        offset: offsetInt,
        total: parseInt(countResult.rows[0].total),
        hasMore: allItems.length === limitInt
      }
    });

  } catch (err) {
    console.error('Error fetching budget items:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget items',
      message: err.message
    });
  }
});

// GET /api/budget/years
// Get all years with budget data
router.get('/years', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT year FROM (
        SELECT year FROM budget_income
        UNION
        SELECT year FROM budget_expenses
        UNION
        SELECT year FROM budget_indicators
        UNION
        SELECT year FROM budget_loans
        UNION
        SELECT year FROM budget_summary
      ) years
      WHERE year IS NOT NULL
      ORDER BY year DESC
    `);

    const years = result.rows.map(row => row.year);

    res.json({
      success: true,
      data: {
        years,
        count: years.length
      }
    });

  } catch (err) {
    console.error('Error fetching years:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget years',
      message: err.message
    });
  }
});

// GET /api/budget/summary
// Get budget summary - supports both dashboard (no year) and budget page (with year)
router.get('/summary', async (req, res) => {
  try {
    const { year } = req.query;
    
    // If no year provided, return dashboard summary (grand total across all years)
    if (!year) {
      // Get total income across all years
      const incomeResult = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM budget_income
      `);
      
      // Get total expenses across all years
      const expenseResult = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM budget_expenses
      `);
      
      // Get total loans across all years
      const loanResult = await pool.query(`
        SELECT COALESCE(SUM(original_amount), 0) as total FROM budget_loans
      `);

      const totalIncome = parseFloat(incomeResult.rows[0].total);
      const totalExpenses = parseFloat(expenseResult.rows[0].total);
      const totalLoans = parseFloat(loanResult.rows[0].total);
      const grandTotal = totalIncome + totalExpenses + totalLoans;

      return res.json({
        success: true,
        grandTotal: grandTotal,
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        totalLoans: totalLoans,
        data: []
      });
    }

    // With year - return category breakdown for BudgetPage
    const yearInt = parseInt(year);

    // Income name mapping
    const INCOME_NAMES = {
      '01': 'Данъци върху доходите',
      '02': 'Данъци върху печалбата',
      '03': 'Имуществени данъци',
      '04': 'ДДС',
      '05': 'Акцизи',
      '06': 'Други данъци',
      '08': 'Приходи от собственост',
      '09': 'Административни услуги',
      '10': 'Глоби и санкции',
      '11': 'Приходи от концесии',
      '12': 'Приходи от продажби',
      '13': 'Приходи от приватизация',
      '14': 'Приходи от лихви',
      '15': 'Трансфери и помощи',
      '17': 'Временни заеми',
      '24': 'Други приходи',
      '25': 'Приходи от глоби',
      '28': 'Приходи от други санкции',
      '31': 'Трансфери от държавния бюджет',
      '36': 'Помощи от ЕС',
      '45': 'Текущи помощи',
      '46': 'Собствени приходи',
      '61': 'Трансфери от бюджети',
      '62': 'Трансфери от ЕС',
      '63': 'Други ЕС трансфери',
      '74': 'Заеми от ЦБ',
      '75': 'Заеми от бюджети',
      '76': 'Заеми за ЕС',
      '77': 'Всичко заеми',
      '88': 'Друго финансиране',
      '93': 'Операции с активи',
      '95': 'Депозити',
    };

    // Get income data grouped by code (for categories)
    const incomeResult = await pool.query(`
      SELECT 
        code,
        name,
        SUM(amount) as total_amount,
        COUNT(*) as item_count
      FROM budget_income
      WHERE year = $1
      GROUP BY code, name
      ORDER BY total_amount DESC
    `, [yearInt]);

    // Get expense data grouped by function
    const expenseResult = await pool.query(`
      SELECT 
        function_code,
        function_name,
        SUM(amount) as total_amount,
        COUNT(*) as item_count
      FROM budget_expenses
      WHERE year = $1
      GROUP BY function_code, function_name
      ORDER BY total_amount DESC
    `, [yearInt]);

    // Combine and format for charts
    const categories = [];
    
    // Add income categories
    incomeResult.rows.forEach(row => {
      const prefix = row.code.split('-')[0];
      const name = row.name && row.name.trim() ? row.name : (INCOME_NAMES[prefix] || row.code);
      categories.push({
        category: name,
        code: row.code,
        total_amount: parseFloat(row.total_amount),
        item_count: parseInt(row.item_count),
        type: 'income'
      });
    });

    // Add expense categories
    expenseResult.rows.forEach(row => {
      const name = row.function_name && row.function_name.trim() ? row.function_name : `Функция ${row.function_code}`;
      categories.push({
        category: name,
        code: row.function_code,
        total_amount: parseFloat(row.total_amount),
        item_count: parseInt(row.item_count),
        type: 'expense'
      });
    });

    // Calculate total and percentages
    const totalBudget = categories.reduce((sum, item) => sum + item.total_amount, 0);
    
    const categoriesWithPercentage = categories.map(item => ({
      ...item,
      percentage: totalBudget > 0 ? Math.round((item.total_amount / totalBudget) * 100) : 0
    }));

    res.json({
      success: true,
      data: categoriesWithPercentage
    });

  } catch (err) {
    console.error('Error fetching budget summary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget summary',
      message: err.message
    });
  }
});

// GET /api/budget/income
// Get income data for a year
router.get('/income', async (req, res) => {
  try {
    const { year } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const result = await pool.query(`
      SELECT 
        id,
        code,
        name,
        amount,
        document_id,
        created_at
      FROM budget_income
      WHERE year = $1
      ORDER BY amount DESC
    `, [parseInt(year)]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount)
      }))
    });

  } catch (err) {
    console.error('Error fetching income data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch income data',
      message: err.message
    });
  }
});

// GET /api/budget/expenses
// Get expense data for a year
router.get('/expenses', async (req, res) => {
  try {
    const { year, limit = 1000, offset = 0 } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const yearInt = parseInt(year);
    const limitInt = Math.min(parseInt(limit), 1000);
    const offsetInt = parseInt(offset);

    const result = await pool.query(`
      SELECT 
        id,
        function_code,
        function_name,
        program_code,
        program_name,
        amount,
        amount_personnel,
        amount_goods_services,
        amount_subsidies,
        amount_capital,
        document_id,
        created_at
      FROM budget_expenses
      WHERE year = $1
      ORDER BY amount DESC
      LIMIT $2 OFFSET $3
    `, [yearInt, limitInt, offsetInt]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM budget_expenses WHERE year = $1
    `, [yearInt]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount || 0),
        amount_personnel: parseFloat(row.amount_personnel || 0),
        amount_goods_services: parseFloat(row.amount_goods_services || 0),
        amount_subsidies: parseFloat(row.amount_subsidies || 0),
        amount_capital: parseFloat(row.amount_capital || 0)
      })),
      pagination: {
        year: yearInt,
        limit: limitInt,
        offset: offsetInt,
        total: parseInt(countResult.rows[0].total),
        hasMore: result.rows.length === limitInt
      }
    });

  } catch (err) {
    console.error('Error fetching expense data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expense data',
      message: err.message
    });
  }
});

// GET /api/budget/indicators
// Get indicator data for a year
router.get('/indicators', async (req, res) => {
  try {
    const { year, department } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    let query = `
      SELECT 
        id,
        indicator_code,
        department_code,
        department_name,
        indicator_name,
        budget_chapter,
        amount_approved,
        amount_executed,
        amount_remaining,
        percentage_executed,
        
        
        
        
        document_id,
        created_at
      FROM budget_indicators
      WHERE year = $1
    `;
    const params = [parseInt(year)];

    if (department) {
      query += ` AND department_code = $2`;
      params.push(department);
    }

    query += ` ORDER BY amount_approved DESC, department_code, indicator_code`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        amount_approved: parseFloat(row.amount_approved || 0),
        amount_executed: parseFloat(row.amount_executed || 0),
        amount_remaining: parseFloat(row.amount_remaining || 0),
        percentage_executed: parseFloat(row.percentage_executed || 0)
      }))
    });

  } catch (err) {
    console.error('Error fetching indicator data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch indicator data',
      message: err.message
    });
  }
});

// GET /api/budget/loans
// Get loan data for a year
router.get('/loans', async (req, res) => {
  try {
    const { year } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const result = await pool.query(`
      SELECT 
        id,
        loan_type,
        loan_code,
        creditor,
        original_amount,
        remaining_amount,
        interest_rate,
        start_date,
        end_date,
        term_months,
        purpose,
        monthly_payment,
        document_id,
        created_at
      FROM budget_loans
      WHERE year = $1
      ORDER BY original_amount DESC
    `, [parseInt(year)]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        original_amount: parseFloat(row.original_amount || 0),
        remaining_amount: parseFloat(row.remaining_amount || 0),
        interest_rate: parseFloat(row.interest_rate || 0),
        monthly_payment: parseFloat(row.monthly_payment || 0),
        term_months: row.term_months ? parseInt(row.term_months) : null
      }))
    });

  } catch (err) {
    console.error('Error fetching loan data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan data',
      message: err.message
    });
  }
});

// GET /api/budget/documents
// Get all uploaded budget documents
router.get('/documents', async (req, res) => {
  try {
    const { year, type, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        id,
        filename,
        original_name,
        document_type,
        year,
        file_size,
        page_count,
        uploaded_at
      FROM budget_documents
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (year) {
      query += ` AND year = $${paramIndex++}`;
      params.push(parseInt(year));
    }

    if (type) {
      query += ` AND document_type = $${paramIndex++}`;
      params.push(type);
    }

    query += ` ORDER BY year DESC, uploaded_at DESC LIMIT $${paramIndex++}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
      message: err.message
    });
  }
});

// GET /api/budget/villages
// Get village budget data for a year
router.get('/villages', async (req, res) => {
  try {
    const { year } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const result = await pool.query(`
      SELECT 
        id,
        code,
        name,
        state_personnel,
        state_maintenance,
        local_total,
        total_amount,
        document_id,
        created_at
      FROM budget_villages
      WHERE year = $1
      ORDER BY total_amount DESC
    `, [parseInt(year)]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        state_personnel: parseFloat(row.state_personnel || 0),
        state_maintenance: parseFloat(row.state_maintenance || 0),
        local_total: parseFloat(row.local_total || 0),
        total_amount: parseFloat(row.total_amount || 0)
      }))
    });

  } catch (err) {
    console.error('Error fetching village data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch village data',
      message: err.message
    });
  }
});

// GET /api/budget/forecasts
// Get multi-year forecast data
router.get('/forecasts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        code,
        name,
        amount_2024,
        amount_2025,
        amount_2026,
        amount_2027,
        amount_2028,
        document_id,
        created_at
      FROM budget_forecasts
      ORDER BY amount_2025 DESC
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        amount_2024: parseFloat(row.amount_2024 || 0),
        amount_2025: parseFloat(row.amount_2025 || 0),
        amount_2026: parseFloat(row.amount_2026 || 0),
        amount_2027: parseFloat(row.amount_2027 || 0),
        amount_2028: parseFloat(row.amount_2028 || 0)
      }))
    });

  } catch (err) {
    console.error('Error fetching forecast data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch forecast data',
      message: err.message
    });
  }
});

module.exports = router;
