const pool = require('../config/database');

async function populateSampleData() {
  try {
    console.log('🌱 Poblando base de datos con datos de ejemplo...');

    // Insertar tipos de habitación
    console.log('📝 Insertando tipos de habitación...');
    await pool.query(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad_maxima, precio_base, amenities, imagen_url) VALUES
      ('Suite Presidencial', 'Lujo máximo con vista panorámica y jacuzzi privado', 4, 350.00, ARRAY['jacuzzi', 'balcón', 'minibar', 'sala de estar', 'vista al mar'], '/uploads/rooms/suite-presidencial.jpg'),
      ('Suite Junior', 'Espaciosa y elegante con balcón privado', 3, 250.00, ARRAY['balcón', 'minibar', 'sofa cama', 'escritorio'], '/uploads/rooms/suite-junior.jpg'),
      ('Habitación Doble Deluxe', 'Perfecta para parejas con cama king size', 2, 180.00, ARRAY['cama king', 'baño privado', 'balcón', 'minibar'], '/uploads/rooms/habitacion-doble.jpg'),
      ('Habitación Individual', 'Cómoda y funcional para viajeros solos', 1, 120.00, ARRAY['cama individual', 'escritorio', 'armario'], '/uploads/rooms/habitacion-individual.jpg')
      ON CONFLICT DO NOTHING
    `);

    // Insertar habitaciones
    console.log('🏨 Insertando habitaciones...');
    const roomTypesResult = await pool.query('SELECT id FROM tipos_habitacion ORDER BY id');
    const roomTypes = roomTypesResult.rows;
    
    for (let i = 0; i < roomTypes.length; i++) {
      for (let j = 1; j <= 3; j++) {
        await pool.query(`
          INSERT INTO habitaciones (numero, piso, tipo_habitacion_id, estado) VALUES
          ($1, $2, $3, 'disponible')
          ON CONFLICT DO NOTHING
        `, [`${roomTypes[i].id}0${j}`, j, roomTypes[i].id]);
      }
    }

    // Insertar servicios
    console.log('🛎️ Insertando servicios...');
    await pool.query(`
      INSERT INTO servicios (nombre, descripcion, precio, requiere_reserva, categoria, imagen_url) VALUES
      ('Spa & Wellness', 'Tratamientos de relajación y belleza con masajistas profesionales', 80.00, true, 'bienestar', '/uploads/services/spa.jpg'),
      ('Restaurante Gourmet', 'Experiencia culinaria de alto nivel con chef internacional', 120.00, true, 'gastronomia', '/uploads/services/restaurante.jpg'),
      ('Piscina Infinity', 'Piscina con vista infinita al mar y bar', 0.00, false, 'recreacion', '/uploads/services/piscina.jpg'),
      ('Lounge & Bar', 'Bar exclusivo con música en vivo y cócteles premium', 50.00, true, 'entretenimiento', '/uploads/services/lounge.jpg'),
      ('Transporte Privado', 'Servicio de transfer privado desde/hacia aeropuerto', 150.00, true, 'transporte', '/uploads/services/transporte.jpg'),
      ('Kids Club', 'Actividades supervisadas para niños de 3-12 años', 80.00, true, 'infantil', '/uploads/services/kids-club.jpg'),
      ('Business Center', 'Instalaciones para reuniones y trabajo con WiFi', 100.00, true, 'negocios', '/uploads/services/business-center.jpg'),
      ('Tienda Boutique', 'Artículos exclusivos y souvenirs del hotel', 0.00, false, 'compras', '/uploads/services/tienda.jpg')
      ON CONFLICT DO NOTHING
    `);

    // Insertar eventos
    console.log('🎉 Insertando eventos...');
    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    await pool.query(`
      INSERT INTO eventos (nombre, descripcion, fecha_inicio, fecha_fin, capacidad_maxima, precio_entrada, ubicacion, imagen_url) VALUES
      ('Noche de Música en Vivo', 'Disfruta de la mejor música en vivo con artistas locales y cócteles exclusivos', $1, $2, 100, 50.00, 'Lounge Bar', '/uploads/events/musica-en-vivo.jpg'),
      ('Festival Gastronómico', 'Sabor local e internacional en un solo lugar con chefs reconocidos', $3, $4, 150, 80.00, 'Restaurante Principal', '/uploads/events/festival-gastronomico.jpg'),
      ('Torneo de Piscina', 'Competencias amistosas para todas las edades con premios', $5, $6, 50, 30.00, 'Piscina Infinity', '/uploads/events/torneo-piscina.jpg'),
      ('Cata de Vinos', 'Selección exclusiva de vinos nacionales e internacionales con sommelier', $7, $8, 30, 120.00, 'Sala de Eventos', '/uploads/events/cata-vinos.jpg')
      ON CONFLICT DO NOTHING
    `, [
      currentDate, new Date(currentDate.getTime() + 4 * 60 * 60 * 1000),
      new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000), new Date(currentDate.getTime() + 8 * 24 * 60 * 60 * 1000),
      new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000), new Date(currentDate.getTime() + 21 * 24 * 60 * 60 * 1000),
      futureDate,
      new Date(futureDate.getTime() + 3 * 60 * 60 * 1000)
    ]);

    // Insertar galería
    console.log('🖼️ Insertando galería...');
    await pool.query(`
      INSERT INTO galeria (titulo, descripcion, url_imagen, categoria, orden) VALUES
      ('Suite Presidencial', 'Lujo máximo con jacuzzi privado y vista panorámica', '/uploads/gallery/suite-presidencial.jpg', 'habitaciones', 1),
      ('Restaurante Principal', 'Ambiente elegante y sofisticado con vista al mar', '/uploads/gallery/restaurante.jpg', 'instalaciones', 2),
      ('Piscina Infinity', 'Vista infinita al atardecer desde la piscina', '/uploads/gallery/piscina.jpg', 'instalaciones', 3),
      ('Spa Wellness', 'Relajación y tratamientos de belleza', '/uploads/gallery/spa.jpg', 'servicios', 4),
      ('Lounge Bar', 'Música en vivo y cócteles exclusivos', '/uploads/gallery/lounge.jpg', 'servicios', 5),
      ('Kids Club', 'Área segura y divertida para niños', '/uploads/gallery/kids-club.jpg', 'instalaciones', 6),
      ('Business Center', 'Salas modernas para reuniones y trabajo', '/uploads/gallery/business-center.jpg', 'instalaciones', 7),
      ('Vista al Atardecer', 'Panorámica espectacular desde el hotel', '/uploads/gallery/atardecer.jpg', 'general', 8)
      ON CONFLICT DO NOTHING
    `);

    // Insertar configuración
    console.log('⚙️ Insertando configuración del hotel...');
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

    console.log('✅ Datos de ejemplo insertados exitosamente');
    console.log('');
    console.log('🎯 Datos creados:');
    console.log('   • 4 tipos de habitación');
    console.log('   • 12 habitaciones (3 por tipo)');
    console.log('   • 8 servicios diferentes');
    console.log('   • 4 eventos próximos');
    console.log('   • 8 imágenes en galería');
    console.log('   • Configuración del hotel');
    console.log('');
    console.log('🔑 Usuario admin por defecto:');
    console.log('   Email: admin@hoteloasisresort.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  Por favor cambia la contraseña del admin después del primer acceso');
    
  } catch (error) {
    console.error('❌ Error poblando datos:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  populateSampleData();
}

module.exports = { populateSampleData };
