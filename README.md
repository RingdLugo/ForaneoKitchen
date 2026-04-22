# README

## ForananeoKitchen 🍳

Aplicación web de recetas económicas pensada para estudiantes foráneos. Permite registrarse, iniciar sesión, publicar recetas con imágenes, planificar comidas semanales, generar listas de compra automáticas y consultar recetas compartidas por otros usuarios.

El sistema incluye autenticación con token, gestión de recetas con validaciones, filtros inteligentes, búsqueda en tiempo real, planificador semanal con presupuesto, lista de compras por categorías y un chatbot disponible para usuarios premium.

**Repositorio del proyecto:** https://github.com/RingdLugo/ForaneoKitchen.git

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- API REST
- Supabase (Base de datos)
- JWT (JSON Web Token) para autenticación
- bcryptjs para encriptación de contraseñas
- Nodemailer para envío de correos (OTP)

## Requisitos

Antes de ejecutar el proyecto debes tener instalado:

- Node.js
- npm

Puedes verificarlo con:

```bash
node -v
npm -v
```

## Instalación del proyecto

1. **Clonar el repositorio**

```bash
git clone https://github.com/RingdLugo/ForaneoKitchen.git
```

2. **Entrar a la carpeta del proyecto**

```bash
cd ForaneoKitchen
```

3. **Instalar las dependencias del backend**

```bash
npm install
```

Esto descargará todas las librerías necesarias para ejecutar el servidor.

## Ejecutar el proyecto

Para iniciar el servidor ejecutar:

```bash
npm start
```

o en algunos casos:

```bash
node server.js
```

El servidor se ejecutará en:

```
http://localhost:3000
```

## Ejecutar el frontend

Una vez que el servidor esté corriendo:

1. Abrir el navegador y entrar a:

```
http://localhost:3000
```

También puedes abrir el archivo `index.html` usando Live Server en Visual Studio Code para facilitar las pruebas.

Desde ahí podrás acceder a la aplicación.

## Uso de la aplicación

### Crear una cuenta

Al abrir la aplicación aparecerá la pantalla principal. Debes presionar **Comenzar** para ir a la pantalla de inicio de sesión.

Si aún no tienes cuenta:

- Haz clic en **Regístrate**.
- Completa todos los campos: Nombre, Apellido, Email, Usuario, Contraseña.
- Si deseas tener acceso a las funciones premium (chatbot), marca la casilla "Premium".
- Si no deseas ser premium, simplemente deja esa casilla sin seleccionar.
- Presiona **Crear Usuario**.
- Revisa tu correo electrónico para obtener el código de verificación.
- Ingresa el código de 6 dígitos para completar el registro.

### Iniciar sesión

Una vez creada la cuenta:

- Regresa a la pantalla de **Iniciar sesión**.
- Escribe el usuario y contraseña que registraste.
- Presiona **Iniciar sesión**.

Después de iniciar sesión entrarás a la pantalla principal de la aplicación.

Ahí podrás:

- Buscar recetas en tiempo real mientras escribes
- Filtrar recetas por categorías (Económicas, Rápidas, Microondas, Menos de $30)
- Ver todas las recetas disponibles en formato de tarjetas con imagen, precio y tiempo
- Ver receta completa haciendo clic en "Ver receta completa"

Si el usuario fue registrado como premium, también tendrá acceso al chatbot de recetas.

### Publicar una receta

1. En la navegación inferior, haz clic en **"Subir"**.
2. Completa todos los campos del formulario:
   - **Título** (solo letras, números y espacios, mínimo 3 caracteres)
   - **Costo** (solo números, se formatea automáticamente a $XX MXN)
   - **Tiempo** (solo números, se formatea automáticamente a XX min)
   - **Ingredientes** (separados por comas, mínimo 1, máximo 20)
   - **Pasos** (puedes usar números 1., 2. o saltos de línea, mínimo 1 paso)
   - **Imagen** (opcional, JPG, PNG o WEBP, máximo 5MB)
3. Presiona **Publicar receta**.

### Ver detalle de receta

Al hacer clic en "Ver receta completa" en cualquier receta, se mostrará una página con:

- Imagen de la receta
- Título y autor
- Costo total y costo por porción
- Tiempo de preparación
- Lista completa de ingredientes
- Pasos de preparación numerados
- Etiquetas automáticas (económicas, rápidas, microondas, menos de $30)

### Planificador semanal

1. En la navegación inferior, haz clic en **"Planificador"**.
2. Define tu **presupuesto semanal**.
3. Para cada día y comida (desayuno, comida, cena), haz clic en **"+ Agregar receta"**.
4. Selecciona una receta de la lista modal.
5. El sistema calculará automáticamente el gasto total y lo que resta de presupuesto.
6. Presiona **"Lista de Compras"** para generar automáticamente la lista con todos los ingredientes.

### Lista de compras

- Se genera automáticamente a partir de las recetas seleccionadas en el planificador.
- Los ingredientes se organizan por categorías: Abarrotes, Lácteos, Verduras, Frutas, Carnes y Otros.
- Puedes marcar cada ingrediente como completado mientras haces tus compras.
- La barra de progreso muestra el avance.
- Puedes **exportar** la lista como archivo de texto o **compartirla**.

### Chatbot (solo premium)

Si el usuario fue registrado como premium:

- Aparecerá un botón flotante 🍳 en la esquina inferior derecha.
- Al hacer clic se abre un chat donde puedes preguntar por recetas.
- El chatbot buscará en todas las recetas por título, ingredientes o pasos.
- Los resultados aparecerán como botones que te llevan directamente a la receta.

## Funcionalidades principales

