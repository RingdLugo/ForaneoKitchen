# README

## ForaneoKitchen 🍳

Aplicación web de recetas económicas pensada para estudiantes foráneos. Permite registrarse, iniciar sesión, publicar recetas con imágenes, planificar comidas semanales, generar listas de compra automáticas y consultar recetas compartidas por otros usuarios.

El sistema incluye autenticación con token, gestión de recetas con validaciones, filtros inteligentes, búsqueda en tiempo real, planificador semanal con presupuesto, lista de compras por categorías y un chatbot disponible para usuarios premium.

**Repositorio del proyecto:** https://github.com/RingdLugo/ForaneoKitchen.git

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript (Vanilla)
- Node.js
- Express
- API REST
- Supabase (Base de Datos & Auth)
- JWT (JSON Web Token) para sesiones
- bcryptjs para encriptación de contraseñas
- Nodemailer (Simulado para OTP en consola)

## Requisitos

Antes de ejecutar el proyecto debes tener instalado:

- Node.js (v14 o superior)
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

El servidor se ejecutará en:
`http://localhost:3000`

## Ejecutar el frontend

Una vez que el servidor esté corriendo, simplemente abre tu navegador y entra a:
`http://localhost:3000`

## Uso de la aplicación

### Crear una cuenta
Al abrir la aplicación aparecerá la pantalla principal. Debes presionar **Comenzar** para ir a la pantalla de inicio de sesión.
Si aún no tienes cuenta:
- Haz clic en **Regístrate**.
- Completa todos los campos: Nombre, Apellido, Email, Usuario, Contraseña.
- Si deseas tener acceso a las funciones premium (chatbot), marca la casilla "Premium".
- Presiona **Crear Usuario**.
- **Importante:** Revisa la consola donde corre el servidor para ver el código OTP de 6 dígitos.
- Ingresa el código para completar el registro.

### Iniciar sesión
- Escribe el usuario y contraseña que registraste.
- Presiona **Iniciar sesión**.

### Publicar una receta
1. En la navegación inferior, haz clic en **"Subir"**.
2. Completa los campos: Título, Costo, Tiempo, Ingredientes y Pasos.
3. (Opcional) Sube una imagen. Si eres Premium, puedes añadir links de video.
4. Presiona **Publicar receta**.

### Planificador semanal y Lista de compras
1. En **"Planificador"**, define tu presupuesto.
2. Agrega recetas a los diferentes días.
3. Ve a **"Lista de Compras"**; verás los ingredientes organizados por categorías automáticamente.
4. Puedes marcar lo que ya compraste y exportar la lista en PDF.

### Chatbot (Chef IA - Solo Premium)
- Haz clic en el botón flotante 🍳.
- Pregunta por recetas, ingredientes o pide consejos de planificación.
- El Chef IA te responderá y sugerirá recetas interactivas.

## Funcionalidades principales
- Autenticación segura con OTP y JWT.
- Sistema de puntos acumulables por actividad.
- Canje de puntos por beneficios Premium.
- Chatbot inteligente con procesamiento de lenguaje natural básico.
- Exportación de planes y listas en formato PDF.
- Modo oscuro integrado.
- Diseño 100% responsive para móviles y tablets.

## Estructura del proyecto

```
PROYECTO/
└── ForaneoKitchen/
    ├── public/                 # Frontend
    │   ├── css/                # Estilos (Vanilla CSS)
    │   ├── js/                 # Lógica (Vanilla JS)
    │   └── *.html              # Vistas
    ├── server.js               # Servidor Express & API
    ├── package.json            # Dependencias
    └── README.md               # Documentación
```

## Estado del proyecto
⚠️ **Versión Beta**: Actualmente en fase de optimización. Se corrigen detalles de interfaz y fluidez constantemente.

## Autor
Proyecto desarrollado con fines académicos para la comunidad de estudiantes foráneos.
