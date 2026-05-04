const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Get all room types
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        th.*,
        COUNT(h.id) as total_habitaciones,
        COUNT(CASE WHEN h.estado = 'disponible' THEN 1 END) as disponibles
      FROM tipos_habitacion th
      LEFT JOIN habitaciones h ON th.id = h.tipo_habitacion_id
      WHERE th.estado = true
      GROUP BY th.id
      ORDER BY th.precio_base
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting room types:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get room type by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        th.*,
        COUNT(h.id) as total_habitaciones,
        COUNT(CASE WHEN h.estado = 'disponible' THEN 1 END) as disponibles
      FROM tipos_habitacion th
      LEFT JOIN habitaciones h ON th.id = h.tipo_habitacion_id
      WHERE th.id = $1 AND th.estado = true
      GROUP BY th.id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting room type:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Check room availability
router.post('/check-availability', [
  body('check_in').isDate().withMessage('Invalid check-in date'),
  body('check_out').isDate().withMessage('Invalid check-out date'),
  body('guests').isInt({ min: 1, max: 10 }).withMessage('Invalid number of guests'),
  body('room_type_id').optional().isInt().withMessage('Invalid room type ID')
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

    const { check_in, check_out, guests, room_type_id } = req.body;

    const query = `
      SELECT DISTINCT
        th.id,
        th.nombre,
        th.descripcion,
        th.capacidad_maxima,
        th.precio_base,
        th.amenities,
        th.imagen_url,
        COUNT(h.id) FILTER (WHERE h.estado = 'disponible') as disponibles
      FROM tipos_habitacion th
      LEFT JOIN habitaciones h ON th.id = h.tipo_habitacion_id
      WHERE th.estado = true
        AND th.capacidad_maxima >= $1
        ${room_type_id ? 'AND th.id = $4' : ''}
        AND NOT EXISTS (
          SELECT 1 FROM reserva_detalles rd
          JOIN reservas r ON rd.reserva_id = r.id
          WHERE rd.habitacion_id = h.id
            AND r.estado IN ('confirmada', 'completada')
            AND (
              (r.fecha_check_in <= $2 AND r.fecha_check_out > $2) OR
              (r.fecha_check_in < $3 AND r.fecha_check_out >= $3) OR
              (r.fecha_check_in >= $2 AND r.fecha_check_out <= $3)
            )
        )
      GROUP BY th.id, th.nombre, th.descripcion, th.capacidad_maxima, th.precio_base, th.amenities, th.imagen_url
      HAVING COUNT(h.id) FILTER (WHERE h.estado = 'disponible') > 0
      ORDER BY th.precio_base
    `;

    const params = room_type_id ? [guests, check_in, check_out, room_type_id] : [guests, check_in, check_out];
    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create room type (admin only)
router.post('/', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('descripcion').optional().isString(),
  body('capacidad_maxima').isInt({ min: 1, max: 10 }).withMessage('Invalid capacity'),
  body('precio_base').isFloat({ min: 0 }).withMessage('Invalid price'),
  body('amenities').optional().isArray(),
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

    const { nombre, descripcion, capacidad_maxima, precio_base, amenities, imagen_url } = req.body;

    const query = `
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad_maxima, precio_base, amenities, imagen_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [nombre, descripcion, capacidad_maxima, precio_base, amenities, imagen_url]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Room type created successfully'
    });
  } catch (error) {
    console.error('Error creating room type:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update room type (admin only)
router.put('/:id', [
  body('nombre').optional().notEmpty().withMessage('Name cannot be empty'),
  body('descripcion').optional().isString(),
  body('capacidad_maxima').optional().isInt({ min: 1, max: 10 }).withMessage('Invalid capacity'),
  body('precio_base').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
  body('amenities').optional().isArray(),
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
      UPDATE tipos_habitacion 
      SET ${setClause}, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Room type updated successfully'
    });
  } catch (error) {
    console.error('Error updating room type:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete room type (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if room type is being used
    const checkQuery = 'SELECT COUNT(*) as count FROM habitaciones WHERE tipo_habitacion_id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete room type that is in use'
      });
    }

    const query = 'DELETE FROM tipos_habitacion WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Room type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room type:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
