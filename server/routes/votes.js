/**
 * Council Votes API Routes
 * 
 * Handles municipal council voting records including
 * session data, vote tallies, and voting history.
 */

const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// ==========================================
// GET ENDPOINTS
// ==========================================

/**
 * GET /api/votes
 * 
 * Retrieve all council voting records with optional filtering
 * Query params:
 *   - year: filter by session year
 *   - result: filter by result (passed, rejected, postponed)
 *   - search: search in proposal title
 */
router.get('/', async (req, res) => {
  try {
    const { year, result, search, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM council_votes WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (year) {
      query += ` AND EXTRACT(YEAR FROM session_date) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    if (result) {
      query += ` AND result = $${paramIndex}`;
      params.push(result);
      paramIndex++;
    }

    if (search) {
      query += ` AND proposal_title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY session_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result_query = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM council_votes WHERE 1=1';
    if (year) countQuery += ` AND EXTRACT(YEAR FROM session_date) = ${year}`;
    if (result) countQuery += ` AND result = '${result}'`;
    if (search) countQuery += ` AND proposal_title ILIKE '%${search}%'`;
    
    const countResult = await pool.query(countQuery);

    // Calculate statistics
    const stats = {
      total: parseInt(countResult.rows[0].count),
      passed: result_query.rows.filter(v => v.result === 'passed').length,
      rejected: result_query.rows.filter(v => v.result === 'rejected').length,
      postponed: result_query.rows.filter(v => v.result === 'postponed').length
    };

    res.json({
      success: true,
      data: result_query.rows,
      statistics: stats,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result_query.rows.length < parseInt(countResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({
      error: 'Failed to fetch votes',
      message: error.message
    });
  }
});

/**
 * GET /api/votes/statistics
 * 
 * Get voting statistics and analytics
 * Returns aggregated data about voting patterns
 * If no year is specified, returns statistics for all years
 */
router.get('/statistics', async (req, res) => {
  try {
    const { year } = req.query;
    const hasYearFilter = year && year !== 'all';

    let overallQuery, monthlyQuery, participationQuery;
    
    if (hasYearFilter) {
      // Filter by specific year
      overallQuery = `
        SELECT 
          COUNT(*) as total_votes,
          COUNT(*) FILTER (WHERE result = 'passed') as passed_count,
          COUNT(*) FILTER (WHERE result = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE result = 'postponed') as postponed_count,
          ROUND(AVG(vote_yes + vote_no + vote_abstain), 2) as avg_participation
        FROM council_votes
        WHERE EXTRACT(YEAR FROM session_date) = $1
      `;

      monthlyQuery = `
        SELECT 
          EXTRACT(MONTH FROM session_date) as month,
          COUNT(*) as vote_count,
          COUNT(*) FILTER (WHERE result = 'passed') as passed,
          COUNT(*) FILTER (WHERE result = 'rejected') as rejected
        FROM council_votes
        WHERE EXTRACT(YEAR FROM session_date) = $1
        GROUP BY EXTRACT(MONTH FROM session_date)
        ORDER BY month
      `;

      participationQuery = `
        SELECT 
          session_date,
          (vote_yes + vote_no + vote_abstain) as total_participation,
          vote_yes,
          vote_no,
          vote_abstain
        FROM council_votes
        WHERE EXTRACT(YEAR FROM session_date) = $1
        ORDER BY session_date
      `;
    } else {
      // Get all-time statistics (no year filter)
      overallQuery = `
        SELECT 
          COUNT(*) as total_votes,
          COUNT(*) FILTER (WHERE result = 'passed') as passed_count,
          COUNT(*) FILTER (WHERE result = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE result = 'postponed') as postponed_count,
          ROUND(AVG(vote_yes + vote_no + vote_abstain), 2) as avg_participation
        FROM council_votes
      `;

      monthlyQuery = `
        SELECT 
          EXTRACT(MONTH FROM session_date) as month,
          COUNT(*) as vote_count,
          COUNT(*) FILTER (WHERE result = 'passed') as passed,
          COUNT(*) FILTER (WHERE result = 'rejected') as rejected
        FROM council_votes
        GROUP BY EXTRACT(MONTH FROM session_date)
        ORDER BY month
      `;

      participationQuery = `
        SELECT 
          session_date,
          (vote_yes + vote_no + vote_abstain) as total_participation,
          vote_yes,
          vote_no,
          vote_abstain
        FROM council_votes
        ORDER BY session_date
      `;
    }

    let overallResult, monthlyResult, participationResult;
    
    if (hasYearFilter) {
      overallResult = await pool.query(overallQuery, [parseInt(year)]);
      monthlyResult = await pool.query(monthlyQuery, [parseInt(year)]);
      participationResult = await pool.query(participationQuery, [parseInt(year)]);
    } else {
      overallResult = await pool.query(overallQuery);
      monthlyResult = await pool.query(monthlyQuery);
      participationResult = await pool.query(participationQuery);
    }

    res.json({
      success: true,
      year: hasYearFilter ? parseInt(year) : 'all',
      overall: overallResult.rows[0],
      monthlyBreakdown: monthlyResult.rows,
      participationTrends: participationResult.rows
    });

  } catch (error) {
    console.error('Error fetching vote statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch vote statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/votes/years
 * 
 * Get list of years with voting records
 */
router.get('/years', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT EXTRACT(YEAR FROM session_date) as year
      FROM council_votes
      ORDER BY year DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      years: result.rows.map(row => parseInt(row.year))
    });

  } catch (error) {
    console.error('Error fetching vote years:', error);
    res.status(500).json({
      error: 'Failed to fetch vote years',
      message: error.message
    });
  }
});

/**
 * GET /api/votes/:id
 * 
 * Get a single voting record by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM council_votes WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Vote record not found',
        message: `No vote record found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching vote:', error);
    res.status(500).json({
      error: 'Failed to fetch vote',
      message: error.message
    });
  }
});

// ==========================================
// POST ENDPOINTS
// ==========================================

/**
 * POST /api/votes
 * 
 * Create a new council voting record
 * Body: { session_date, proposal_title, vote_yes, vote_no, vote_abstain, result, raw_text }
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_date,
      proposal_title,
      vote_yes = 0,
      vote_no = 0,
      vote_abstain = 0,
      result,
      raw_text
    } = req.body;

    // Validate required fields
    if (!session_date || !proposal_title) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Session date and proposal title are required'
      });
    }

    // Auto-calculate result if not provided
    let finalResult = result;
    if (!finalResult) {
      if (vote_yes > vote_no) {
        finalResult = 'passed';
      } else if (vote_no > vote_yes) {
        finalResult = 'rejected';
      } else {
        finalResult = 'postponed';
      }
    }

    const query = `
      INSERT INTO council_votes (
        session_date, proposal_title, vote_yes, vote_no, 
        vote_abstain, result, raw_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result_query = await pool.query(query, [
      session_date,
      proposal_title,
      vote_yes,
      vote_no,
      vote_abstain,
      finalResult,
      raw_text
    ]);

    res.status(201).json({
      success: true,
      message: 'Vote record created successfully',
      data: result_query.rows[0]
    });

  } catch (error) {
    console.error('Error creating vote record:', error);
    res.status(500).json({
      error: 'Failed to create vote record',
      message: error.message
    });
  }
});

// ==========================================
// PUT/PATCH ENDPOINTS
// ==========================================

/**
 * PUT /api/votes/:id
 * 
 * Update a council voting record
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      session_date,
      proposal_title,
      vote_yes,
      vote_no,
      vote_abstain,
      result,
      raw_text
    } = req.body;

    const query = `
      UPDATE council_votes 
      SET session_date = COALESCE($1, session_date),
          proposal_title = COALESCE($2, proposal_title),
          vote_yes = COALESCE($3, vote_yes),
          vote_no = COALESCE($4, vote_no),
          vote_abstain = COALESCE($5, vote_abstain),
          result = COALESCE($6, result),
          raw_text = COALESCE($7, raw_text)
      WHERE id = $8
      RETURNING *
    `;

    const result_query = await pool.query(query, [
      session_date,
      proposal_title,
      vote_yes,
      vote_no,
      vote_abstain,
      result,
      raw_text,
      id
    ]);

    if (result_query.rows.length === 0) {
      return res.status(404).json({
        error: 'Vote record not found',
        message: `No vote record found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Vote record updated successfully',
      data: result_query.rows[0]
    });

  } catch (error) {
    console.error('Error updating vote record:', error);
    res.status(500).json({
      error: 'Failed to update vote record',
      message: error.message
    });
  }
});

// ==========================================
// DELETE ENDPOINTS
// ==========================================

/**
 * DELETE /api/votes/:id
 * 
 * Delete a council voting record
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM council_votes WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Vote record not found',
        message: `No vote record found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Vote record deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting vote record:', error);
    res.status(500).json({
      error: 'Failed to delete vote record',
      message: error.message
    });
  }
});

module.exports = router;
