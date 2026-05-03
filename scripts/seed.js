const pool = require('../config/database');

async function runSeed() {
  try {
    console.log('Starting database seeding...');
    
    // Insertar tipos de habitacion
    console.log('Inserting room types...');
    await pool.query(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad_maxima, precio_base, amenities, imagen_url) VALUES
      ('Habitacion Estandar', 'Comoda y funcional con todas las comodidades esenciales', 1, 280.00, ARRAY['WiFi', 'TV LED', 'Bano privado', 'Aire acondicionado', 'Caja fuerte'], '/uploads/rooms/estandar.jpg'),
      ('Habitacion Doble Superior', 'Espaciosa con cama king size, ideal para parejas', 2, 450.00, ARRAY['WiFi', 'TV Smart 50', 'Vista al jardin', 'Mini bar', 'Aire acondicionado', 'Escritorio'], '/uploads/rooms/doble-superior.jpg'),
      ('Habitacion Doble Deluxe', 'Elegante con balcon y vistas al mar', 2, 580.00, ARRAY['WiFi premium', 'TV Smart 55', 'Vista al mar', 'Mini bar premium', 'Balcon privado', 'Bata y pantuflas'], '/uploads/rooms/doble-deluxe.jpg'),
      ('Habitacion Familiar', 'Amplia para familias con espacio separado para ninos', 5, 750.00, ARRAY['WiFi', '2 TV Smart', 'Area infantil', 'Mini bar', 'Bano doble', 'Sofa cama'], '/uploads/rooms/familiar.jpg'),
      ('Suite Junior', 'Sala de estar independiente, jacuzzi y vistas panoramicas', 3, 1050.00, ARRAY['WiFi premium', 'TV Smart 60', 'Sala de estar', 'Vista panoramica', 'Room service 24h', 'Jacuzzi'], '/uploads/rooms/suite-junior.jpg'),
      ('Suite Ejecutiva', 'Sala de reuniones privada, terraza y servicio personalizado', 3, 1400.00, ARRAY['WiFi dedicado', 'TV Smart 65', 'Sala de reuniones', 'Terraza privada', 'Room service 24h', 'Jacuzzi'], '/uploads/rooms/suite-ejecutiva.jpg'),
      ('Suite Presidencial', 'Maximo lujo con comedor privado y terraza panoramica', 4, 2200.00, ARRAY['WiFi dedicado', 'TV Smart 75', 'Comedor privado', 'Terraza panoramica', 'Jacuzzi privado', 'Conserje 24h', 'Transfer incluido'], '/uploads/rooms/suite-presidencial.jpg'),
      ('Penthouse Royal', 'Piscina privada, terraza 360 y los mas altos estandares', 6, 3500.00, ARRAY['WiFi dedicado', 'Smart TV 85', 'Cocina completa', 'Terraza 360', 'Piscina privada', 'Jacuzzi', 'Conserje 24h', 'Transfer VIP'], '/uploads/rooms/penthouse.jpg')
      ON CONFLICT DO NOTHING
    `);

    // Insertar habitaciones (60 rooms across 5 floors)
    console.log('Inserting rooms...');
    const roomTypesResult = await pool.query('SELECT id FROM tipos_habitacion ORDER BY id');
    const roomTypesDB = roomTypesResult.rows;

    // Floor layouts: typeIndex per room slot (0-based index into roomTypesDB)
    const floorLayouts = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 0, 1],   // Floor 1: Estandar, Doble Sup, Doble Dlx, Familiar
      [0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 1],     // Floor 2
      [1, 1, 2, 2, 4, 4, 4, 5, 5, 3, 2, 2],     // Floor 3
      [2, 2, 4, 4, 5, 5, 5, 6, 6, 3, 4, 5],     // Floor 4
      [4, 4, 5, 5, 6, 6, 6, 7, 7, 5, 6, 7]      // Floor 5
    ];

    for (let floor = 0; floor < 5; floor++) {
      for (let slot = 0; slot < floorLayouts[floor].length; slot++) {
        const typeIdx = floorLayouts[floor][slot];
        if (typeIdx < roomTypesDB.length) {
          const roomNum = `${floor + 1}${String(slot + 1).padStart(2, '0')}`;
          const estado = Math.random() < 0.55 ? 'ocupada' : 'disponible';
          await pool.query(`
            INSERT INTO habitaciones (numero, piso, tipo_habitacion_id, estado) VALUES
            ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
          `, [roomNum, floor + 1, roomTypesDB[typeIdx].id, estado]);
        }
      }
    }

    // Insertar servicios
    console.log('Inserting services...');
    await pool.query(`
      INSERT INTO servicios (nombre, descripcion, precio, requiere_reserva, categoria, imagen_url) VALUES
      ('Spa & Wellness', 'Tratamientos de relajación y belleza', 80.00, true, 'bienestar', '/uploads/services/spa.jpg'),
      ('Restaurante Gourmet', 'Experiencia culinaria de alto nivel', 120.00, true, 'gastronomia', '/uploads/services/restaurante.jpg'),
      ('Piscina Infinity', 'Piscina con vista infinita al mar', 0.00, false, 'recreacion', '/uploads/services/piscina.jpg'),
      ('Lounge & Bar', 'Bar exclusivo con música en vivo', 50.00, true, 'entretenimiento', '/uploads/services/lounge.jpg'),
      ('Transporte Privado', 'Servicio de transfer privado', 150.00, true, 'transporte', '/uploads/services/transporte.jpg'),
      ('Kids Club', 'Actividades supervisadas para niños', 80.00, true, 'infantil', '/uploads/services/kids-club.jpg'),
      ('Business Center', 'Instalaciones para reuniones y trabajo', 100.00, true, 'negocios', '/uploads/services/business-center.jpg'),
      ('Tienda Boutique', 'Artículos exclusivos y souvenirs', 0.00, false, 'compras', '/uploads/services/tienda.jpg')
      ON CONFLICT DO NOTHING
    `);

    // Insertar eventos
    console.log('Inserting events...');
    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    await pool.query(`
      INSERT INTO eventos (nombre, descripcion, fecha_inicio, fecha_fin, capacidad_maxima, precio_entrada, ubicacion, imagen_url) VALUES
      ('Noche de Música en Vivo', 'Disfruta de la mejor música en vivo con artistas locales', $1, $2, 100, 50.00, 'Lounge Bar', '/uploads/events/musica-en-vivo.jpg'),
      ('Festival Gastronómico', 'Sabor local e internacional en un solo lugar', $3, $4, 150, 80.00, 'Restaurante Principal', '/uploads/events/festival-gastronomico.jpg'),
      ('Torneo de Piscina', 'Competencias amistosas para todas las edades', $5, $6, 50, 30.00, 'Piscina Infinity', '/uploads/events/torneo-piscina.jpg'),
      ('Cata de Vinos', 'Selección exclusiva de vinos nacionales e internacionales', $7, $8, 30, 120.00, 'Sala de Eventos', '/uploads/events/cata-vinos.jpg')
      ON CONFLICT DO NOTHING
    `, [
      currentDate, new Date(currentDate.getTime() + 4 * 60 * 60 * 1000), // 4 hours from now
      new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      new Date(currentDate.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
      new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      new Date(currentDate.getTime() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      new Date(currentDate.getTime() + 22 * 24 * 60 * 60 * 1000), // 22 days from now
      futureDate,
      new Date(futureDate.getTime() + 3 * 60 * 60 * 1000) // 3 hours after start
    ]);

    // Insertar galería
    console.log('Inserting gallery images...');
    await pool.query(`
      INSERT INTO galeria (titulo, descripcion, url_imagen, categoria, orden) VALUES
      ('Suite Presidencial', 'Lujo máximo con jacuzzi privado', '/uploads/gallery/suite-presidencial.jpg', 'habitaciones', 1),
      ('Restaurante Principal', 'Ambiente elegante y sofisticado', '/uploads/gallery/restaurante.jpg', 'instalaciones', 2),
      ('Piscina Infinity', 'Vista infinita al atardecer', '/uploads/gallery/piscina.jpg', 'instalaciones', 3),
      ('Spa Wellness', 'Relajación y tratamientos de belleza', '/uploads/gallery/spa.jpg', 'servicios', 4),
      ('Lounge Bar', 'Música en vivo y cócteles exclusivos', '/uploads/gallery/lounge.jpg', 'servicios', 5),
      ('Kids Club', 'Área segura y divertida para niños', '/uploads/gallery/kids-club.jpg', 'instalaciones', 6),
      ('Business Center', 'Salas modernas para reuniones', '/uploads/gallery/business-center.jpg', 'instalaciones', 7),
      ('Vista al Atardecer', 'Panorámica espectacular desde el hotel', '/uploads/gallery/atardecer.jpg', 'general', 8)
      ON CONFLICT DO NOTHING
    `);

    // Insertar configuración
    console.log('Inserting hotel configuration...');
    await pool.query(`
      INSERT INTO configuracion_hotel (clave, valor, descripcion) VALUES
      ('hotel_nombre', 'Hotel Oasis Resort', 'Nombre del hotel'),
      ('hotel_direccion', 'Av. Mariscal Santa Cruz #1234, La Paz, Bolivia', 'Dirección del hotel'),
      ('hotel_telefono', '+591 2 2123456', 'Teléfono principal'),
      ('hotel_email', 'info@hoteloasisresort.com', 'Email principal'),
      ('check_in_time', '14:00', 'Hora de check-in'),
      ('check_out_time', '11:00', 'Hora de check-out'),
      ('moneda', 'BOB', 'Moneda por defecto'),
      ('idioma', 'es', 'Idioma por defecto'),
      ('timezone', 'America/La_Paz', 'Zona horaria')
      ON CONFLICT (clave) DO UPDATE SET 
        valor = EXCLUDED.valor, 
        fecha_actualizacion = CURRENT_TIMESTAMP
    `);

    // Crear usuario admin por defecto
    console.log('Creating default admin user...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, estado) VALUES
      ('Administrador', 'Sistema', 'admin@hoteloasisresort.com', $1, 'admin', true)
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    console.log('Database seeding completed successfully');
    console.log('');
    console.log('Default Admin Credentials:');
    console.log('   Email: admin@hoteloasisresort.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('Please change the default password after first login!');
    
    // Close the connection
    await pool.end();
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
