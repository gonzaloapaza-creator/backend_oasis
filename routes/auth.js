const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// Register user
router.post('/register', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('apellido').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('telefono').optional().isString(),
  body('rol').optional().isIn(['admin', 'recepcionista', 'personal', 'cliente'])
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

    const { nombre, apellido, email, password, telefono, rol = 'cliente' } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const query = `
      INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, rol)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, apellido, email, telefono, rol, estado, fecha_creacion
    `;

    const result = await pool.query(query, [nombre, apellido, email, hashedPassword, telefono, rol]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.rows[0].id, 
        email: result.rows[0].email,
        rol: result.rows[0].rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      data: {
        user: result.rows[0],
        token
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    // Find user
    const query = 'SELECT * FROM usuarios WHERE email = $1 AND estado = true';
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        rol: user.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password from response
    delete user.password_hash;

    res.json({
      success: true,
      data: {
        user,
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT id, nombre, apellido, email, telefono, rol, estado, fecha_creacion, fecha_actualizacion
      FROM usuarios 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [req.user.id]);

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
    console.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('nombre').optional().notEmpty().withMessage('Name cannot be empty'),
  body('apellido').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('telefono').optional().isString(),
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

    const updates = req.body;
    const { password, ...otherUpdates } = updates;

    // Whitelist allowed fields to prevent field injection (e.g. rol, estado)
    const allowedFields = ['nombre', 'apellido', 'telefono'];
    const filtered = {};
    for (const key of allowedFields) {
      if (otherUpdates[key] !== undefined) {
        filtered[key] = otherUpdates[key];
      }
    }

    // Build dynamic query
    const fields = Object.keys(filtered);
    const values = Object.values(filtered);
    let setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const queryParams = [req.user.id, ...values];
    let paramIndex = fields.length + 2;

    // Handle password update separately
    if (password) {
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
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, rol, estado } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, nombre, apellido, email, telefono, rol, estado, fecha_creacion FROM usuarios';
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

// Change user status (admin only)
router.patch('/users/:id/status', authenticateToken, requireAdmin, [
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

module.exports = router;
