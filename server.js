const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const SECRET = 'tu-secreto-super-seguro-123';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'a@gmail.com',
    pass: 'a <aa> a yanki127'
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const users = [];
const otpStore = new Map();
let recipes = [];
let nextId = 1;

recipes = [
  {
    id: 1,
    titulo: "Pasta Alfredo Económica",
    ingredientes: "Pasta - 200g, Crema - 1/2 taza, Queso parmesano - 50g, Ajo - 2 dientes, Mantequilla - 1 cucharada, Sal, Pimienta",
    pasos: "1. Cocer la pasta en agua con sal.\n2. En una sartén, derretir mantequilla y sofreír ajo.\n3. Agregar crema y queso, mezclar.\n4. Incorporar la pasta cocida.\n5. Servir con más queso por encima.",
    precio: "$28 MXN",
    precioNumerico: 28,
    tiempo: "15 min",
    tiempoNumerico: 15,
    imagen: null,
    autor: "Chef Demo",
    etiquetas: ["economica", "rapida", "menos30"],
    fecha: new Date().toISOString()
  },
  {
    id: 2,
    titulo: "Arroz con Huevo Rápido",
    ingredientes: "Arroz - 1 taza, Huevos - 2 unidades, Aceite - 1 cucharada, Sal, Cebolla - 1/4",
    pasos: "1. Cocer el arroz.\n2. Freír los huevos.\n3. Mezclar con arroz y cebolla picada.\n4. Servir caliente.",
    precio: "$20 MXN",
    precioNumerico: 20,
    tiempo: "10 min",
    tiempoNumerico: 10,
    imagen: null,
    autor: "Chef Demo",
    etiquetas: ["economica", "rapida", "menos30"],
    fecha: new Date().toISOString()
  },
  {
    id: 3,
    titulo: "Hot Dog al Microondas",
    ingredientes: "Pan para hot dog, Salchicha, Queso, Salsa de tomate",
    pasos: "1. Colocar la salchicha en el pan.\n2. Agregar queso.\n3. Calentar en microondas por 1 minuto.\n4. Agregar salsa y servir.",
    precio: "$15 MXN",
    precioNumerico: 15,
    tiempo: "2 min",
    tiempoNumerico: 2,
    imagen: null,
    autor: "Chef Demo",
    etiquetas: ["economica", "rapida", "microondas", "menos30"],
    fecha: new Date().toISOString()
  }
];
nextId = 4;

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidUsername(username) {
  return username && username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

function isValidPassword(password) {
  return password && password.length >= 8;
}

function isValidName(name) {
  return name && name.length >= 2 && name.length <= 50;
}

app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, esPremium } = req.body;

  if (!nombre || !apellido || !email || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: '❌ Todos los campos con * son obligatorios' });
  }

  if (!isValidName(nombre)) {
    return res.status(400).json({ error: '❌ El nombre debe tener entre 2 y 50 caracteres' });
  }

  if (!isValidName(apellido)) {
    return res.status(400).json({ error: '❌ El apellido debe tener entre 2 y 50 caracteres' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '❌ Ingresa un email válido (ejemplo: usuario@gmail.com)' });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: '❌ El username debe tener 3-20 caracteres y solo puede contener letras, números y guión bajo' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: '❌ La contraseña debe tener al menos 8 caracteres' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: '❌ Las contraseñas no coinciden' });
  }

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: '❌ Este email ya está registrado' });
  }

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: '❌ Este username ya está en uso' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  otpStore.set(email, {
    code: otp,
    type: 'register',
    data: { nombre, apellido, email, username, password, esPremium: esPremium || false },
    expires: Date.now() + 5 * 60 * 1000
  });

  try {
    await transporter.sendMail({
      from: 'ForananeoKitchen <tallinves@gmail.com>',
      to: email,
      subject: 'Código de verificación - ForananeoKitchen',
      html: `<h2>¡Bienvenido a ForananeoKitchen!</h2><p>Tu código de verificación es:</p><h1 style="font-size:36px;letter-spacing:4px;background:#f0f0f0;padding:20px;text-align:center;">${otp}</h1><p>Este código expira en 5 minutos.</p>`
    });
    res.json({ message: '✅ Código enviado a tu correo', email });
  } catch (error) {
    otpStore.delete(email);
    res.status(500).json({ error: '❌ Error al enviar el email. Intenta nuevamente' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '❌ Usuario y contraseña son obligatorios' });
  }

  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(400).json({ error: '❌ Usuario o contraseña incorrectos' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({ error: '❌ Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, email: user.email, esPremium: user.esPremium }, SECRET, { expiresIn: '7d' });

  res.json({ token, user: { id: user.id, username: user.username, email: user.email, esPremium: user.esPremium } });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: '❌ Email y código son obligatorios' });
  }

  const stored = otpStore.get(email);

  if (!stored) {
    return res.status(400).json({ error: '❌ Código inválido o expirado. Solicita uno nuevo' });
  }

  if (stored.code !== otp) {
    return res.status(400).json({ error: '❌ Código incorrecto. Verifica e intenta nuevamente' });
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: '❌ El código ha expirado. Solicita uno nuevo' });
  }

  if (stored.type === 'register') {
    const data = stored.data;
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = {
      id: users.length + 1,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      username: data.username,
      password: hashedPassword,
      esPremium: data.esPremium || false,
      fechaRegistro: new Date().toISOString()
    };

    users.push(newUser);
    otpStore.delete(email);

    const token = jwt.sign({ id: newUser.id, username: newUser.username, email: newUser.email, esPremium: newUser.esPremium }, SECRET, { expiresIn: '7d' });

    return res.json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email, esPremium: newUser.esPremium } });
  }

  if (stored.type === 'reset') {
    return res.json({ verified: true, email: email });
  }

  res.status(400).json({ error: '❌ Tipo de verificación inválido' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '❌ Ingresa tu email' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '❌ Ingresa un email válido (ejemplo: usuario@gmail.com)' });
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(400).json({ error: '❌ No existe una cuenta con este email' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  otpStore.set(email, {
    code: otp,
    type: 'reset',
    email: email,
    expires: Date.now() + 5 * 60 * 1000
  });

  try {
    await transporter.sendMail({
      from: 'ForananeoKitchen <tallinves@gmail.com>',
      to: email,
      subject: 'Recuperar contraseña - ForananeoKitchen',
      html: `<h2>Recuperación de contraseña</h2><p>Tu código para restablecer tu contraseña es:</p><h1 style="font-size:36px;letter-spacing:4px;background:#f0f0f0;padding:20px;text-align:center;">${otp}</h1><p>Este código expira en 5 minutos.</p><p>Si no solicitaste esto, ignora este mensaje.</p>`
    });
    res.json({ message: '✅ Código enviado a tu correo', email });
  } catch (error) {
    otpStore.delete(email);
    res.status(500).json({ error: '❌ Error al enviar el email. Intenta nuevamente' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword, confirmNewPassword } = req.body;

  if (!email || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: '❌ Todos los campos son obligatorios' });
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: '❌ La nueva contraseña debe tener al menos 8 caracteres' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: '❌ Las contraseñas no coinciden' });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).json({ error: '❌ Usuario no encontrado' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  res.json({ message: '✅ Contraseña actualizada correctamente' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '❌ No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const user = users.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({ error: '❌ Usuario no encontrado' });
    }

    res.json({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      username: user.username,
      esPremium: user.esPremium,
      fechaRegistro: user.fechaRegistro
    });
  } catch (error) {
    res.status(401).json({ error: '❌ Token inválido' });
  }
});

