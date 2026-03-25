const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET = 'tu-secreto-super-seguro-123';

// Middleware - IMPORTANTE: aumentar límite para imágenes en base64
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Base de datos en memoria
const users = [];
let recipes = [];
let nextId = 1;

// Agregar algunas recetas de ejemplo
recipes = [
  {
    id: 1,
    titulo: "Pasta Alfredo Económica",
    ingredientes: "Pasta, crema, queso parmesano, mantequilla, ajo, sal, pimienta",
    pasos: "1. Cocer la pasta en agua con sal.\n2. En una sartén, derretir mantequilla y sofreír ajo.\n3. Agregar crema y queso, mezclar.\n4. Incorporar la pasta cocida.\n5. Servir con más queso por encima.",
    precio: "$28 MXN",
    tiempo: "15 min",
    imagen: null,
    autor: "Chef Demo"
  },
  {
    id: 2,
    titulo: "Arroz con Huevo Rápido",
    ingredientes: "Arroz, huevos, aceite, sal, cebolla",
    pasos: "1. Cocer el arroz.\n2. Freír los huevos.\n3. Mezclar con arroz y cebolla picada.",
    precio: "$20 MXN",
    tiempo: "10 min",
    imagen: null,
    autor: "Chef Demo"
  }
];
nextId = 3;

// Ruta de registro
app.post('/api/auth/registro', async (req, res) => {
  const { username, password, esPremium } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuario ya existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { 
    id: users.length + 1,
    username, 
    password: hashedPassword, 
    esPremium: !!esPremium 
  };
  users.push(user);

  const token = jwt.sign({ 
    id: user.id,
    username, 
    esPremium: user.esPremium 
  }, SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { username, esPremium: user.esPremium } });
});

// Ruta de login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ 
    id: user.id,
    username, 
    esPremium: user.esPremium 
  }, SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { username, esPremium: user.esPremium } });
});

// Obtener todas las recetas
app.get('/api/recetas', (req, res) => {
  res.json(recipes);
});

// Obtener una receta específica
app.get('/api/recetas/:id', (req, res) => {
  const receta = recipes.find(r => r.id === parseInt(req.params.id));
  if (!receta) {
    return res.status(404).json({ error: 'Receta no encontrada' });
  }
  res.json(receta);
});

// Crear una nueva receta
app.post('/api/recetas', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const { titulo, ingredientes, pasos, precio, tiempo, imagen } = req.body;
    
    if (!titulo || !ingredientes || !pasos) {
      return res.status(400).json({ error: 'Título, ingredientes y pasos son obligatorios' });
    }

    const nuevaReceta = { 
      id: nextId++, 
      titulo: titulo.trim(),
      ingredientes: ingredientes.trim(),
      pasos: pasos.trim(),
      precio: precio && precio.trim() ? precio.trim() : '$$',
      tiempo: tiempo && tiempo.trim() ? tiempo.trim() : '30 min',
      imagen: imagen || null,
      autor: decoded.username,
      fecha: new Date().toISOString()
    };
    
    recipes.push(nuevaReceta);
    console.log(`✅ Nueva receta publicada: ${nuevaReceta.titulo} por ${nuevaReceta.autor}`);
    res.status(201).json(nuevaReceta);
    
  } catch (err) {
    console.error('Error al crear receta:', err);
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Eliminar una receta
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📝 API de recetas: http://localhost:${PORT}/api/recetas`);
  console.log(`👥 Usuarios registrados: ${users.length}`);
  console.log(`📚 Recetas disponibles: ${recipes.length}\n`);
});