# Foráneo Kitchen 🍳
### *La guía definitiva para sobrevivir a la cocina siendo foráneo.*

**Foráneo Kitchen** es una plataforma web integral diseñada para estudiantes y personas que viven solas ("foráneos"), enfocada en la optimización del presupuesto, la salud y la comunidad. Permite registrarse, iniciar sesión, publicar recetas con imágenes y videos, planificar comidas semanales, generar listas de compra automáticas y consultar recetas compartidas por otros usuarios.

El sistema incluye autenticación con token JWT, gestión de recetas con validaciones, filtros inteligentes, búsqueda en tiempo real, planificador semanal con presupuesto, lista de compras por categorías y un asistente inteligente (Chef IA) disponible para usuarios premium.

**Repositorio del proyecto:** [https://github.com/RingdLugo/ForaneoKitchen.git](https://github.com/RingdLugo/ForaneoKitchen.git)

---

## 🛠️ Tecnologías Utilizadas

*   **HTML5**
*   **CSS3**
*   **JavaScript**
*   **Node.js**
*   **Express**
*   **API REST**
*   **Supabase** (Base de datos PostgreSQL)
*   **JWT** (JSON Web Token) para autenticación
*   **bcryptjs** para encriptación de contraseñas
*   **Nodemailer** para envío de correos (OTP)

---

## 🔧 Requisitos e Instalación

### Requisitos
Antes de ejecutar el proyecto debes tener instalado:
*   **Node.js**
*   **npm**

Puedes verificarlo con:
```bash
node -v
npm -v
```

### Instalación del proyecto
1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/RingdLugo/ForaneoKitchen.git
    ```
2.  **Entrar a la carpeta del proyecto:**
    ```bash
    cd ForaneoKitchen/2.0
    ```
3.  **Instalar las dependencias:**
    ```bash
    npm install
    ```

---

## 🚀 Ejecución del Proyecto

Para iniciar el servidor, ejecuta:
```bash
npm start
```
El servidor se ejecutará en: `http://localhost:3000`

### Ejecutar el frontend
Una vez que el servidor esté corriendo, abre tu navegador y entra a:
`http://localhost:3000`

---

## 💎 Sistema de Membresías (Free vs Premium)

El proyecto cuenta con una diferenciación clara de funcionalidades según el rol del usuario, diseñada para incentivar la participación y la suscripción:

### 👤 Usuario Free (Gratis)
Es el nivel básico para todo nuevo usuario registrado. Permite:
*   **Explorar Recetas:** Ver ingredientes, pasos y costos de todas las recetas públicas.
*   **Planificador Semanal:** Acceso total para organizar comidas y presupuestos.
*   **Lista de Compras:** Generación automática de listas de súper.
*   **Publicar Recetas:** Puede subir platillos con imágenes (sin soporte de video).
*   **Gamificación:** Gana puntos por likes y visitas.

### 🌟 Usuario Premium (Pago o Recompensa)
Desbloquea el potencial total de la plataforma:
*   **Contenido Multimedia:** Visualización de videos tutoriales (YouTube y archivos MP4).
*   **Comunidad Activa:** Único rol con permiso para **leer y escribir comentarios** en las recetas.
*   **Chatbot Chef IA:** Acceso al asistente inteligente para consultas de cocina personalizadas.
*   **Historial de Navegación:** Acceso a la lista detallada de recetas visitadas recientemente.
*   **Publicación Avanzada:** Capacidad de incluir videos al subir o editar sus propias recetas.
*   **Beneficio Visual:** Eliminación de los anuncios o mensajes de bloqueo en la interfaz.

> **Nota:** Los usuarios Free pueden obtener accesos Premium temporales (1-5 días) canjeando sus puntos acumulados en la sección de perfil.

---

## 📖 Uso de la Aplicación

### Crear una cuenta
1.  Al abrir la aplicación presiona **Comenzar** para ir a la pantalla de inicio de sesión.
2.  Haz clic en **Regístrate**.
3.  Completa los campos: Nombre, Apellido, Email, Usuario, Contraseña.
4.  Si deseas funciones premium desde el inicio, marca la casilla **"Premium"**.
5.  Recibirás un código OTP de 6 dígitos en tu correo. Ingrésalo para completar el registro.

### Iniciar sesión
1.  Ingresa el usuario y contraseña registrados.
2.  Si tu membresía Premium ha expirado, el sistema te lo notificará y te cambiará automáticamente al rol Free, bloqueando las funciones exclusivas con un mensaje explicativo.

### Publicar una receta
1.  En la navegación inferior, haz clic en **"Subir"**.
2.  Completa el formulario: Título, Costo, Tiempo, Porciones, Ingredientes y Pasos.
3.  Si eres Premium, verás la opción para añadir un **Link de YouTube** o **Subir un archivo de Video**.

### Planificador y Lista de Compras
1.  Define tu presupuesto semanal.
2.  Agrega recetas a los días de la semana. El sistema te avisará si te pasas de tu presupuesto.
3.  Genera la lista de compras. Si agregas la misma receta dos veces, el sistema **suma automáticamente los ingredientes** (ej. si dos recetas usan 2 huevos, la lista dirá "4 huevos").

---

## ✨ Funcionalidades Principales

*   Registro de usuarios con verificación por correo **OTP**.
*   Inicio de sesión con autenticación **JWT**.
*   Recuperación de contraseña con código **OTP**.
*   Publicación de recetas con imagen y video (solo Premium).
*   Validaciones de calidad (bloqueo de spam, gibberish y lenguaje ofensivo).
*   Búsqueda en tiempo real por título, ingredientes o autor.
*   Filtros inteligentes (Económicas, Rápidas, Microondas, Menos de $30).
*   Página de detalle con **Porciones Reales** y costo dinámico.
*   Diferenciación de roles: Usuarios Free vs Usuarios Premium.
*   **Planificador semanal** con control de presupuesto dinámico.
*   **Lista de compras automática** con suma de ingredientes duplicados.
*   **Chatbot Chef IA** para búsqueda inteligente (solo Premium).
*   Limpieza automática de archivos multimedia al eliminar recetas.
*   Botón de sugerencias/quejas directo al correo de soporte.

---

## 🔗 Ejemplos de uso de la API

### Registro de usuario
**POST** `/api/auth/register`
```json
{
  "nombre": "Juan",
  "apellido": "Perez",
  "email": "juan@example.com",
  "username": "juanito",
  "password": "Password123",
  "esPremium": true
}
```

### Verificar código OTP
**POST** `/api/auth/verify-otp`
```json
{
  "email": "juan@example.com",
  "otp": "123456"
}
```

### Inicio de sesión
**POST** `/api/auth/login`
```json
{
  "username": "juanito",
  "password": "Password123"
}
```

### Crear una nueva receta (Premium)
**POST** `/api/recipes`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "titulo": "Tacos de Pollo",
  "ingredientes": "Tortillas, Pollo, Salsa",
  "pasos": "1. Cocer pollo. 2. Armar tacos.",
  "precioNumerico": 45,
  "tiempoNumerico": 20,
  "porciones": "4",
  "videoUrl": "https://url-del-video.mp4"
}
```

---

## 📂 Estructura del Proyecto

```text
PROYECTO/
└── 2.0/
    ├── node_modules/           # Dependencias
    ├── public/                 # Frontend
    │   ├── css/                # Estilos
    │   ├── js/                 # Lógica (Auth, Planificador, Chat, etc.)
    │   ├── home.html           # Dashboard
    │   ├── index.html          # Bienvenida
    │   └── receta.html         # Detalle
    ├── server.js               # Backend Node.js/Express
    └── README.md               # Documentación
```

---

## ⚠️ Estado del Proyecto
Este proyecto se encuentra en **Versión Beta**. Se han implementado robustos sistemas de seguridad y limpieza de datos, pero se recomienda su uso bajo supervisión.

Developed with ❤️ by **Alison Lugo & Team**.
