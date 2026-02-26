/**
 * Budget API Routes
 * 
 * Handles budget data retrieval and visualization data
 * for the municipal budget dashboard.
 */

const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// ==========================================
// GET ENDPOINTS
// ==========================================

/**
 * GET /api/budget
 * 
 * Retrieve all budget items with optional filtering
 * Query params:
 *   - year: filter by year
 *   - category: filter by category
 */
router.get('/', async (req, res) => {
  try {
    const { year, category, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM budget_items WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (year) {
      query += ` AND year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    if (category) {
      query += ` AND category ILIKE $${paramIndex}`;
      params.push(`%${category}%`);
      paramIndex++;
    }

    query += ` ORDER BY amount DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM budget_items WHERE 1=1
      ${year ? ` AND year = ${year}` : ''}
      ${category ? ` AND category ILIKE '%${category}%'` : ''}
    `;
    const countResult = await pool.query(countQuery);

    // Calculate totals
    const totalAmount = result.rows.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    res.json({
      success: true,
      data: result.rows,
      summary: {
        totalAmount: totalAmount,
        itemCount: result.rows.length,
        year: year || 'all'
      },
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error fetching budget items:', error);
    res.status(500).json({
      error: 'Failed to fetch budget items',
      message: error.message
    });
  }
});

/**
 * GET /api/budget/summary
 * 
 * Get budget summary by category for charts
 * Returns aggregated data suitable for pie/bar charts
 */
router.get('/summary', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const query = `
      SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as item_count,
        ROUND(SUM(amount) * 100.0 / (SELECT SUM(amount) FROM budget_items WHERE year = $1), 2) as percentage
      FROM budget_items
      WHERE year = $1
      GROUP BY category
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, [parseInt(year)]);

    // Calculate grand total
    const grandTotal = result.rows.reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

    res.json({
      success: true,
      year: parseInt(year),
      data: result.rows,
      grandTotal: grandTotal
    });

  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({
      error: 'Failed to fetch budget summary',
      message: error.message
    });
  }
});

/**
 * GET /api/budget/years
 * 
 * Get list of available years in the budget data
 */
router.get('/years', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT year 
      FROM budget_items 
      ORDER BY year DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      years: result.rows.map(row => row.year)
    });

  } catch (error) {
    console.error('Error fetching budget years:', error);
    res.status(500).json({
      error: 'Failed to fetch budget years',
      message: error.message
    });
  }
});

/**
 * GET /api/budget/trends
 * 
 * Get budget trends over multiple years
 * Returns year-over-year comparison data
 */
router.get('/trends', async (req, res) => {
  try {
    const query = `
      SELECT 
        year,
        category,
        SUM(amount) as total_amount
      FROM budget_items
      GROUP BY year, category
      ORDER BY year DESC, total_amount DESC
    `;

    const result = await pool.query(query);

    // Transform data for easier chart consumption
    const trends = {};
    result.rows.forEach(row => {
      if (!trends[row.year]) {
        trends[row.year] = {};
      }
      trends[row.year][row.category] = parseFloat(row.total_amount);
    });

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Error fetching budget trends:', error);
    res.status(500).json({
      error: 'Failed to fetch budget trends',
      message: error.message
    });
  }
});

/**
 * GET /api/budget/:id
 * 
 * Get a single budget item by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM budget_items WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Budget item not found',
        message: `No budget item found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching budget item:', error);
    res.status(500).json({
      error: 'Failed to fetch budget item',
      message: error.message
    });
  }
});

// ==========================================
// POST ENDPOINTS
// ==========================================

/**
 * POST /api/budget
 * 
 * Create a new budget item
 * Body: { category, amount, year, description }
 */
router.post('/', async (req, res) => {
  try {
    const { category, amount, year, description } = req.body;

    // Validate required fields
    if (!category || !amount || !year) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Category, amount, and year are required'
      });
    }

    const query = `
      INSERT INTO budget_items (category, amount, year, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [
      category,
      amount,
      year,
      description
    ]);

    res.status(201).json({
      success: true,
      message: 'Budget item created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating budget item:', error);
    res.status(500).json({
      error: 'Failed to create budget item',
      message: error.message
    });
  }
});

// ==========================================
// PUT/PATCH ENDPOINTS
// ==========================================

/**
 * PUT /api/budget/:id
 * 
 * Update a budget item
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, amount, year, description } = req.body;

    const query = `
      UPDATE budget_items 
      SET category = COALESCE($1, category),
          amount = COALESCE($2, amount),
          year = COALESCE($3, year),
          description = COALESCE($4, description)
      WHERE id = $5
      RETURNING *
    `;

    const result = await pool.query(query, [
      category,
      amount,
      year,
      description,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Budget item not found',
        message: `No budget item found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Budget item updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating budget item:', error);
    res.status(500).json({
      error: 'Failed to update budget item',
      message: error.message
    });
  }
});

// ==========================================
// DELETE ENDPOINTS
// ==========================================

/**
 * DELETE /api/budget/:id
 * 
 * Delete a budget item
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM budget_items WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Budget item not found',
        message: `No budget item found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Budget item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting budget item:', error);
    res.status(500).json({
      error: 'Failed to delete budget item',
      message: error.message
    });
  }
});

module.exports = router;
