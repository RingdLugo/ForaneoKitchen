const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET = 'tu-secreto-super-seguro-123';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); 
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const users = [];
const recipes = [];

app.post('/api/auth/registro', async (req, res) => {
  const { username, password, esPremium } = req.body;
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Usuario ya existe' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { username, password: hashedPassword, esPremium: !!esPremium };
  users.push(user);

  const token = jwt.sign({ username, esPremium: user.esPremium }, SECRET, { expiresIn: '1h' });
  res.json({ token, user: { username, esPremium: user.esPremium } });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign({ username, esPremium: user.esPremium }, SECRET, { expiresIn: '1h' });
  res.json({ token, user: { username, esPremium: user.esPremium } });
});

app.get('/api/recetas', (req, res) => res.json(recipes));

app.post('/api/recetas', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const { titulo, ingredientes, pasos } = req.body;
    if (!titulo || !ingredientes || !pasos) return res.status(400).json({ error: 'Faltan campos' });

    const receta = { id: recipes.length + 1, titulo, ingredientes, pasos, autor: decoded.username };
    recipes.push(receta);
    res.status(201).json(receta);
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));