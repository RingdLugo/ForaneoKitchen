require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neqnkbqhzdtqfoxqpgld.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcW5rYnFoemR0cWZveHFwZ2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDc0NTUsImV4cCI6MjA5MjQyMzQ1NX0.5Jb1FUqD1FJZAtPxkaW5Qy5e6X8efauzVJMQTGTNDsg';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔌 Conectando a Supabase...');

// OTP store en memoria
const otpStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expires < now) otpStore.delete(key);
  }
}, 60000);

// Configuración de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'kansonyun064@gmail.com',
    pass: process.env.EMAIL_PASS || 'ddki anqj bxad mxcy'
  }
});

app.use(express.json({ limit: '15mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// HELPERS
// =====================================================

function makeToken(user) {
  return Buffer.from(JSON.stringify({
    id: user.id, username: user.username,
    email: user.email, esPremium: user.es_premium
  })).toString('base64');
}

function decodeToken(token) {
  try { return JSON.parse(Buffer.from(token, 'base64').toString()); }
  catch { return null; }
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  const token = auth.split(' ')[1];
  const decoded = decodeToken(token);
  if (!decoded) return res.status(401).json({ error: 'Token inválido' });

  const { data } = await supabase.from('usuarios').select('*').eq('id', decoded.id).single();
  if (!data) return res.status(401).json({ error: 'Usuario no encontrado' });
  req.user = data;
  next();
}

function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth) {
    const token = auth.split(' ')[1];
    const decoded = decodeToken(token);
    if (decoded) req.userId = decoded.id;
  }
  next();
}

function generarOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(email, otp, tipo) {
  const isReset = tipo === 'reset';
  const subject = isReset ? '🔐 Recuperar contraseña — ForaneoKitchen' : '✅ Verificar cuenta — ForaneoKitchen';
  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fff9;border-radius:16px;border:1px solid #c8e6c9">
      <h2 style="color:#2e7d32;margin:0 0 8px">🍳 ForaneoKitchen</h2>
      <p style="color:#555;margin:0 0 24px">${isReset ? 'Solicitud de recuperación de contraseña' : 'Verificación de nueva cuenta'}</p>
      <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:2px dashed #4caf50">
        <p style="margin:0 0 8px;color:#888;font-size:13px">TU CÓDIGO ES</p>
        <p style="font-size:42px;font-weight:700;letter-spacing:12px;color:#2e7d32;margin:0">${otp}</p>
        <p style="margin:8px 0 0;color:#888;font-size:12px">Válido por 10 minutos</p>
      </div>
      <p style="color:#aaa;font-size:11px;margin:24px 0 0;text-align:center">Si no solicitaste esto, ignora este mensaje.</p>
    </div>`;
  try {
    await transporter.sendMail({ from: '"ForaneoKitchen 🍳" <kansonyun064@gmail.com>', to: email, subject, html });
    console.log(`📧 OTP enviado a ${email}: ${otp}`);
    return true;
  } catch (err) {
    console.error('❌ Email error:', err.message);
    console.log(`🔑 OTP (dev) para ${email}: ${otp}`);
    return false;
  }
}

// Verificar Premium activo
async function verificarPremium(usuario) {
  if (!usuario.es_premium) return false;
  if (usuario.premium_expira && new Date(usuario.premium_expira) < new Date()) {
    await supabase.from('usuarios').update({ es_premium: false }).eq('id', usuario.id);
    return false;
  }
  return true;
}

// Calcular costo automático de receta
async function calcularCostoAutomatico(ingredientes) {
  const { data, error } = await supabase.rpc('calcular_costo_receta', { 
    ingredientes_text: ingredientes 
  });
  if (error) {
    console.error('Error calculando costo:', error);
    return 0;
  }
  return data || 0;
}

// =====================================================
// AUTH: REGISTRO
// =====================================================

app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, esPremium } = req.body;
  if (!nombre || !apellido || !email || !username || !password || !confirmPassword)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const { data: u1 } = await supabase.from('usuarios').select('id').eq('username', username).maybeSingle();
  if (u1) return res.status(400).json({ error: 'El usuario ya existe' });
  const { data: u2 } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (u2) return res.status(400).json({ error: 'El email ya está registrado' });

  const otp = generarOTP();
  otpStore.set(email, {
    otp, expires: Date.now() + 10 * 60 * 1000, tipo: 'registro',
    datos: { nombre, apellido, email, username, password, esPremium: esPremium || false }
  });

  await sendOTP(email, otp, 'registro');
  res.json({ mensaje: 'Código enviado a tu correo', email });
});

// =====================================================
// AUTH: VERIFY OTP
// =====================================================

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email y código requeridos' });

  const stored = otpStore.get(email);
  if (!stored) return res.status(400).json({ error: 'No hay código pendiente para este email' });
  if (Date.now() > stored.expires) { otpStore.delete(email); return res.status(400).json({ error: 'El código ha expirado' }); }
  if (stored.otp !== otp.toString().trim()) return res.status(400).json({ error: 'Código incorrecto' });

  otpStore.delete(email);

  if (stored.tipo === 'registro') {
    const { nombre, apellido, username, password, esPremium } = stored.datos;
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('usuarios').insert({
      nombre, apellido, email, username,
      password_hash: hash, es_premium: esPremium,
      bio: '', foto_perfil: null, preferencias: [],
      fecha_registro: new Date().toISOString()
    }).select().single();
    if (error) { console.error(error); return res.status(500).json({ error: 'Error al crear usuario' }); }
    return res.json({ token: makeToken(data), user: data });
  }

  if (stored.tipo === 'reset') {
    otpStore.set(`reset_ok_${email}`, { verified: true, expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ mensaje: 'Código verificado. Ahora crea tu nueva contraseña.' });
  }

  res.json({ mensaje: 'Verificado' });
});

// =====================================================
// AUTH: LOGIN
// =====================================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const { data: user } = await supabase.from('usuarios').select('*').eq('username', username).maybeSingle();
  if (!user) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

  console.log('✅ Login:', username);
  res.json({ token: makeToken(user), user: { id: user.id, username: user.username, email: user.email, esPremium: user.es_premium } });
});

// =====================================================
// AUTH: FORGOT / RESET
// =====================================================

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const { data } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (!data) return res.status(404).json({ error: 'No existe cuenta con ese email' });

  const otp = generarOTP();
  otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000, tipo: 'reset' });
  await sendOTP(email, otp, 'reset');
  res.json({ mensaje: 'Código enviado a tu correo' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword, confirmNewPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
  if (newPassword !== confirmNewPassword) return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

  const verified = otpStore.get(`reset_ok_${email}`);
  if (!verified || Date.now() > verified.expires)
    return res.status(400).json({ error: 'Debes verificar el código primero' });

  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('email', email);
  otpStore.delete(`reset_ok_${email}`);
  res.json({ mensaje: 'Contraseña actualizada' });
});

// =====================================================
// USUARIO: GET / PUT
// =====================================================

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const u = req.user;
  const esPremiumActivo = await verificarPremium(u);
  
  const [{ count: recetas }, { count: favs }, { count: hist }] = await Promise.all([
    supabase.from('recetas').select('id', { count: 'exact', head: true }).eq('usuario_id', u.id),
    supabase.from('favoritos').select('id', { count: 'exact', head: true }).eq('usuario_id', u.id),
    supabase.from('historial').select('id', { count: 'exact', head: true }).eq('usuario_id', u.id)
  ]);
  
  res.json({
    id: u.id, nombre: u.nombre, apellido: u.apellido,
    email: u.email, username: u.username,
    esPremium: esPremiumActivo,
    premiumExpira: u.premium_expira,
    bio: u.bio || '',
    fotoPerfil: u.foto_perfil || null,
    preferencias: u.preferencias || [],
    fechaRegistro: u.fecha_registro,
    stats: { recetas: recetas || 0, favoritos: favs || 0, historial: hist || 0 }
  });
});

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  const { nombre, apellido, bio, preferencias } = req.body;
  const update = {};
  if (nombre) update.nombre = nombre;
  if (apellido) update.apellido = apellido;
  if (bio !== undefined) update.bio = bio;
  if (preferencias !== undefined) update.preferencias = preferencias;

  const { error } = await supabase.from('usuarios').update(update).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: 'Error al actualizar perfil' });
  res.json({ mensaje: 'Perfil actualizado' });
});

app.post('/api/auth/avatar', authMiddleware, async (req, res) => {
  const { avatarBase64 } = req.body;
  if (!avatarBase64) return res.status(400).json({ error: 'Imagen requerida' });
  const { error } = await supabase.from('usuarios').update({ foto_perfil: avatarBase64 }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: 'Error al guardar foto' });
  res.json({ avatarUrl: avatarBase64 });
});

// =====================================================
// RECETAS (con cálculo automático, video y premium)
// =====================================================

app.get('/api/recipes', optionalAuth, async (req, res) => {
  let query = supabase
    .from('recetas')
    .select('*, autor_info:usuario_id(username, foto_perfil)')
    .order('fecha', { ascending: false });
  
  // Si hay usuario autenticado, verificar si es premium
  if (req.userId) {
    const { data: user } = await supabase.from('usuarios').select('es_premium, premium_expira').eq('id', req.userId).single();
    const esPremium = user && (user.es_premium && (!user.premium_expira || new Date(user.premium_expira) > new Date()));
    
    // Si NO es premium, filtrar recetas que NO son premium
    if (!esPremium) {
      query = query.eq('es_premium_receta', false);
    }
  } else {
    // Usuario no autenticado: solo ver recetas free
    query = query.eq('es_premium_receta', false);
  }
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Error al cargar recetas' });

  let likesSet = new Set(), favsSet = new Set();
  if (req.userId) {
    const [{ data: lks }, { data: fvs }] = await Promise.all([
      supabase.from('likes').select('receta_id').eq('usuario_id', req.userId),
      supabase.from('favoritos').select('receta_id').eq('usuario_id', req.userId)
    ]);
    (lks || []).forEach(l => likesSet.add(l.receta_id));
    (fvs || []).forEach(f => favsSet.add(f.receta_id));
  }

  const recetas = data.map(r => ({
    ...r,
    autor: r.autor_info?.username || r.autor || 'Anónimo',
    autorFoto: r.autor_info?.foto_perfil || null,
    usuarioLike: likesSet.has(r.id),
    esFavorito: favsSet.has(r.id)
  }));
  res.json(recetas);
});

app.get('/api/recipes/:id', optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data, error } = await supabase
    .from('recetas')
    .select('*, autor_info:usuario_id(username, foto_perfil)')
    .eq('id', id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Receta no encontrada' });

  // Verificar si el usuario puede ver esta receta (Free vs Premium)
  if (data.es_premium_receta && req.userId) {
    const { data: user } = await supabase.from('usuarios').select('es_premium, premium_expira').eq('id', req.userId).single();
    const esPremium = user && (user.es_premium && (!user.premium_expira || new Date(user.premium_expira) > new Date()));
    if (!esPremium) {
      return res.status(403).json({ error: 'Contenido Premium. Actualiza tu cuenta para ver esta receta.' });
    }
  } else if (data.es_premium_receta && !req.userId) {
    return res.status(401).json({ error: 'Inicia sesión para ver contenido Premium' });
  }

  let liked = false, favorito = false;
  if (req.userId) {
    const [{ data: lk }, { data: fv }] = await Promise.all([
      supabase.from('likes').select('id').eq('receta_id', id).eq('usuario_id', req.userId).maybeSingle(),
      supabase.from('favoritos').select('id').eq('receta_id', id).eq('usuario_id', req.userId).maybeSingle()
    ]);
    liked = !!lk;
    favorito = !!fv;
  }

  res.json({
    ...data,
    autor: data.autor_info?.username || data.autor || 'Anónimo',
    autorFoto: data.autor_info?.foto_perfil || null,
    usuarioLike: liked,
    esFavorito: favorito
  });
});

app.post('/api/recipes', authMiddleware, async (req, res) => {
  const { titulo, ingredientes, pasos, tiempo, tiempoNumerico, imagen, etiquetas, video_url, es_premium_receta } = req.body;
  if (!titulo || !ingredientes || !pasos)
    return res.status(400).json({ error: 'Título, ingredientes y pasos son obligatorios' });

  // Cálculo automático del costo basado en ingredientes
  const costoAutomatico = await calcularCostoAutomatico(ingredientes);
  const precioFormateado = `$${costoAutomatico} MXN`;

  const { data, error } = await supabase.from('recetas').insert({
    titulo, 
    ingredientes, 
    pasos,
    precio: precioFormateado, 
    precio_numerico: costoAutomatico,
    tiempo: tiempo || '', 
    tiempo_numerico: tiempoNumerico || 0,
    imagen: imagen || null, 
    etiquetas: etiquetas || [],
    video_url: video_url || null,
    es_premium_receta: es_premium_receta || false,
    autor: req.user.username, 
    usuario_id: req.user.id,
    likes: 0, 
    fecha: new Date().toISOString()
  }).select().single();

  if (error) { 
    console.error(error); 
    return res.status(500).json({ error: 'Error al crear receta' }); 
  }

  // =====================================================
  // SISTEMA DE RECOMPENSAS
  // Si el usuario es FREE, gana Premium por 7 días al subir receta
  // =====================================================
  const { data: userActual } = await supabase.from('usuarios').select('es_premium, premium_expira').eq('id', req.user.id).single();
  
  if (!userActual.es_premium) {
    const fechaFinPremium = new Date();
    fechaFinPremium.setDate(fechaFinPremium.getDate() + 7);
    
    await supabase.from('usuarios').update({ 
      es_premium: true,
      premium_expira: fechaFinPremium.toISOString()
    }).eq('id', req.user.id);
    
    console.log(`🎁 RECOMPENSA: ${req.user.username} ahora es PREMIUM por 7 días por subir receta!`);
  } else {
    // Si ya es premium, extender 3 días más
    const fechaActual = userActual.premium_expira ? new Date(userActual.premium_expira) : new Date();
    if (fechaActual < new Date()) fechaActual.setDate(new Date().getDate());
    fechaActual.setDate(fechaActual.getDate() + 3);
    
    await supabase.from('usuarios').update({ 
      premium_expira: fechaActual.toISOString()
    }).eq('id', req.user.id);
    
    console.log(`🎁 RECOMPENSA: Premium extendido 3 días para ${req.user.username}`);
  }

  res.json(data);
});

app.delete('/api/recipes/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data } = await supabase.from('recetas').select('usuario_id').eq('id', id).single();
  if (!data) return res.status(404).json({ error: 'No encontrada' });
  if (data.usuario_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });
  await supabase.from('recetas').delete().eq('id', id);
  res.json({ mensaje: 'Receta eliminada' });
});

// =====================================================
// LIKES
// =====================================================

app.post('/api/recipes/:id/like', authMiddleware, async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const userId = req.user.id;

  const { data: existing } = await supabase.from('likes')
    .select('id').eq('receta_id', recipeId).eq('usuario_id', userId).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Ya diste like a esta receta' });

  await supabase.from('likes').insert({ receta_id: recipeId, usuario_id: userId, fecha: new Date().toISOString() });
  await supabase.rpc('increment_likes', { receta_id: recipeId });
  
  const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
  res.json({ likes: r?.likes || 0 });
});

app.delete('/api/recipes/:id/like', authMiddleware, async (req, res) => {
  const recipeId = parseInt(req.params.id);
  await supabase.from('likes').delete().eq('receta_id', recipeId).eq('usuario_id', req.user.id);
  const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
  const newLikes = Math.max((r?.likes || 1) - 1, 0);
  await supabase.from('recetas').update({ likes: newLikes }).eq('id', recipeId);
  res.json({ likes: newLikes });
});

app.get('/api/recipes/:id/like', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('likes')
    .select('id').eq('receta_id', parseInt(req.params.id)).eq('usuario_id', req.user.id).maybeSingle();
  res.json({ liked: !!data });
});

// =====================================================
// COMENTARIOS
// =====================================================

app.get('/api/recipes/:id/comments', async (req, res) => {
  const { data, error } = await supabase
    .from('comentarios')
    .select('*, usuario:usuario_id(id, username, foto_perfil)')
    .eq('receta_id', parseInt(req.params.id))
    .order('fecha', { ascending: true });
  if (error) return res.status(500).json({ error: 'Error al cargar comentarios' });
  res.json(data || []);
});

app.post('/api/recipes/:id/comments', authMiddleware, async (req, res) => {
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ error: 'Comentario vacío' });
  if (texto.length > 500) return res.status(400).json({ error: 'Máximo 500 caracteres' });

  const { data, error } = await supabase.from('comentarios').insert({
    receta_id: parseInt(req.params.id),
    usuario_id: req.user.id,
    texto: texto.trim(),
    fecha: new Date().toISOString()
  }).select('*, usuario:usuario_id(id, username, foto_perfil)').single();

  if (error) return res.status(500).json({ error: 'Error al publicar' });
  res.json(data);
});

app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('comentarios').select('usuario_id').eq('id', req.params.id).single();
  if (!data) return res.status(404).json({ error: 'No encontrado' });
  if (data.usuario_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });
  await supabase.from('comentarios').delete().eq('id', req.params.id);
  res.json({ mensaje: 'Eliminado' });
});

// =====================================================
// FAVORITOS
// =====================================================

app.get('/api/users/me/favorites', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('favoritos')
    .select('receta:receta_id(*)')
    .eq('usuario_id', req.user.id)
    .order('fecha', { ascending: false });
  res.json((data || []).map(f => f.receta).filter(Boolean));
});

app.post('/api/users/me/favorites/:recipeId', authMiddleware, async (req, res) => {
  const recipeId = parseInt(req.params.recipeId);
  const { data: existing } = await supabase.from('favoritos')
    .select('id').eq('receta_id', recipeId).eq('usuario_id', req.user.id).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Ya en favoritos' });
  await supabase.from('favoritos').insert({ receta_id: recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() });
  res.json({ mensaje: 'Agregado a favoritos' });
});

app.delete('/api/users/me/favorites/:recipeId', authMiddleware, async (req, res) => {
  await supabase.from('favoritos').delete()
    .eq('receta_id', parseInt(req.params.recipeId)).eq('usuario_id', req.user.id);
  res.json({ mensaje: 'Eliminado de favoritos' });
});

app.get('/api/users/me/favorites/:recipeId', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('favoritos')
    .select('id').eq('receta_id', parseInt(req.params.recipeId)).eq('usuario_id', req.user.id).maybeSingle();
  res.json({ favorito: !!data });
});

// =====================================================
// HISTORIAL
// =====================================================

app.get('/api/users/me/history', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('historial')
    .select('receta:receta_id(*), fecha')
    .eq('usuario_id', req.user.id)
    .order('fecha', { ascending: false })
    .limit(30);
  res.json((data || []).map(h => h.receta).filter(Boolean));
});

app.post('/api/users/me/history', authMiddleware, async (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' });

  const { data: existing } = await supabase.from('historial')
    .select('id').eq('receta_id', recipeId).eq('usuario_id', req.user.id).maybeSingle();

  if (existing) {
    await supabase.from('historial').update({ fecha: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('historial').insert({ receta_id: recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() });
  }
  res.json({ mensaje: 'OK' });
});

// =====================================================
// RECETAS DEL USUARIO
// =====================================================

app.get('/api/users/me/recipes', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('recetas')
    .select('*').eq('usuario_id', req.user.id).order('fecha', { ascending: false });
  res.json(data || []);
});

app.get('/api/users/me/likes', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id);
  res.json((data || []).map(l => l.receta_id));
});

// =====================================================
// PRECIOS DE INGREDIENTES (para admin)
// =====================================================

app.get('/api/precios-ingredientes', async (req, res) => {
  const { data, error } = await supabase.from('precios_ingredientes').select('*').order('nombre');
  if (error) return res.status(500).json({ error: 'Error al cargar precios' });
  res.json(data);
});

app.post('/api/precios-ingredientes', authMiddleware, async (req, res) => {
  // Solo admins pueden actualizar precios (opcional)
  const { nombre, precio_por_unidad, unidad } = req.body;
  const { error } = await supabase.from('precios_ingredientes').upsert({
    nombre, precio_por_unidad, unidad, ultima_actualizacion: new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: 'Error al actualizar precio' });
  res.json({ mensaje: 'Precio actualizado' });
});

// =====================================================
// SERVIDOR
// =====================================================

app.listen(PORT, () => {
  console.log(`\n✅ ForaneoKitchen corriendo en http://localhost:${PORT}`);
  console.log(`📖 API: http://localhost:${PORT}/api/recipes\n`);
});