- Registro de usuarios con verificación por correo OTP
- Inicio de sesión con autenticación JWT
- Recuperación de contraseña con código OTP
- Publicación de recetas con imagen (base64)
- Validaciones en todos los campos del formulario
- Búsqueda en tiempo real (título, ingredientes, pasos, autor)
- Filtros inteligentes (Económicas, Rápidas, Microondas, Menos de $30)
- Etiquetas automáticas según contenido de la receta
- Visualización de recetas disponibles
- Página de detalle de receta con costo por porción
- Diferenciación entre usuarios normales y premium
- Planificador semanal con presupuesto dinámico
- Lista de compras automática por categorías
- Barra de progreso en lista de compras
- Exportar y compartir lista de compras
- Chatbot básico para búsqueda de recetas (solo premium)
- Navegación inferior (Inicio, Subir, Planificador, Comunidad, Perfil)
- Notificaciones visuales para feedback al usuario
- Diseño responsive (mobile y desktop)

## Ejemplos de uso de la API

La aplicación utiliza una API REST desarrollada con Node.js y Express y Supabase como base de datos.

### Registro de usuario

**Endpoint:**

```
POST /api/auth/registro
```

**Ejemplo de cuerpo enviado:**

```json
{
  "nombre": "Juan",
  "apellido": "Perez",
  "email": "juan@example.com",
  "username": "juanito",
  "password": "12345678",
  "confirmPassword": "12345678",
  "esPremium": true
}
```

**Respuesta esperada:**

```json
{
  "message": "Codigo enviado",
  "email": "juan@example.com"
}
```

### Verificar código OTP

**Endpoint:**

```
POST /api/auth/verify-otp
```

**Ejemplo de cuerpo:**

```json
{
  "email": "juan@example.com",
  "otp": "123456"
}
```

**Respuesta esperada:**

```json
{
  "token": "token_base64_generado",
  "user": {
    "id": 1,
    "username": "juanito",
    "email": "juan@example.com",
    "esPremium": true
  }
}
```

### Inicio de sesión

**Endpoint:**

```
POST /api/auth/login
```

**Ejemplo de solicitud:**

```json
{
  "username": "juanito",
  "password": "12345678"
}
```

**Respuesta esperada:**

```json
{
  "token": "token_base64_generado",
  "user": {
    "id": 1,
    "username": "juanito",
    "email": "juan@example.com",
    "esPremium": true
  }
}
```

### Obtener todas las recetas

**Endpoint:**

```
GET /api/recipes
```

**Respuesta esperada:**

```json
[
  {
    "id": 1,
    "titulo": "Arroz con Huevo",
    "ingredientes": "Arroz - 1 taza, Huevos - 2 unidades",
    "pasos": "1. Cocer el arroz.\n2. Freír los huevos.",
    "precio": "$20 MXN",
    "precio_numerico": 20,
    "tiempo": "10 min",
    "tiempo_numerico": 10,
    "imagen": "data:image/jpeg;base64,...",
    "autor": "juanito",
    "etiquetas": ["economica", "rapida"]
  }
]
```

### Obtener una receta específica

**Endpoint:**

```
GET /api/recipes/:id
```

**Ejemplo:**

```
GET /api/recipes/1
```

### Crear una nueva receta

**Endpoint:**

```
POST /api/recipes
```

**Headers requeridos:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Ejemplo de cuerpo:**

```json
{
  "titulo": "Arroz con Huevo",
  "ingredientes": "Arroz - 1 taza, Huevos - 2 unidades, Aceite - 1 cucharada",
  "pasos": "1. Cocer el arroz.\n2. Freír los huevos.\n3. Mezclar.",
  "precio": "$20 MXN",
  "precioNumerico": 20,
  "tiempo": "10 min",
  "tiempoNumerico": 10,
  "imagen": "data:image/jpeg;base64,..."
}
```

### Recuperar contraseña (solicitar código)

**Endpoint:**

```
POST /api/auth/forgot-password
```

**Ejemplo de cuerpo:**

```json
{
  "email": "juan@example.com"
}
```

### Restablecer contraseña

**Endpoint:**

```
POST /api/auth/reset-password
```

**Ejemplo de cuerpo:**

```json
{
  "email": "juan@example.com",
  "newPassword": "nueva1234",
  "confirmNewPassword": "nueva1234"
}
```

## Estructura del proyecto

```
PROYECTO/
└── ForaneoKitchen/
    ├── node_modules/           # Dependencias del proyecto
    ├── public/                 # Archivos del frontend
    │   ├── css/                # Estilos CSS
    │   ├── images/             # Imágenes del proyecto
    │   ├── js/                 # Lógica JavaScript
    │   ├── home.html           # Pantalla principal
    │   ├── index.html          # Pantalla de bienvenida
    │   ├── lista-compras.html  # Pantalla lista de compras
    │   ├── login.html          # Pantalla de login/registro
    │   ├── planificador.html   # Pantalla planificador semanal
    │   ├── receta.html         # Pantalla de detalle de receta
    │   └── subir-receta.html   # Pantalla para publicar recetas
    ├── .gitignore              # Archivos ignorados por git
    ├── package-lock.json       # Bloqueo de versiones
    ├── package.json            # Dependencias y scripts
    ├── README.md               # Documentación del proyecto
    └── server.js               # Servidor backend (Node.js/Express)
```

## Estado del proyecto

⚠️ **Versión Beta**

Este proyecto actualmente se encuentra en fase beta.

Esto significa que pueden existir algunos detalles como:

- Errores de diseño en algunas partes de la interfaz
- Problemas de fluidez en ciertas secciones del sitio
- Pequeños errores de funcionamiento

Estos aspectos se irán corrigiendo y mejorando progresivamente conforme avance el desarrollo del proyecto.

## Autor

Proyecto desarrollado con fines académicos.
```