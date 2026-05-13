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

*   **Autenticación Robusta:** Registro de usuarios con verificación por correo **OTP** y manejo de sesiones seguras mediante **JWT**.
*   **Validación de Identidad:** Sistema que impide la creación de cuentas con correos o nombres de usuario duplicados, garantizando la integridad de la base de datos.
*   **Chef IA (Inteligencia Multi-Rasgo):** Asistente inteligente capaz de procesar múltiples criterios simultáneamente (ej. "barato, saludable y con pollo"). Incluye un modo conversacional para interacciones naturales.
*   **Filtro de Ruido (Stop Words):** El buscador y el chatbot ignoran automáticamente palabras irrelevantes (ej. "receta", "necesito", "sobre") para enfocar los resultados en ingredientes y términos clave.
*   **Pago Seguro con Validación Real:** Pasarela de pago simulada que utiliza el **Algoritmo de Luhn** para validar tarjetas, verifica fechas de expiración futuras y ofrece una interfaz con señales de confianza (SSL, Visa, Mastercard).
*   **Gestión Multimedia Avanzada:** Soporte para imágenes y videos (YouTube o MP4 local). Los usuarios Premium pueden subir tutoriales directamente.
*   **Limpieza Automática (Garbage Collection):** Al eliminar una receta, el sistema borra físicamente del servidor todos los archivos de imagen y video asociados para ahorrar espacio.
*   **Planificador e Inteligencia de Compras:** Sistema que detecta ingredientes duplicados en el plan semanal y los suma automáticamente en la lista de compras final.
*   **Validaciones Anti-Spam:** Algoritmos que detectan texto sin sentido (*Gibberish*), palabras ofensivas (*Profanity*) y caracteres repetidos para mantener la calidad del contenido.

---

## 🛡️ Seguridad y Validaciones Técnicas

El proyecto implementa varias capas de seguridad para proteger los datos y mejorar la experiencia:

1.  **Encriptación:** Las contraseñas se almacenan cifradas con `bcryptjs` (salt rounds: 10).
2.  **Validación de Tarjetas:** La pasarela de pago implementa el estándar industrial de validación de números de tarjeta y checks de caducidad dinámica.
3.  **Sanitización:** Todas las entradas de texto son limpiadas de etiquetas HTML para prevenir ataques **XSS**.
4.  **Middleware de Acceso:** Las rutas sensibles del servidor están protegidas por un middleware que verifica la validez del token JWT y el nivel de membresía (Free/Premium).

---

## 🔗 Ejemplos de uso de la API

### Registro de usuario
**POST** `/api/auth/registro`
```json
{
  "nombre": "Juan",
  "apellido": "Perez",
  "email": "juan@example.com",
  "username": "juanito",
  "password": "Password123"
}
```

### Suscripción Premium
**POST** `/api/auth/subscribe`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "renovar": false
}
```

### Consulta al Chef IA
**POST** `/api/chatbot`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "mensaje": "tengo pollo y arroz, algo de menos de 40 min"
}
```

---

## 📂 Estructura del Proyecto

```text
PROYECTO/
└── 2.0/
    ├── node_modules/           # Dependencias del servidor
    ├── uploads/                # Archivos multimedia (Imágenes/Videos)
    ├── public/                 # Frontend (Archivos estáticos)
    │   ├── css/                # Diseño y Temas (Claro/Oscuro)
    │   ├── js/                 # Lógica (Auth, Perfil, Chat, Recetas)
    │   ├── components/         # Snippets de UI reutilizables
    │   └── *.html              # Vistas de la aplicación
    ├── server.js               # Backend (Express + Supabase SDK)
    └── README.md               # Documentación técnica
```

---

## ⚠️ Estado del Proyecto
Este proyecto se encuentra en una fase estable de desarrollo. Se han implementado robustos sistemas de seguridad y optimización de datos, cumpliendo con los estándares de una aplicación profesional escalable.

Developed with ❤️ by **RingdLugo & Team**.
