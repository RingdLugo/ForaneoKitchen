# ForananeoKitchen 🍳

Aplicación web de recetas económicas pensada para estudiantes foráneos.
Permite registrarse, iniciar sesión, publicar recetas y consultar recetas compartidas por otros usuarios.

El sistema incluye autenticación con token, gestión de recetas y un pequeño chatbot disponible para usuarios premium.

---

# Tecnologías utilizadas

* HTML5
* CSS3
* JavaScript
* Node.js
* Express
* API REST
* JWT (JSON Web Token) para autenticación

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
git clone https://github.com/mota1299/demo.git
```

2. Entrar a la carpeta del proyecto

```
cd demo
```

3. Instalar las dependencias del backend

```
npm install
```

Esto descargará todas las librerías necesarias para ejecutar el servidor.

---

# Ejecutar el proyecto

Para iniciar el servidor ejecuta:

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

1. Abrir el archivo:

```
index.html
```

También puedes abrirlo usando **Live Server** en Visual Studio Code para facilitar las pruebas.

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

* ver recetas disponibles
* publicar nuevas recetas
* navegar por las opciones de la aplicación

Si el usuario fue registrado como **premium**, también tendrá acceso al **chatbot de recetas**.

---

# Funcionalidades principales

* Registro de usuarios
* Inicio de sesión con autenticación JWT
* Publicación de recetas
* Visualización de recetas disponibles
* Diferenciación entre usuarios normales y premium
* Chatbot básico para búsqueda de recetas (solo premium)

---

# Estructura del proyecto

```
/project
│
├── index.html
├── login.html
├── home.html
│
├── css/
│   ├── style.css
│   ├── login.css
│   └── home.css
│
├── images/
│
├── server/
│   └── backend Node.js
│
└── README.md
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
