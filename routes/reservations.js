const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

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

// Generate unique reservation code
const generateReservationCode = () => {
  return 'HOR' + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// Check room availability
const checkAvailability = async (habitacion_id, fecha_check_in, fecha_check_out) => {
  const query = `
    SELECT COUNT(*) as conflictos
    FROM reserva_detalles rd
    JOIN reservas r ON rd.reserva_id = r.id
    WHERE rd.habitacion_id = $1
      AND r.estado IN ('confirmada', 'completada')
      AND (
        (r.fecha_check_in <= $2 AND r.fecha_check_out > $2) OR
        (r.fecha_check_in < $3 AND r.fecha_check_out >= $3) OR
        (r.fecha_check_in >= $2 AND r.fecha_check_out <= $3)
      )
  `;

  const result = await pool.query(query, [habitacion_id, fecha_check_in, fecha_check_out]);
  return parseInt(result.rows[0].conflictos) === 0;
};

// Get all reservations (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, estado, cliente_id } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.*,
        c.nombre || ' ' || c.apellido as cliente_nombre,
        c.email as cliente_email,
        c.telefono as cliente_telefono
      FROM reservas r
      JOIN clientes c ON r.cliente_id = c.id
    `;
    const params = [];
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM reservas r
      JOIN clientes c ON r.cliente_id = c.id
    `;

    const conditions = [];
    if (estado) {
      conditions.push(`r.estado = $${params.length + 1}`);
      params.push(estado);
    }
    if (cliente_id) {
      conditions.push(`r.cliente_id = $${params.length + 1}`);
      params.push(cliente_id);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY r.fecha_creacion DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    console.error('Error getting reservations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get reservation by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        r.*,
        c.nombre || ' ' || c.apellido as cliente_nombre,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        c.direccion as cliente_direccion,
        c.documento_identidad as cliente_documento,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'habitacion_id', rd.habitacion_id,
            'numero_habitacion', h.numero,
            'tipo_habitacion', th.nombre,
            'precio_noche', rd.precio_noche,
            'cantidad_noches', rd.cantidad_noches,
            'subtotal', rd.subtotal
          )
        ) as detalles_habitaciones,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'servicio_id', rs.servicio_id,
            'nombre_servicio', s.nombre,
            'fecha_servicio', rs.fecha_servicio,
            'cantidad', rs.cantidad,
            'precio_unitario', rs.precio_unitario,
            'subtotal', rs.subtotal,
            'estado', rs.estado
          )
        ) as detalles_servicios
      FROM reservas r
      JOIN clientes c ON r.cliente_id = c.id
      LEFT JOIN reserva_detalles rd ON r.id = rd.reserva_id
      LEFT JOIN habitaciones h ON rd.habitacion_id = h.id
      LEFT JOIN tipos_habitacion th ON h.tipo_habitacion_id = th.id
      LEFT JOIN reserva_servicios rs ON r.id = rs.reserva_id
      LEFT JOIN servicios s ON rs.servicio_id = s.id
      WHERE r.id = $1
      GROUP BY r.id, c.nombre, c.apellido, c.email, c.telefono, c.direccion, c.documento_identidad
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting reservation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create reservation
router.post('/', [
  body('cliente_id').isUUID().withMessage('Valid client ID is required'),
  body('fecha_check_in').isDate().withMessage('Valid check-in date is required'),
  body('fecha_check_out').isDate().withMessage('Valid check-out date is required'),
  body('cantidad_huespedes').isInt({ min: 1, max: 20 }).withMessage('Invalid number of guests'),
  body('habitaciones').isArray({ min: 1 }).withMessage('At least one room is required'),
  body('habitaciones.*.habitacion_id').isInt().withMessage('Valid room ID is required'),
  body('habitaciones.*.cantidad_noches').isInt({ min: 1 }).withMessage('Valid number of nights is required'),
  body('notas').optional().isString()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { 
      cliente_id, 
      fecha_check_in, 
      fecha_check_out, 
      cantidad_huespedes, 
      habitaciones, 
      notas 
    } = req.body;

    // Validate dates
    if (new Date(fecha_check_out) <= new Date(fecha_check_in)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Check availability for all rooms
    for (const habitacion of habitaciones) {
      const isAvailable = await checkAvailability(
        habitacion.habitacion_id, 
        fecha_check_in, 
        fecha_check_out
      );
      
      if (!isAvailable) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Room ${habitacion.habitacion_id} is not available for the selected dates`
        });
      }
    }

    // Generate reservation code
    const codigo_reserva = generateReservationCode();

    // Calculate total amount
    let monto_total = 0;
    const detalles_habitaciones = [];

    for (const habitacion of habitaciones) {
      // Get room price
      const precioQuery = `
        SELECT th.precio_base
        FROM habitaciones h
        JOIN tipos_habitacion th ON h.tipo_habitacion_id = th.id
        WHERE h.id = $1
      `;
      const precioResult = await client.query(precioQuery, [habitacion.habitacion_id]);
      
      if (precioResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Room ${habitacion.habitacion_id} not found`
        });
      }

      const precio_noche = precioResult.rows[0].precio_base;
      const subtotal = precio_noche * habitacion.cantidad_noches;
      monto_total += subtotal;

      detalles_habitaciones.push({
        habitacion_id: habitacion.habitacion_id,
        precio_noche,
        cantidad_noches: habitacion.cantidad_noches,
        subtotal
      });
    }

    // Create reservation
    const reservaQuery = `
      INSERT INTO reservas (cliente_id, codigo_reserva, fecha_check_in, fecha_check_out, cantidad_huespedes, monto_total, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const reservaResult = await client.query(reservaQuery, [
      cliente_id,
      codigo_reserva,
      fecha_check_in,
      fecha_check_out,
      cantidad_huespedes,
      monto_total,
      notas
    ]);

    const reserva = reservaResult.rows[0];

    // Create reservation details
    for (const detalle of detalles_habitaciones) {
      await client.query(`
        INSERT INTO reserva_detalles (reserva_id, habitacion_id, precio_noche, cantidad_noches, subtotal)
        VALUES ($1, $2, $3, $4, $5)
      `, [reserva.id, detalle.habitacion_id, detalle.precio_noche, detalle.cantidad_noches, detalle.subtotal]);
    }

    // Update room status
    for (const habitacion of habitaciones) {
      await client.query(`
        UPDATE habitaciones 
        SET estado = 'ocupada' 
        WHERE id = $1
      `, [habitacion.habitacion_id]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        ...reserva,
        detalles_habitaciones
      },
      message: 'Reservation created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating reservation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Update reservation status
router.patch('/:id/status', authenticateToken, [
  body('estado').isIn(['pendiente', 'confirmada', 'cancelada', 'completada']).withMessage('Invalid status')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { estado } = req.body;

    // Get current reservation details
    const currentQuery = `
      SELECT r.estado, 
             ARRAY_AGG(rd.habitacion_id) as habitaciones
      FROM reservas r
      LEFT JOIN reserva_detalles rd ON r.id = rd.reserva_id
      WHERE r.id = $1
      GROUP BY r.id, r.estado
    `;
    
    const currentResult = await client.query(currentQuery, [id]);
    
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    const currentReserva = currentResult.rows[0];

    // Update reservation status
    const updateQuery = `
      UPDATE reservas 
      SET estado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [estado, id]);

    // If reservation is cancelled, free up the rooms
    if (estado === 'cancelada' && currentReserva.estado !== 'cancelada') {
      for (const habitacion_id of currentReserva.habitaciones) {
        await client.query(`
          UPDATE habitaciones 
          SET estado = 'disponible' 
          WHERE id = $1
        `, [habitacion_id]);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: `Reservation status updated to ${estado}`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating reservation status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Cancel reservation
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get reservation details
    const reservaQuery = `
      SELECT r.estado, 
             ARRAY_AGG(rd.habitacion_id) as habitaciones
      FROM reservas r
      LEFT JOIN reserva_detalles rd ON r.id = rd.reserva_id
      WHERE r.id = $1
      GROUP BY r.id, r.estado
    `;
    
    const reservaResult = await client.query(reservaQuery, [id]);
    
    if (reservaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    const reserva = reservaResult.rows[0];

    if (reserva.estado === 'completada') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel completed reservation'
      });
    }

    // Update reservation status
    await client.query(`
      UPDATE reservas 
      SET estado = 'cancelada', fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Free up the rooms
    for (const habitacion_id of reserva.habitaciones) {
      await client.query(`
        UPDATE habitaciones 
        SET estado = 'disponible' 
        WHERE id = $1
      `, [habitacion_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling reservation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
