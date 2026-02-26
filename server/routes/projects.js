/**
 * Projects API Routes
 * 
 * Handles CRUD operations for municipal projects including
 * fetching all projects, getting single project details,
 * and managing citizen votes.
 */

const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// ==========================================
// GET ENDPOINTS
// ==========================================

/**
 * GET /api/projects
 * 
 * Retrieve all projects with optional filtering
 * Query params:
 *   - status: filter by status (planned, active, completed, cancelled)
 *   - year: filter by start year
 *   - search: search in title and description
 */
router.get('/', async (req, res) => {
  try {
    const { status, year, search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        p.*,
        COALESCE(
          (SELECT json_build_object(
            'for', COUNT(*) FILTER (WHERE vote_type = 'for'),
            'against', COUNT(*) FILTER (WHERE vote_type = 'against')
          ) FROM citizen_votes WHERE project_id = p.id),
          '{"for": 0, "against": 0}'::json
        ) as citizen_votes
      FROM projects p
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Add filters dynamically
    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM p.start_date) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM projects p WHERE 1=1
      ${status ? ` AND p.status = '${status}'` : ''}
      ${year ? ` AND EXTRACT(YEAR FROM p.start_date) = ${year}` : ''}
      ${search ? ` AND (p.title ILIKE '%${search}%' OR p.description ILIKE '%${search}%')` : ''}
    `;
    const countResult = await pool.query(countQuery);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      message: error.message
    });
  }
});

/**
 * GET /api/projects/:id
 * 
 * Retrieve a single project by ID with full details
 * 
 * Retrieve a single project by ID with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'for', COUNT(*) FILTER (WHERE vote_type = 'for'),
              'against', COUNT(*) FILTER (WHERE vote_type = 'against')
            )
          ) FROM citizen_votes WHERE project_id = p.id),
          '{"for": 0, "against": 0}'::json
        ) as citizen_votes
      FROM projects p
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      error: 'Failed to fetch project',
      message: error.message
    });
  }
});

/**
 * GET /api/projects/map/data
 * 
 * Retrieve projects formatted for map display
 * Returns only necessary fields for map markers
 */
router.get('/map/data', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        title,
        status,
        lat,
        lng,
        budget,
        CASE 
          WHEN status = 'completed' THEN 'green'
          WHEN status = 'active' THEN 'blue'
          WHEN status = 'planned' THEN 'orange'
          ELSE 'gray'
        END as marker_color
      FROM projects
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({
      error: 'Failed to fetch map data',
      message: error.message
    });
  }
});

// ==========================================
// POST ENDPOINTS
// ==========================================

/**
 * POST /api/projects
 * 
 * Create a new project
 * Body: { title, description, budget, contractor, start_date, end_date, status, lat, lng }
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      budget,
      contractor,
      start_date,
      end_date,
      status = 'planned',
      lat,
      lng
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Title is required'
      });
    }

    const query = `
      INSERT INTO projects (
        title, description, budget, contractor, 
        start_date, end_date, status, lat, lng
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      title,
      description,
      budget,
      contractor,
      start_date,
      end_date,
      status,
      lat,
      lng
    ]);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      error: 'Failed to create project',
      message: error.message
    });
  }
});

/**
 * POST /api/projects/:id/vote
 * 
 * Submit a citizen vote for a project
 * Body: { vote_type: 'for' | 'against' }
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body;

    // Validate vote type
    if (!['for', 'against'].includes(vote_type)) {
      return res.status(400).json({
        error: 'Invalid vote type',
        message: 'Vote type must be either "for" or "against"'
      });
    }

    // Check if project exists
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    // Insert vote
    const query = `
      INSERT INTO citizen_votes (project_id, vote_type)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await pool.query(query, [id, vote_type]);

    res.status(201).json({
      success: true,
      message: 'Vote recorded successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({
      error: 'Failed to record vote',
      message: error.message
    });
  }
});

// ==========================================
// PUT/PATCH ENDPOINTS
// ==========================================

/**
 * PUT /api/projects/:id
 * 
 * Update a project
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'title', 'description', 'budget', 'contractor',
      'start_date', 'end_date', 'status', 'lat', 'lng'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        message: 'Provide at least one valid field'
      });
    }

    values.push(id);
    const query = `
      UPDATE projects 
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      error: 'Failed to update project',
      message: error.message
    });
  }
});

// ==========================================
// DELETE ENDPOINTS
// ==========================================

/**
 * DELETE /api/projects/:id
 * 
 * Delete a project
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM projects WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      message: error.message
    });
  }
});

module.exports = router;
