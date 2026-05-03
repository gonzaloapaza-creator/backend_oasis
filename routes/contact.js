const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

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

// Sanitize user input to prevent XSS in email HTML
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Email configuration
const transporter = nodemailer.createTransport ? nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
}) : null;

// Get all contact messages (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, estado } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM mensajes_contacto';
    const params = [];
    let countQuery = 'SELECT COUNT(*) as total FROM mensajes_contacto';

    if (estado) {
      query += ' WHERE estado = $1';
      countQuery += ' WHERE estado = $1';
      params.push(estado);
    }

    query += ' ORDER BY fecha_envio DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    console.error('Error getting contact messages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get contact message by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM mensajes_contacto WHERE id = $1';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting contact message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create contact message
router.post('/', [
  body('nombre').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('telefono').optional().isString(),
  body('asunto').notEmpty().withMessage('Subject is required'),
  body('mensaje').notEmpty().withMessage('Message is required')
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

    const { nombre, email, telefono, asunto, mensaje } = req.body;

    const query = `
      INSERT INTO mensajes_contacto (nombre, email, telefono, asunto, mensaje)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [nombre, email, telefono, asunto, mensaje]);

    // Sanitize user inputs before using in HTML emails
    const safeNombre = escapeHtml(nombre);
    const safeEmail = escapeHtml(email);
    const safeTelefono = escapeHtml(telefono);
    const safeAsunto = escapeHtml(asunto);
    const safeMensaje = escapeHtml(mensaje);

    // Send email notification
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: process.env.HOTEL_EMAIL,
          subject: `Nuevo mensaje de contacto: ${safeAsunto}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #fa709a;">Nuevo Mensaje de Contacto</h2>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Nombre:</strong> ${safeNombre}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Teléfono:</strong> ${safeTelefono || 'No proporcionado'}</p>
                <p><strong>Asunto:</strong> ${safeAsunto}</p>
              </div>
              <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px;">
                <h3>Mensaje:</h3>
                <p style="white-space: pre-wrap;">${safeMensaje}</p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background-color: #d4edda; border-radius: 5px;">
                <p style="margin: 0; color: #155724;">
                  <strong>Fecha:</strong> ${new Date().toLocaleString('es-BO')}
                </p>
              </div>
            </div>
          `
        });

        // Send confirmation email to sender
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: 'Hemos recibido tu mensaje - Hotel Oasis Resort',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #fa709a;">Gracias por contactarnos</h2>
              <p>Estimado/a <strong>${safeNombre}</strong>,</p>
              <p>Hemos recibido tu mensaje con el asunto "<strong>${safeAsunto}</strong>" y te responderemos a la brevedad posible.</p>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Tu mensaje:</h3>
                <p style="white-space: pre-wrap; font-style: italic;">${safeMensaje}</p>
              </div>
              <div style="margin-top: 30px; padding: 20px; background-color: #e9ecef; border-radius: 8px; text-align: center;">
                <h3>Hotel Oasis Resort</h3>
                <p><strong>Dirección:</strong> ${process.env.HOTEL_ADDRESS}</p>
                <p><strong>Teléfono:</strong> ${process.env.HOTEL_PHONE}</p>
                <p><strong>Email:</strong> ${process.env.HOTEL_EMAIL}</p>
              </div>
              <p style="margin-top: 20px; text-align: center; color: #6c757d;">
                Este es un mensaje automático. Por favor no respondas a este email.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail request if email fails
      }
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error creating contact message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update message status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, [
  body('estado').isIn(['no_leido', 'leido', 'respondido']).withMessage('Invalid status')
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
      UPDATE mensajes_contacto 
      SET estado = $1, 
          fecha_respuesta = CASE WHEN $1 = 'respondido' THEN CURRENT_TIMESTAMP ELSE fecha_respuesta END
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Message status updated successfully'
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete message (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM mensajes_contacto WHERE id = $1 RETURNING *';
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get contact statistics (admin only)
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_mensajes,
        COUNT(CASE WHEN estado = 'no_leido' THEN 1 END) as no_leidos,
        COUNT(CASE WHEN estado = 'leido' THEN 1 END) as leidos,
        COUNT(CASE WHEN estado = 'respondido' THEN 1 END) as respondidos,
        COUNT(CASE WHEN fecha_envio >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as ultima_semana,
        COUNT(CASE WHEN fecha_envio >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as ultimo_mes
      FROM mensajes_contacto
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting contact statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
