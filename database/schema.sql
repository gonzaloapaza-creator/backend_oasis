-- ========================================
-- Base de Datos: Hotel Oasis Resort
-- Sistema de Gestión Hotelera
-- ========================================

-- Crear base de datos
-- CREATE DATABASE hotel_oasis_resort;
-- \c hotel_oasis_resort;

-- ========================================
-- Extensiones necesarias
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- Tablas principales
-- ========================================

-- 1. Tabla de Usuarios y Personal
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('admin', 'recepcionista', 'personal', 'cliente')),
    estado BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Tipos de Habitación
CREATE TABLE IF NOT EXISTS tipos_habitacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    capacidad_maxima INTEGER NOT NULL,
    precio_base DECIMAL(10,2) NOT NULL,
    amenities TEXT[], -- Array de amenities
    imagen_url VARCHAR(255),
    estado BOOLEAN DEFAULT true
);

-- 3. Tabla de Habitaciones
CREATE TABLE IF NOT EXISTS habitaciones (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(10) UNIQUE NOT NULL,
    piso INTEGER NOT NULL,
    tipo_habitacion_id INTEGER REFERENCES tipos_habitacion(id),
    estado VARCHAR(20) DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupada', 'mantenimiento', 'limpieza')),
    ultima_limpieza TIMESTAMP,
    notas TEXT
);

-- 4. Tabla de Servicios
CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2),
    requiere_reserva BOOLEAN DEFAULT false,
    categoria VARCHAR(50),
    imagen_url VARCHAR(255),
    estado BOOLEAN DEFAULT true
);

-- 5. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    documento_identidad VARCHAR(20) UNIQUE,
    nacionalidad VARCHAR(50),
    fecha_nacimiento DATE,
    direccion TEXT,
    preferencias TEXT[],
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla de Reservas
CREATE TABLE IF NOT EXISTS reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id),
    codigo_reserva VARCHAR(10) UNIQUE NOT NULL,
    fecha_check_in DATE NOT NULL,
    fecha_check_out DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'confirmada' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
    cantidad_huespedes INTEGER DEFAULT 1,
    monto_total DECIMAL(10,2),
    monto_pagado DECIMAL(10,2) DEFAULT 0,
    notas TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla de Detalles de Reserva (Habitaciones reservadas)
CREATE TABLE IF NOT EXISTS reserva_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id UUID REFERENCES reservas(id) ON DELETE CASCADE,
    habitacion_id INTEGER REFERENCES habitaciones(id),
    precio_noche DECIMAL(10,2),
    cantidad_noches INTEGER,
    subtotal DECIMAL(10,2),
    UNIQUE(reserva_id, habitacion_id)
);

-- 8. Tabla de Reservas de Servicios
CREATE TABLE IF NOT EXISTS reserva_servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id UUID REFERENCES reservas(id) ON DELETE CASCADE,
    servicio_id INTEGER REFERENCES servicios(id),
    nombre VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    fecha_servicio TIMESTAMP NOT NULL,
    cantidad INTEGER DEFAULT 1,
    precio_unitario DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'completado'))
);

-- 9. Tabla de Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id UUID REFERENCES reservas(id),
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'paypal')),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'fallido', 'reembolsado')),
    referencia_pago VARCHAR(100),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabla de Eventos
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    capacidad_maxima INTEGER,
    precio_entrada DECIMAL(10,2),
    ubicacion VARCHAR(100),
    imagen_url VARCHAR(255),
    estado BOOLEAN DEFAULT true
);

-- 11. Tabla de Registro de Eventos
CREATE TABLE IF NOT EXISTS registro_eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id INTEGER REFERENCES eventos(id),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    cantidad_entradas INTEGER DEFAULT 1,
    monto_total DECIMAL(10,2),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'confirmado' CHECK (estado IN ('pendiente', 'confirmado', 'cancelado'))
);

-- 12. Tabla de Galería
CREATE TABLE IF NOT EXISTS galeria (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(100),
    descripcion TEXT,
    url_imagen VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) CHECK (categoria IN ('habitaciones', 'servicios', 'eventos', 'instalaciones', 'general')),
    orden INTEGER DEFAULT 0,
    estado BOOLEAN DEFAULT true
);

-- 13. Tabla de Contacto y Mensajes
CREATE TABLE IF NOT EXISTS mensajes_contacto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    estado VARCHAR(20) DEFAULT 'no_leido' CHECK (estado IN ('no_leido', 'leido', 'respondido')),
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMP
);

