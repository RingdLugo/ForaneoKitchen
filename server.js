const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');  // ← NUEVO
const crypto = require('crypto');          // ← NUEVO

const app = express();
const PORT = 3000;
const SECRET = 'tu-secreto-super-seguro-123';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tallinves@gmail.com',      
    pass: 'wrxp bmfk dqiz yank'   
  }
});

const otpStore = new Map(); 

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const users = [];
let recipes = [
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
let nextId = 4;

app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, fechaNacimiento, esPremium } = req.body;
  
  if (!email || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Email, username, password y confirmación requeridos' });
  }

  if (!/(gmail|hotmail|outlook|yahoo|icloud)/i.test(email)) {
    return res.status(400).json({ error: 'Solo gmail, hotmail, outlook, yahoo, icloud' });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Contraseñas no coinciden' });
  }
  
  if (users.find(u => u.username === username || u.email === email)) {
    return res.status(400).json({ error: 'Username o email ya existe' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { code: otp, expires: Date.now() + 5*60*1000 });
  
  try {
    await transporter.sendMail({
      from: '"Recetas Económicas" <tu-email@gmail.com>',
      to: email,
      subject: 'Verifica tu cuenta',
      html: `<h2>Código de verificación</h2><p><strong>${otp}</strong></p><p>Válido 5 minutos</p>`
    });
  } catch(err) {
    return res.status(500).json({ error: 'Error enviando email' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { 
    id: users.length + 1, nombre, apellido, email, username,
    password: hashedPassword, fechaNacimiento, esPremium: !!esPremium,
    verificado: false  // ← NUEVO
  };
  users.push(user);
  
  res.json({ message: 'Código enviado', email });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore.get(email);
  
  if (!stored || Date.now() > stored.expires || stored.code !== otp) {
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }
  
  const user = users.find(u => u.email === email);
  user.verificado = true;
  otpStore.delete(email);
  
  const token = jwt.sign({ 
    id: user.id, username: user.username, esPremium: user.esPremium 
  }, SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { username: user.username, esPremium: user.esPremium } });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  if (!user.verificado) {  // ← NUEVO
    return res.status(403).json({ error: 'Verifica tu email primero' });
  }
  
  const token = jwt.sign({ 
    id: user.id, username, esPremium: user.esPremium 
  }, SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { username, esPremium: user.esPremium } });
});

app.get('/api/recetas', (req, res) => {
  res.json(recipes);
});

app.get('/api/recetas/:id', (req, res) => {
  const receta = recipes.find(r => r.id === parseInt(req.params.id));
  if (!receta) {
    return res.status(404).json({ error: 'Receta no encontrada' });
  }
  res.json(receta);
});

app.post('/api/recetas', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET);
    const { titulo, ingredientes, pasos, precio, precioNumerico, tiempo, tiempoNumerico, imagen, etiquetas } = req.body;
    
    if (!titulo || !ingredientes || !pasos) {
      return res.status(400).json({ error: 'Título, ingredientes y pasos son obligatorios' });
    }
    
    if (precioNumerico === undefined || tiempoNumerico === undefined) {
      return res.status(400).json({ error: 'Precio y tiempo numéricos son obligatorios' });
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
    console.log(`\n✅ Nueva receta: ${nuevaReceta.titulo}`);
    res.status(201).json(nuevaReceta);
    
  } catch (err) {
    console.error('Error al crear receta:', err);
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.delete('/api/recetas/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET);
    const recetaId = parseInt(req.params.id);
    const recetaIndex = recipes.findIndex(r => r.id === recetaId);
    
    if (recetaIndex === -1) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const receta = recipes[recetaIndex];
    
    if (receta.autor !== decoded.username && !decoded.esPremium) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta receta' });
    }
    
    recipes.splice(recetaIndex, 1);
    res.json({ message: 'Receta eliminada correctamente' });
    
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📝 API de recetas: http://localhost:${PORT}/api/recetas`);
  console.log(`👥 Usuarios registrados: ${users.length}`);
  console.log(`📚 Recetas disponibles: ${recipes.length}\n`);
});