# ForaneoKitchen 🍳

Aplicación web de recetas económicas pensada para estudiantes foráneos.
Permite registrarse, iniciar sesión, publicar recetas con imágenes y consultar recetas compartidas por otros usuarios.

El sistema incluye autenticación con token, gestión de recetas con validaciones, filtros inteligentes, búsqueda en tiempo real y un chatbot disponible para usuarios premium.

Repositorio del proyecto:
https://github.com/RingdLugo/ForaneoKitchen.git

---

# Tecnologías utilizadas

* HTML5
* CSS3
* JavaScript
* Node.js
* Express
* API REST
* JWT (JSON Web Token) para autenticación
* bcryptjs para encriptación de contraseñas

---

# Requisitos

Antes de ejecutar el proyecto debes tener instalado:

* Node.js
* npm

Puedes verificarlo con:

```
node -v
npm -v
```

---

# Instalación del proyecto

1. Clonar el repositorio

```
git clone https://github.com/RingdLugo/ForaneoKitchen.git
```

2. Entrar a la carpeta del proyecto

```
cd ForaneoKitchen
```

3. Instalar las dependencias del backend

```
npm install
```

Esto descargará todas las librerías necesarias para ejecutar el servidor.

---

# Ejecutar el proyecto

Para iniciar el servidor ejecutar:

```
npm start
```

o en algunos casos:

```
node server.js
```

El servidor se ejecutará en:

```
http://localhost:3000
```

---

# Ejecutar el frontend

Una vez que el servidor esté corriendo:

1. Abrir el navegador y entrar a:

```
http://localhost:3000
```

También puedes abrir el archivo `index.html` usando **Live Server** en Visual Studio Code para facilitar las pruebas.

Desde ahí podrás acceder a la aplicación.

---

# Uso de la aplicación

### Crear una cuenta

Al abrir la aplicación aparecerá la pantalla principal.
Debes presionar **Comenzar** para ir a la pantalla de inicio de sesión.

Si aún no tienes cuenta:

1. Haz clic en **Regístrate**.
2. Escribe un **usuario** y **contraseña**.
3. Si deseas tener acceso a las funciones premium, marca la casilla **"Quiero ser Premium"**.
4. Si no deseas ser premium, simplemente deja esa casilla sin seleccionar.

Después presiona **Crear cuenta** para registrar el usuario.

---

### Iniciar sesión

Una vez creada la cuenta:

1. Regresa a la pantalla de **Iniciar sesión**.
2. Escribe el **usuario** y **contraseña** que registraste.
3. Presiona **Iniciar sesión**.

Después de iniciar sesión entrarás a la pantalla principal de la aplicación.

Ahí podrás:

* buscar recetas en tiempo real mientras escribes
* filtrar recetas por categorías (Económicas, Rápidas, Microondas, Menos de $30)
* ver todas las recetas disponibles en formato de tarjetas con imagen, precio y tiempo
* ver receta completa haciendo clic en "Ver receta completa"
* publicar nuevas recetas desde la opción "Subir" en la navegación inferior

Si el usuario fue registrado como **premium**, también tendrá acceso al **chatbot de recetas**.

---

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

---

### Ver detalle de receta

Al hacer clic en "Ver receta completa" en cualquier receta, se mostrará una página con:

* Imagen de la receta
* Título y autor
* Costo total y costo por porción
* Tiempo de preparación
* Lista completa de ingredientes
* Pasos de preparación numerados
* Etiquetas automáticas (económicas, rápidas, microondas, menos de $30)

---

### Chatbot (solo premium)

Si el usuario fue registrado como premium:

* Aparecerá un botón flotante 🍳 en la esquina inferior derecha
* Al hacer clic se abre un chat donde puedes preguntar por recetas
* El chatbot buscará en todas las recetas por título, ingredientes o pasos

---

# Funcionalidades principales

* Registro de usuarios
* Inicio de sesión con autenticación JWT
* Publicación de recetas con imagen
* Validaciones en todos los campos del formulario
* Búsqueda en tiempo real (título, ingredientes, pasos, autor)
* Filtros inteligentes (Económicas, Rápidas, Microondas, Menos de $30)
* Etiquetas automáticas según contenido de la receta
* Visualización de recetas disponibles
* Página de detalle de receta
* Diferenciación entre usuarios normales y premium
* Chatbot básico para búsqueda de recetas (solo premium)
* Navegación inferior (Inicio, Subir, Planificador, Comunidad, Perfil)
* Notificaciones visuales para feedback al usuario
* Diseño responsive

