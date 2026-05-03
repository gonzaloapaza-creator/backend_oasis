const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Get all events
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, estado } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM eventos';
    const params = [];
    let countQuery = 'SELECT COUNT(*) as total FROM eventos';

    if (estado !== undefined) {
      query += ' WHERE estado = $1';
      countQuery += ' WHERE estado = $1';
      params.push(estado === 'true');
    }

    query += ' ORDER BY fecha_inicio DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM eventos WHERE id = $1';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get upcoming events
router.get('/upcoming/list', async (req, res) => {
  try {
    const query = `
      SELECT * FROM eventos 
      WHERE estado = true AND fecha_inicio > CURRENT_TIMESTAMP
      ORDER BY fecha_inicio ASC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create event (admin only)
router.post('/', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('descripcion').optional().isString(),
  body('fecha_inicio').isISO8601().withMessage('Valid start date is required'),
  body('fecha_fin').isISO8601().withMessage('Valid end date is required'),
  body('capacidad_maxima').optional().isInt({ min: 1 }).withMessage('Invalid capacity'),
  body('precio_entrada').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
  body('ubicacion').optional().isString(),
  body('imagen_url').optional().isURL()
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

    const { 
      nombre, 
      descripcion, 
      fecha_inicio, 
      fecha_fin, 
      capacidad_maxima, 
      precio_entrada, 
      ubicacion, 
      imagen_url 
    } = req.body;

    // Validate dates
    if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    const query = `
      INSERT INTO eventos (nombre, descripcion, fecha_inicio, fecha_fin, capacidad_maxima, precio_entrada, ubicacion, imagen_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      nombre, 
      descripcion, 
      fecha_inicio, 
      fecha_fin, 
      capacidad_maxima, 
      precio_entrada || 0, 
      ubicacion, 
      imagen_url
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update event (admin only)
router.put('/:id', [
  body('nombre').optional().notEmpty().withMessage('Name cannot be empty'),
  body('descripcion').optional().isString(),
  body('fecha_inicio').optional().isISO8601().withMessage('Valid start date is required'),
  body('fecha_fin').optional().isISO8601().withMessage('Valid end date is required'),
  body('capacidad_maxima').optional().isInt({ min: 1 }).withMessage('Invalid capacity'),
  body('precio_entrada').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
  body('ubicacion').optional().isString(),
  body('imagen_url').optional().isURL()
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

    // Validate dates if both are provided
    if (updates.fecha_inicio && updates.fecha_fin) {
      if (new Date(updates.fecha_fin) <= new Date(updates.fecha_inicio)) {
        return res.status(400).json({
          success: false,
          error: 'End date must be after start date'
        });
      }
    }

    // Build dynamic query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE eventos 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete event (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event has registrations
    const checkQuery = 'SELECT COUNT(*) as count FROM registro_eventos WHERE evento_id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete event that has registrations'
      });
    }

    const query = 'DELETE FROM eventos WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Register for event
router.post('/:id/register', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('telefono').optional().isString(),
  body('cantidad_entradas').isInt({ min: 1, max: 10 }).withMessage('Invalid ticket quantity')
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
    const { nombre, email, telefono, cantidad_entradas = 1 } = req.body;

    // Check if event exists and is active
    const eventQuery = 'SELECT * FROM eventos WHERE id = $1 AND estado = true';
    const eventResult = await pool.query(eventQuery, [id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or not active'
      });
    }

    const event = eventResult.rows[0];

    // Check if event is in the future
    if (new Date(event.fecha_inicio) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot register for past events'
      });
    }

    // Check capacity
    const capacityQuery = `
      SELECT SUM(cantidad_entradas) as total_registrados
      FROM registro_eventos 
      WHERE evento_id = $1 AND estado IN ('confirmado', 'pendiente')
    `;
    const capacityResult = await pool.query(capacityQuery, [id]);
    const totalRegistrados = parseInt(capacityResult.rows[0].total_registrados) || 0;

    if (totalRegistrados + cantidad_entradas > event.capacidad_maxima) {
      return res.status(400).json({
        success: false,
        error: 'Not enough capacity available'
      });
    }

    // Calculate total amount
    const monto_total = event.precio_entrada * cantidad_entradas;

    // Create registration
    const insertRegistrationQuery = `
      INSERT INTO registro_eventos (evento_id, nombre, email, telefono, cantidad_entradas, monto_total, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmado')
      RETURNING *
    `;

    const registrationResult = await pool.query(insertRegistrationQuery, [
      id, nombre, email, telefono, cantidad_entradas, monto_total
    ]);

    res.status(201).json({
      success: true,
      data: registrationResult.rows[0],
      message: 'Event registration successful'
    });
  } catch (error) {
    console.error('Error creating event registration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get event registrations (admin only)
router.get('/:id/registrations', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, estado } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM registro_eventos WHERE evento_id = $1';
    const params = [id];
    let countQuery = 'SELECT COUNT(*) as total FROM registro_eventos WHERE evento_id = $1';

    if (estado) {
      query += ' AND estado = $' + (params.length + 1);
      countQuery += ' AND estado = $' + (params.length + 1);
      params.push(estado);
    }

    query += ' ORDER BY fecha_registro DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    console.error('Error getting event registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