app.get('/api/recipes', (req, res) => {
  res.json(recipes);
});

app.get('/api/recipes/:id', (req, res) => {
  const receta = recipes.find(r => r.id === parseInt(req.params.id));
  if (!receta) {
    return res.status(404).json({ error: '❌ Receta no encontrada' });
  }
  res.json(receta);
});

app.post('/api/recipes', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '❌ No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const { titulo, ingredientes, pasos, precio, precioNumerico, tiempo, tiempoNumerico, imagen, etiquetas } = req.body;
    
    if (!titulo || !ingredientes || !pasos) {
      return res.status(400).json({ error: '❌ Título, ingredientes y pasos son obligatorios' });
    }
    
    if (precioNumerico === undefined || tiempoNumerico === undefined) {
      return res.status(400).json({ error: '❌ Precio y tiempo numéricos son obligatorios' });
    }

    const nuevaReceta = { 
      id: nextId++, 
      titulo: titulo.trim(),
      ingredientes: ingredientes.trim(),
      pasos: pasos.trim(),
      precio: precio && precio.trim() ? precio.trim() : `$${precioNumerico} MXN`,
      precioNumerico: precioNumerico,
      tiempo: tiempo && tiempo.trim() ? tiempo.trim() : `${tiempoNumerico} min`,
      tiempoNumerico: tiempoNumerico,
      imagen: imagen || null,
      autor: decoded.username,
      etiquetas: etiquetas || [],
      fecha: new Date().toISOString()
    };
    
    recipes.push(nuevaReceta);
    console.log(`\n✅ Nueva receta publicada: ${nuevaReceta.titulo}`);
    res.status(201).json(nuevaReceta);
    
  } catch (err) {
    console.error('Error al crear receta:', err);
    res.status(401).json({ error: '❌ Token inválido' });
  }
});

app.delete('/api/recipes/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '❌ No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const recetaId = parseInt(req.params.id);
    const recetaIndex = recipes.findIndex(r => r.id === recetaId);
    
    if (recetaIndex === -1) {
      return res.status(404).json({ error: '❌ Receta no encontrada' });
    }
    
    const receta = recipes[recetaIndex];
    
    if (receta.autor !== decoded.username && !decoded.esPremium) {
      return res.status(403).json({ error: '❌ No tienes permiso para eliminar esta receta' });
    }
    
    recipes.splice(recetaIndex, 1);
    res.json({ message: '✅ Receta eliminada correctamente' });
    
  } catch (err) {
    res.status(401).json({ error: '❌ Token inválido' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📝 API de recetas: http://localhost:${PORT}/api/recipes`);
  console.log(`👥 Usuarios registrados: ${users.length}`);
  console.log(`📚 Recetas disponibles: ${recipes.length}\n`);
});