---

# Capturas de la aplicación

### Pantalla de inicio

Aquí se muestra la pantalla principal donde el usuario puede comenzar a usar la aplicación.

![Pantalla inicio](images/screenshot_inicio.png)

---

### Pantalla de inicio de sesión

El usuario puede iniciar sesión o registrarse creando una nueva cuenta.

![Login](images/screenshot_login.png)

---

### Pantalla principal

Después de iniciar sesión, el usuario puede ver recetas disponibles y buscar por filtros.

![Home](images/screenshot_home.png)

---

### Pantalla de subir receta

Formulario dedicado para publicar nuevas recetas con validaciones.

![Subir receta](images/screenshot_subir.png)

---

### Pantalla de detalle de receta

Vista completa de la receta con ingredientes y pasos de preparación.

![Detalle receta](images/screenshot_detalle.png)

---

# Ejemplos de uso de la API

La aplicación utiliza una **API REST** desarrollada con Node.js y Express.

### Registro de usuario

Endpoint:

```
POST /api/auth/registro
```

Ejemplo de cuerpo enviado:

```json
{
  "username": "usuario1",
  "password": "123456",
  "esPremium": true
}
```

Respuesta esperada:

```json
{
  "token": "jwt_token_generado",
  "user": {
    "username": "usuario1",
    "esPremium": true
  }
}
```

---

### Inicio de sesión

Endpoint:

```
POST /api/auth/login
```

Ejemplo de solicitud:

```json
{
  "username": "usuario1",
  "password": "123456"
}
```

Respuesta esperada:

```json
{
  "token": "jwt_token_generado",
  "user": {
    "username": "usuario1",
    "esPremium": true
  }
}
```

---

### Obtener todas las recetas

Endpoint:

```
GET /api/recetas
```

Este endpoint devuelve todas las recetas registradas en el sistema.

---

### Obtener una receta específica

Endpoint:

```
GET /api/recetas/:id
```

Ejemplo:

```
GET /api/recetas/1
```

---

### Crear una nueva receta

Endpoint:

```
POST /api/recetas
```

Headers requeridos:

```
Authorization: Bearer <token>
Content-Type: application/json
```

Ejemplo de cuerpo:

```json
{
  "titulo": "Arroz con Huevo",
  "ingredientes": "Arroz - 1 taza, Huevos - 2 unidades, Aceite - 1 cucharada",
  "pasos": "1. Cocer el arroz.\n2. Freír los huevos.\n3. Mezclar.",
  "precio": "$20 MXN",
  "tiempo": "10 min",
  "imagen": "data:image/jpeg;base64,..."
}
```

---

# Estructura del proyecto

```
ForaneoKitchen/
│
├── public/
│   ├── index.html              # Pantalla de bienvenida
│   ├── login.html              # Pantalla de login/registro
│   ├── home.html               # Pantalla principal (recetas)
│   ├── receta.html             # Pantalla de detalle de receta
│   ├── subir-receta.html       # Pantalla para publicar recetas
│   │
│   ├── css/
│   │   ├── style.css           # Estilos página de bienvenida
│   │   ├── login.css           # Estilos página de login
│   │   ├── home.css            # Estilos página principal
│   │   ├── receta.css          # Estilos página de detalle
│   │   └── subir-receta.css    # Estilos página de subir receta
│   │
│   ├── js/
│   │   ├── home.js             # Lógica página principal
│   │   ├── login.js            # Lógica página de login
│   │   ├── receta.js           # Lógica página de detalle
│   │   └── subir-receta.js     # Lógica página de subir receta
│   │
│   └── images/                 # Imágenes del proyecto
│
├── server.js                   # Servidor backend (Node.js/Express)
├── package.json                # Dependencias y scripts
├── package-lock.json           # Bloqueo de versiones
└── README.md                   # Documentación del proyecto
```

---

# Estado del proyecto

⚠️ **Versión Beta**

Este proyecto actualmente se encuentra en **fase beta**.

Esto significa que pueden existir algunos detalles como:

* errores de diseño en algunas partes de la interfaz
* problemas de fluidez en ciertas secciones del sitio
* pequeños errores de funcionamiento

Estos aspectos se irán **corrigiendo y mejorando progresivamente** conforme avance el desarrollo del proyecto.

---

# Autor

Proyecto desarrollado con fines académicos.
```