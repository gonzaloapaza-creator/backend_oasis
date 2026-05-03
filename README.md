# Hotel Oasis Resort - Backend API

Backend completo para el sistema de gestión del Hotel Oasis Resort construido con Node.js, Express y PostgreSQL.

## 🚀 Características

- **Node.js + Express**: Servidor RESTful API
- **PostgreSQL**: Base de datos relacional robusta
- **JWT**: Autenticación y autorización segura
- **Validación**: Validación de datos con express-validator
- **File Upload**: Gestión de archivos con multer
- **Email**: Notificaciones por correo electrónico
- **Rate Limiting**: Protección contra sobrecarga
- **Logging**: Registro completo de actividades
- **Error Handling**: Manejo centralizado de errores

## 📋 Requisitos Previos

- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- npm >= 8.0.0

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd dsrd-app/backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Editar el archivo `.env` con tus credenciales:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hotel_oasis_resort
   DB_USER=postgres
   DB_PASSWORD=K@iros
   ```

4. **Crear base de datos**
   ```sql
   CREATE DATABASE hotel_oasis_resort;
   ```

5. **Ejecutar migraciones**
   ```bash
   npm run migrate
   ```

6. **Poblar datos iniciales**
   ```bash
   npm run seed
   ```

7. **Iniciar servidor**
   ```bash
   npm run dev
   ```

## 🗄️ Base de Datos

### Configuración PostgreSQL
- **Host**: localhost
- **Puerto**: 5432
- **Base de datos**: hotel_oasis_resort
- **Usuario**: postgres
- **Contraseña**: K@iros

### Estructura de Tablas
- `usuarios`: Usuarios y personal del hotel
- `clientes`: Información de clientes
- `tipos_habitacion`: Tipos de habitaciones disponibles
- `habitaciones`: Inventario de habitaciones
- `reservas`: Reservas de habitaciones
- `reserva_detalles`: Detalles de reservas
- `servicios`: Catálogo de servicios
- `reserva_servicios`: Reservas de servicios
- `eventos`: Eventos del hotel
- `registro_eventos`: Registros a eventos
- `galeria`: Imágenes del hotel
- `mensajes_contacto`: Formulario de contacto
- `configuracion_hotel`: Configuración del sistema
- `logs_sistema`: Logs de auditoría

## 📡 Endpoints API

### Autenticación (`/api/auth`)
- `POST /register` - Registrar usuario
- `POST /login` - Iniciar sesión
- `GET /profile` - Obtener perfil
- `PUT /profile` - Actualizar perfil
- `GET /users` - Listar usuarios (admin)
- `PATCH /users/:id/status` - Cambiar estado (admin)

### Habitaciones (`/api/rooms`)
- `GET /` - Listar tipos de habitaciones
- `GET /:id` - Obtener tipo de habitación
- `POST /check-availability` - Verificar disponibilidad
- `POST /` - Crear tipo de habitación (admin)
- `PUT /:id` - Actualizar tipo (admin)
- `DELETE /:id` - Eliminar tipo (admin)

### Servicios (`/api/services`)
- `GET /` - Listar servicios
- `GET /:id` - Obtener servicio
- `GET /categories/list` - Listar categorías
- `POST /` - Crear servicio (admin)
- `PUT /:id` - Actualizar servicio (admin)
- `DELETE /:id` - Eliminar servicio (admin)
- `POST /:id/reserve` - Reservar servicio

### Reservas (`/api/reservations`)
- `GET /` - Listar reservas
- `GET /:id` - Obtener reserva
- `POST /` - Crear reserva
- `PATCH /:id/status` - Actualizar estado
- `DELETE /:id` - Cancelar reserva

### Eventos (`/api/events`)
- `GET /` - Listar eventos
- `GET /:id` - Obtener evento
- `GET /upcoming/list` - Próximos eventos
- `POST /` - Crear evento (admin)
- `PUT /:id` - Actualizar evento (admin)
- `DELETE /:id` - Eliminar evento (admin)
- `POST /:id/register` - Registrarse a evento
- `GET /:id/registrations` - Ver registros (admin)

### Galería (`/api/gallery`)
- `GET /` - Listar imágenes
- `GET /:id` - Obtener imagen
- `GET /categories/list` - Listar categorías
- `POST /` - Subir imagen (admin)
- `PUT /:id` - Actualizar imagen (admin)
- `DELETE /:id` - Eliminar imagen (admin)

### Contacto (`/api/contact`)
- `GET /` - Listar mensajes (admin)
- `GET /:id` - Obtener mensaje (admin)
- `POST /` - Enviar mensaje
- `PATCH /:id/status` - Actualizar estado (admin)
- `DELETE /:id` - Eliminar mensaje (admin)
- `GET /stats/summary` - Estadísticas (admin)

### Usuarios (`/api/users`)
- `GET /` - Listar usuarios (admin)
- `GET /:id` - Obtener usuario (admin)
- `POST /` - Crear usuario (admin)
- `PUT /:id` - Actualizar usuario (admin)
- `PATCH /:id/status` - Cambiar estado (admin)
- `DELETE /:id` - Eliminar usuario (admin)
- `GET /stats/summary` - Estadísticas (admin)

## 🔐 Autenticación

### JWT Tokens
- **Header**: `Authorization: Bearer <token>`
- **Duración**: 24 horas
- **Roles**: admin, recepcionista, personal, cliente

### Usuario Admin por Defecto
- **Email**: admin@hoteloasisresort.com
- **Contraseña**: admin123

## 📁 Estructura de Archivos

```
backend/
├── config/
│   └── database.js          # Configuración de base de datos
├── database/
│   └── schema.sql           # Esquema completo de la BD
├── routes/
│   ├── auth.js             # Rutas de autenticación
│   ├── rooms.js            # Rutas de habitaciones
│   ├── services.js         # Rutas de servicios
│   ├── reservations.js     # Rutas de reservas
│   ├── events.js           # Rutas de eventos
│   ├── gallery.js          # Rutas de galería
│   ├── contact.js          # Rutas de contacto
│   └── users.js            # Rutas de usuarios
├── scripts/
│   ├── migrate.js          # Script de migraciones
│   └── seed.js             # Script de datos iniciales
├── uploads/
│   └── gallery/           # Archivos subidos
├── .env.example            # Variables de entorno ejemplo
├── package.json            # Dependencias y scripts
├── server.js              # Servidor principal
└── README.md              # Este archivo
```

## 🧪 Scripts Disponibles

```bash
npm start           # Iniciar servidor en producción
npm run dev         # Iniciar servidor en desarrollo
npm run migrate     # Ejecutar migraciones
npm run seed        # Poblar datos iniciales
npm test            # Ejecutar pruebas
```

## 🔧 Variables de Entorno

### Base de Datos
- `DB_HOST`: Host de PostgreSQL
- `DB_PORT`: Puerto de PostgreSQL
- `DB_NAME`: Nombre de la base de datos
- `DB_USER`: Usuario de PostgreSQL
- `DB_PASSWORD`: Contraseña de PostgreSQL

### Servidor
- `PORT`: Puerto del servidor (default: 3001)
- `NODE_ENV`: Entorno (development/production)

### JWT
- `JWT_SECRET`: Secreto para tokens JWT
- `JWT_EXPIRES_IN`: Tiempo de expiración (default: 24h)

### Email
- `EMAIL_HOST`: Servidor SMTP
- `EMAIL_PORT`: Puerto SMTP
- `EMAIL_USER`: Usuario de email
- `EMAIL_PASS`: Contraseña de email
- `EMAIL_FROM`: Email remitente

### Archivos
- `UPLOAD_PATH`: Directorio de uploads
- `MAX_FILE_SIZE`: Tamaño máximo de archivo

## 🛡️ Seguridad

- **CORS**: Configurado para desarrollo y producción
- **Helmet**: Headers de seguridad
- **Rate Limiting**: Límite de solicitudes por IP
- **Input Validation**: Validación de todos los datos
- **SQL Injection Protection**: Usando parameterized queries
- **Password Hashing**: bcrypt con salt rounds
- **JWT**: Tokens seguros con expiración

## 📊 Monitoreo y Logs

- **Morgan**: Logging de solicitudes HTTP
- **Console Logs**: Logs detallados de errores
- **Database Logs**: Tabla `logs_sistema` para auditoría
- **Error Handling**: Manejo centralizado con códigos de estado

## 🚀 Despliegue

### Producción
1. Configurar variables de entorno
2. Ejecutar `npm run build` (si aplica)
3. Iniciar con `npm start`
4. Configurar proxy inverso (nginx/apache)
5. Configurar SSL/TLS

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contribución

1. Fork del proyecto
2. Crear feature branch
3. Realizar cambios
4. Ejecutar pruebas
5. Crear Pull Request

## 📝 Licencia

MIT License - Ver archivo LICENSE

## 🆘 Soporte

- **Email**: soporte@hoteloasisresort.com
- **Documentación**: docs.hoteloasisresort.com
- **Issues**: github.com/hotel-oasis-resort/issues

---

## 🎯 Notas Importantes

1. **Cambiar contraseña admin**: Modificar después del primer acceso
2. **Backups**: Realizar backups regulares de la base de datos
3. **Logs**: Monitorear logs del sistema regularmente
4. **Actualizaciones**: Mantener dependencias actualizadas
5. **SSL**: Usar HTTPS en producción
6. **Firewall**: Configurar reglas de firewall adecuadas
