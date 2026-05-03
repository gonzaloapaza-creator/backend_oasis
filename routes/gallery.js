const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/gallery/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)'));
    }
  }
});

// Get all gallery images
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, categoria } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM galeria WHERE estado = true';
    const params = [];
    let countQuery = 'SELECT COUNT(*) as total FROM galeria WHERE estado = true';

    if (categoria) {
      query += ' AND categoria = $1';
      countQuery += ' AND categoria = $1';
      params.push(categoria);
    }

    query += ' ORDER BY orden ASC, id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    console.error('Error getting gallery images:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get gallery image by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM galeria WHERE id = $1 AND estado = true';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting gallery image:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get gallery categories
router.get('/categories/list', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT categoria, 
             COUNT(*) as total_imagenes
      FROM galeria 
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
    console.error('Error getting gallery categories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Upload gallery image (admin only)
router.post('/', upload.single('imagen'), [
  body('titulo').optional().isString(),
  body('descripcion').optional().isString(),
  body('categoria').isIn(['habitaciones', 'servicios', 'eventos', 'instalaciones', 'general']).withMessage('Invalid category'),
  body('orden').optional().isInt({ min: 0 }).withMessage('Invalid order')
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    const { titulo, descripcion, categoria, orden = 0 } = req.body;
    const url_imagen = `/uploads/gallery/${req.file.filename}`;

    const query = `
      INSERT INTO galeria (titulo, descripcion, url_imagen, categoria, orden)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [titulo, descripcion, url_imagen, categoria, orden]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update gallery image (admin only)
router.put('/:id', [
  body('titulo').optional().isString(),
  body('descripcion').optional().isString(),
  body('categoria').optional().isIn(['habitaciones', 'servicios', 'eventos', 'instalaciones', 'general']),
  body('orden').optional().isInt({ min: 0 })
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
      UPDATE galeria 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Image updated successfully'
    });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update gallery image order (admin only)
router.patch('/:id/order', [
  body('orden').isInt({ min: 0 }).withMessage('Valid order is required')
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
    const { orden } = req.body;

    const query = `
      UPDATE galeria 
      SET orden = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [orden, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Image order updated successfully'
    });
  } catch (error) {
    console.error('Error updating image order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete gallery image (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get image info before deletion
    const getImageQuery = 'SELECT url_imagen FROM galeria WHERE id = $1';
    const imageResult = await pool.query(getImageQuery, [id]);

    if (imageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    const query = 'DELETE FROM galeria WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    // Delete file from filesystem (optional)
    const fs = require('fs');
    const imagePath = path.join(__dirname, '..', imageResult.rows[0].url_imagen);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Batch update image order (admin only)
router.patch('/order/batch', [
  body('images').isArray().withMessage('Images array is required'),
  body('images.*.id').isInt().withMessage('Valid image ID is required'),
  body('images.*.orden').isInt({ min: 0 }).withMessage('Valid order is required')
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

    const { images } = req.body;

    for (const image of images) {
      await client.query(`
        UPDATE galeria 
        SET orden = $1
        WHERE id = $2
      `, [image.orden, image.id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Images order updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating images order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
