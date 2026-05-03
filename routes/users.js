const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, rol, estado, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, nombre, apellido, email, telefono, rol, estado, fecha_creacion, fecha_actualizacion FROM usuarios';
    const params = [];
    let countQuery = 'SELECT COUNT(*) as total FROM usuarios';

    const conditions = [];
    if (rol) {
      conditions.push(`rol = $${params.length + 1}`);
      params.push(rol);
    }
    if (estado !== undefined) {
      conditions.push(`estado = $${params.length + 1}`);
      params.push(estado === 'true');
    }
    if (search) {
      conditions.push(`(nombre ILIKE $${params.length + 1} OR apellido ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY fecha_creacion DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

    const [result, countResult] = await Promise.all([
      pool.query(query, [...params, limit, offset]),
      pool.query(countQuery, params)
    ]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, nombre, apellido, email, telefono, rol, estado, fecha_creacion, fecha_actualizacion
      FROM usuarios 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create user (admin only)
router.post('/', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('apellido').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('telefono').optional().isString(),
  body('rol').isIn(['admin', 'recepcionista', 'personal', 'cliente']).withMessage('Valid role is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { nombre, apellido, email, password, telefono, rol } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const query = `
      INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, rol)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, apellido, email, telefono, rol, estado, fecha_creacion
    `;

    const result = await pool.query(query, [nombre, apellido, email, hashedPassword, telefono, rol]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('nombre').optional().notEmpty().withMessage('Name cannot be empty'),
  body('apellido').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('telefono').optional().isString(),
  body('rol').optional().isIn(['admin', 'recepcionista', 'personal', 'cliente']),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;
    const { password, ...otherUpdates } = updates;

    // Check if email is being changed and if it's already taken
    if (otherUpdates.email) {
      const existingUser = await pool.query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [otherUpdates.email, id]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email already in use by another user'
        });
      }
    }

    // Build dynamic query
    const fields = Object.keys(otherUpdates);
    const values = Object.values(otherUpdates);
    let setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const queryParams = [id, ...values];
    let paramIndex = fields.length + 2;

    // Handle password update separately
    if (password) {
      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      setClause += setClause ? ', ' : '';
      setClause += `password_hash = $${paramIndex}`;
      queryParams.push(hashedPassword);
      paramIndex++;
    }

    const query = `
      UPDATE usuarios 
      SET ${setClause}, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nombre, apellido, email, telefono, rol, estado, fecha_creacion, fecha_actualizacion
    `;

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Change user status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, [
  body('estado').isBoolean().withMessage('Status must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { estado } = req.body;

    const query = `
      UPDATE usuarios 
      SET estado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, nombre, apellido, email, rol, estado
    `;

    const result = await pool.query(query, [estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `User ${estado ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is trying to delete themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Check if user has dependencies
    const checkQueries = [
      'SELECT COUNT(*) as count FROM reservas WHERE cliente_id = $1',
      'SELECT COUNT(*) as count FROM mensajes_contacto WHERE email = (SELECT email FROM usuarios WHERE id = $1)'
    ];

    const [reservasResult, mensajesResult] = await Promise.all([
      pool.query(checkQueries[0], [id]),
      pool.query(checkQueries[1], [id])
    ]);

    if (parseInt(reservasResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete user with existing reservations'
      });
    }

    const query = 'DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, apellido, email';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user statistics (admin only)
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(CASE WHEN rol = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN rol = 'recepcionista' THEN 1 END) as recepcionista_count,
        COUNT(CASE WHEN rol = 'personal' THEN 1 END) as personal_count,
        COUNT(CASE WHEN rol = 'cliente' THEN 1 END) as cliente_count,
        COUNT(CASE WHEN estado = true THEN 1 END) as activos,
        COUNT(CASE WHEN estado = false THEN 1 END) as inactivos,
        COUNT(CASE WHEN fecha_creacion >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as ultima_semana,
        COUNT(CASE WHEN fecha_creacion >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as ultimo_mes
      FROM usuarios
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting user statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
