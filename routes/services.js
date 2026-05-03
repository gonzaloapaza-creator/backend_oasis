const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Get all services
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM servicios WHERE estado = true';
    const params = [];

    if (category) {
      query += ' AND categoria = $1';
      params.push(category);
    }

    query += ' ORDER BY categoria, nombre';

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM servicios WHERE id = $1 AND estado = true';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting service:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get service categories
router.get('/categories/list', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT categoria, 
             COUNT(*) as total_servicios
      FROM servicios 
      WHERE estado = true AND categoria IS NOT NULL
      GROUP BY categoria
      ORDER BY categoria
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting service categories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create service (admin only)
router.post('/', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('descripcion').optional().isString(),
  body('precio').isFloat({ min: 0 }).withMessage('Invalid price'),
  body('requiere_reserva').optional().isBoolean(),
  body('categoria').optional().isString(),
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

    const { nombre, descripcion, precio, requiere_reserva, categoria, imagen_url } = req.body;

    const query = `
      INSERT INTO servicios (nombre, descripcion, precio, requiere_reserva, categoria, imagen_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      nombre, 
      descripcion, 
      precio || 0, 
      requiere_reserva || false, 
      categoria, 
      imagen_url
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Service created successfully'
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update service (admin only)
router.put('/:id', [
  body('nombre').optional().notEmpty().withMessage('Name cannot be empty'),
  body('descripcion').optional().isString(),
  body('precio').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
  body('requiere_reserva').optional().isBoolean(),
  body('categoria').optional().isString(),
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

    // Build dynamic query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE servicios 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Service updated successfully'
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete service (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if service is being used in reservations
    const checkQuery = 'SELECT COUNT(*) as count FROM reserva_servicios WHERE servicio_id = $1 AND estado IN ($2, $3)';
    const checkResult = await pool.query(checkQuery, [id, 'pendiente', 'confirmado']);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete service that is currently reserved'
      });
    }

    const query = 'UPDATE servicios SET estado = false WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Reserve service
router.post('/:id/reserve', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('telefono').optional().isString(),
  body('fecha_servicio').isDate().withMessage('Valid service date is required'),
  body('cantidad').optional().isInt({ min: 1, max: 20 }).withMessage('Invalid quantity'),
  body('notas').optional().isString()
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
    const { nombre, email, telefono, fecha_servicio, cantidad = 1, notas } = req.body;

    // Check if service exists and requires reservation
    const serviceQuery = 'SELECT * FROM servicios WHERE id = $1 AND estado = true';
    const serviceResult = await pool.query(serviceQuery, [id]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    const service = serviceResult.rows[0];

    if (!service.requiere_reserva) {
      return res.status(400).json({
        success: false,
        error: 'This service does not require reservation'
      });
    }

    // Create service reservation
    const reservationQuery = `
      INSERT INTO reserva_servicios (servicio_id, nombre, email, telefono, fecha_servicio, cantidad, precio_unitario, subtotal, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
      RETURNING *
    `;

    const subtotal = service.precio * cantidad;
    const reservationResult = await pool.query(reservationQuery, [
      id, nombre, email, telefono, fecha_servicio, cantidad, service.precio, subtotal
    ]);

    res.status(201).json({
      success: true,
      data: reservationResult.rows[0],
      message: 'Service reservation created successfully'
    });
  } catch (error) {
    console.error('Error creating service reservation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