-- 14. Tabla de Configuración del Hotel
CREATE TABLE IF NOT EXISTS configuracion_hotel (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Tabla de Logs del Sistema
CREATE TABLE IF NOT EXISTS logs_sistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id VARCHAR(100),
    detalles JSONB,
    ip_address INET,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Índices para optimización
-- ========================================

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento_identidad);
CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON reservas(codigo_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fechas ON reservas(fecha_check_in, fecha_check_out);
CREATE INDEX IF NOT EXISTS idx_habitaciones_estado ON habitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_habitaciones_tipo ON habitaciones(tipo_habitacion_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON servicios(categoria);
CREATE INDEX IF NOT EXISTS idx_mensajes_estado ON mensajes_contacto(estado);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_sistema(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id);

-- Índices para búsquedas de texto
CREATE INDEX IF NOT EXISTS idx_galeria_titulo ON galeria USING gin(to_tsvector('spanish', titulo));
CREATE INDEX IF NOT EXISTS idx_galeria_descripcion ON galeria USING gin(to_tsvector('spanish', descripcion));

-- ========================================
-- Triggers para actualización automática
-- ========================================

-- Trigger para actualizar fecha_actualización
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas que lo necesiten
DROP TRIGGER IF EXISTS trigger_usuarios_actualizacion ON usuarios;
CREATE TRIGGER trigger_usuarios_actualizacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_reservas_actualizacion ON reservas;
CREATE TRIGGER trigger_reservas_actualizacion
    BEFORE UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_configuracion_actualizacion ON configuracion_hotel;
CREATE TRIGGER trigger_configuracion_actualizacion
    BEFORE UPDATE ON configuracion_hotel
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

-- ========================================
-- Vistas útiles
-- ========================================

-- Vista de reservas activas
CREATE OR REPLACE VIEW vista_reservas_activas AS
SELECT 
    r.id,
    r.codigo_reserva,
    c.nombre || ' ' || c.apellido AS cliente,
    r.fecha_check_in,
    r.fecha_check_out,
    r.estado,
    r.cantidad_huespedes,
    r.monto_total,
    r.monto_pagado
FROM reservas r
JOIN clientes c ON r.cliente_id = c.id
WHERE r.estado IN ('confirmada', 'completada');

-- Vista de ocupación de habitaciones
CREATE OR REPLACE VIEW vista_ocupacion_habitaciones AS
SELECT 
    h.numero,
    h.piso,
    th.nombre AS tipo_habitacion,
    h.estado,
    COUNT(rd.id) AS veces_ocupada
FROM habitaciones h
LEFT JOIN tipos_habitacion th ON h.tipo_habitacion_id = th.id
LEFT JOIN reserva_detalles rd ON h.id = rd.habitacion_id
GROUP BY h.id, h.numero, h.piso, th.nombre, h.estado;

-- Vista de ingresos mensuales
CREATE OR REPLACE VIEW vista_ingresos_mensuales AS
SELECT 
    DATE_TRUNC('month', p.fecha_pago) AS mes,
    SUM(p.monto) AS total_ingresos,
    COUNT(p.id) AS cantidad_pagos
FROM pagos p
WHERE p.estado = 'completado'
GROUP BY DATE_TRUNC('month', p.fecha_pago)
ORDER BY mes DESC;

-- ========================================
-- Funciones útiles
-- ========================================

-- Función para generar código de reserva único
CREATE OR REPLACE FUNCTION generar_codigo_reserva()
RETURNS TEXT AS $$
DECLARE
    codigo TEXT;
    existe BOOLEAN;
BEGIN
    LOOP
        codigo := 'HOR' || UPPER(SUBSTRING(MD5(NOW()::TEXT), 1, 6));
        SELECT EXISTS(SELECT 1 FROM reservas WHERE codigo_reserva = codigo) INTO existe;
        IF NOT existe THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN codigo;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar disponibilidad de habitación
CREATE OR REPLACE FUNCTION verificar_disponibilidad(
    p_habitacion_id INTEGER,
    p_fecha_check_in DATE,
    p_fecha_check_out DATE
)
RETURNS BOOLEAN AS $$
DECLARE
    conflicto INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflicto
    FROM reserva_detalles rd
    JOIN reservas r ON rd.reserva_id = r.id
    WHERE rd.habitacion_id = p_habitacion_id
    AND r.estado IN ('confirmada', 'completada')
    AND (
        (r.fecha_check_in <= p_fecha_check_in AND r.fecha_check_out > p_fecha_check_in) OR
        (r.fecha_check_in < p_fecha_check_out AND r.fecha_check_out >= p_fecha_check_out) OR
        (r.fecha_check_in >= p_fecha_check_in AND r.fecha_check_out <= p_fecha_check_out)
    );
    
    RETURN conflicto = 0;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Restricciones adicionales
-- ========================================

-- Constraint para evitar fechas inválidas en reservas
ALTER TABLE reservas ADD CONSTRAINT IF NOT EXISTS chk_fechas_reserva 
CHECK (fecha_check_out > fecha_check_in);

-- Constraint para validar monto total
ALTER TABLE reservas ADD CONSTRAINT IF NOT EXISTS chk_monto_total 
CHECK (monto_total >= 0);

-- Constraint para validar monto pagado
ALTER TABLE reservas ADD CONSTRAINT IF NOT EXISTS chk_monto_pagado 
CHECK (monto_pagado >= 0 AND monto_pagado <= monto_total);

-- ========================================
-- Comentarios descriptivos
-- ========================================

COMMENT ON DATABASE hotel_oasis_resort IS 'Base de datos para Hotel Oasis Resort';

COMMENT ON TABLE usuarios IS 'Tabla de usuarios y personal del hotel';
COMMENT ON TABLE clientes IS 'Información de los clientes del hotel';
COMMENT ON TABLE reservas IS 'Reservas de habitaciones y servicios';
COMMENT ON TABLE habitaciones IS 'Inventario de habitaciones del hotel';
COMMENT ON TABLE servicios IS 'Catálogo de servicios disponibles';
COMMENT ON TABLE pagos IS 'Registro de pagos de reservas';

-- ========================================
-- Fin de la estructura
-- ========================================
