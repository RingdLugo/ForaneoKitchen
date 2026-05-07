/**
 * ForaneoKitchen MVP — server.js CORREGIDO COMPLETO
 */
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  'https://neqnkbqhzdtqfoxqpgld.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcW5rYnFoemR0cWZveHFwZ2xkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0NzQ1NSwiZXhwIjoyMDkyNDIzNDU1fQ.gRpDty0aSC01-2UgYZtQ7-5xp2fDBcvEAlTRhAnevGI'
);

const PUNTOS = {
  ver_receta: 2,
  like: 3,
  comentar: 5,
  subir_receta: 20,
  ser_likeado: 5,
  favorito: 2
};
const COSTO_PREMIUM_7D = 200;
const COSTO_PREMIUM_30D = 700;
const COSTO_PREMIUM_90D = 1800;

app.use(express.json({ limit: '20mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// —— Helpers ——————————————————————————————————————————————————
function makeToken(u) {
  return Buffer.from(JSON.stringify({
    id: u.id, username: u.username,
    email: u.email, rol: u.rol, esPremium: u.es_premium
  })).toString('base64');
}

function decodeToken(t) {
  try { return JSON.parse(Buffer.from(t, 'base64').toString()); }
  catch { return null; }
}

async function authMW(req, res, next) {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'No autorizado' });
  const d = decodeToken(t);
  if (!d) return res.status(401).json({ error: 'Token inválido' });
  const { data } = await supabase.from('usuarios').select('*').eq('id', d.id).maybeSingle();
  if (!data) return res.status(401).json({ error: 'Sesión inválida' });
  if (data.es_premium && data.premium_hasta && new Date(data.premium_hasta) < new Date()) {
    await supabase.from('usuarios').update({ es_premium: false, rol: 'free' }).eq('id', data.id);
    data.es_premium = false; data.rol = 'free';
  }
  req.user = data;
  next();
}

function tienePermiso(u, p) {
  if (!u) return false;
  const esPrem = u.es_premium === true || u.rol === 'admin' || u.rol === 'premium';
  if (esPrem) return true;
  const prefs = Array.isArray(u.preferencias) ? u.preferencias : [];
  if (prefs.length === 0) return false;
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = prefs.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  if (tag) {
    const parts = tag.split(':');
    if (parts.length < 2) return false;
    const expiraStr = parts[1];
    if (expiraStr === 'PERMANENT') return true;
    return new Date(expiraStr) > new Date();
  }
  return false;
}

async function optAuth(req, res, next) {
  try {
    const t = req.headers.authorization?.split(' ')[1];
    if (t) {
      const d = decodeToken(t);
      if (d && d.id) {
        req.userId = d.id;
        const { data } = await supabase.from('usuarios').select('id, rol, es_premium, preferencias').eq('id', d.id).maybeSingle();
        if (data) req.user = data;
      }
    }
  } catch (e) { console.error('optAuth Error:', e); }
  next();
}

function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

async function sendOTP(email, otp, tipo) {
  console.log(`\n📧 [${tipo.toUpperCase()}] OTP para ${email}\n👉 CÓDIGO: ${otp}\n`);
  return true;
}

async function otorgarPuntos(userId, accion, extra = '') {
  const pts = PUNTOS[accion] || 0;
  if (pts === 0) return;
  try {
    await supabase.from('puntos_log').insert({
      usuario_id: userId, accion, puntos: pts, descripcion: extra, fecha: new Date().toISOString()
    });
    const { data: u } = await supabase.from('usuarios').select('puntos').eq('id', userId).single();
    await supabase.from('usuarios').update({ puntos: (u?.puntos || 0) + pts }).eq('id', userId);
  } catch (e) { console.warn('Puntos warn:', e.message); }
}

// ── AUTH ──────────────────────────────────────────────────────
app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, esPremium } = req.body;
  if (!nombre || !apellido || !email || !username || !password || !confirmPassword) return res.status(400).json({ error: 'Faltan campos' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Contraseñas no coinciden' });
  const { data: eu } = await supabase.from('usuarios').select('id').eq('username', username).maybeSingle();
  if (eu) return res.status(400).json({ error: 'Usuario existe' });
  const otp = genOTP();
  await supabase.from('otp_tokens').insert({ email, otp, tipo: 'registro', datos: { nombre, apellido, email, username, password, esPremium }, expires_at: new Date(Date.now() + 600000).toISOString(), usado: false });
  await sendOTP(email, otp, 'registro');
  res.json({ mensaje: 'Código enviado', email });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const { data: stored } = await supabase.from('otp_tokens').select('*').eq('email', email).eq('usado', false).gt('expires_at', new Date().toISOString()).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!stored || stored.otp !== otp.toString().trim()) return res.status(400).json({ error: 'Código inválido' });
  await supabase.from('otp_tokens').update({ usado: true }).eq('id', stored.id);
  if (stored.tipo === 'registro') {
    const { nombre, apellido, username, password, esPremium } = stored.datos;
    const hash = await bcrypt.hash(password, 10);
    let premiumHasta = null;
    if (esPremium) {
      let d = new Date(); d.setMonth(d.getMonth() + 1); premiumHasta = d.toISOString();
    }
    const { data: nu } = await supabase.from('usuarios').insert({ nombre, apellido, email, username, password_hash: hash, rol: esPremium ? 'premium' : 'free', es_premium: esPremium || false, premium_hasta: premiumHasta, puntos: 0, fecha_registro: new Date().toISOString() }).select().maybeSingle();
    return res.json({ token: makeToken(nu), user: nu });
  }
  res.json({ mensaje: 'Verificado' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  let { data: u } = await supabase.from('usuarios').select('*').eq('username', username).maybeSingle();
  if (!u) { const { data } = await supabase.from('usuarios').select('*').eq('email', username).maybeSingle(); u = data; }
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(400).json({ error: 'Credenciales inválidas' });
  res.json({ token: makeToken(u), user: u });
});

app.post('/api/auth/subscribe', authMW, async (req, res) => {
  const { renovar } = req.body;
  let d = new Date();
  
  // Si ya es premium y está renovando, sumar al tiempo actual
  if (renovar && req.user.es_premium && req.user.premium_hasta) {
    d = new Date(req.user.premium_hasta);
  }
  
  d.setMonth(d.getMonth() + 1);
  const hasta = d.toISOString();
  
  await supabase.from('usuarios').update({ 
    es_premium: true, 
    rol: 'premium', 
    premium_hasta: hasta, 
    premium_cancelado: false 
  }).eq('id', req.user.id);
  
  res.json({ mensaje: '¡Suscripción exitosa!', premiumHasta: hasta });
});

app.post('/api/auth/cancel-premium', authMW, async (req, res) => {
  await supabase.from('usuarios').update({ premium_cancelado: true }).eq('id', req.user.id);
  res.json({ mensaje: 'Cancelación programada' });
});

// ── MÉTODOS DE PAGO ──────────────────────────────────────────
app.get('/api/users/me/payment-methods', authMW, async (req, res) => {
  const { data } = await supabase.from('metodos_pago').select('*').eq('usuario_id', req.user.id).order('fecha_registro', { ascending: false });
  res.json(data || []);
});

app.post('/api/users/me/payment-methods', authMW, async (req, res) => {
  const { numero, exp, cvv, titular } = req.body;
  const mask = `**** **** **** ${numero.slice(-4)}`;
  const { data } = await supabase.from('metodos_pago').insert({
    usuario_id: req.user.id,
    tarjeta_mask: mask,
    token_pago: 'tok_' + Math.random().toString(36).substr(2, 9),
    fecha_registro: new Date().toISOString()
  }).select().maybeSingle();
  res.json(data);
});

// ── PERFIL ────────────────────────────────────────────────────
app.get('/api/auth/me', authMW, async (req, res) => {
  const u = req.user;
  res.json(u);
});

app.put('/api/auth/me', authMW, async (req, res) => {
  const { nombre, apellido, bio, preferencias, foto_perfil } = req.body;
  await supabase.from('usuarios').update({ nombre, apellido, bio, preferencias, foto_perfil }).eq('id', req.user.id);
  res.json({ mensaje: 'Perfil actualizado' });
});

app.get('/api/users/:id/profile', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, username, nombre, apellido, bio, foto_perfil, es_premium, rol, puntos, fecha_registro')
    .eq('id', req.params.id)
    .maybeSingle();
    
  if (error || !data) return res.status(404).json({ error: 'No encontrado' });
  res.json(data);
});

// ── ETIQUETAS ────────────────────────────────────────────────
app.get('/api/tags', async (req, res) => {
  try {
    const { data } = await supabase.from('recetas').select('etiquetas');
    const allTags = new Set(['fitness', 'vegetariano', 'vegano', 'sin gluten', 'keto', 'mexicana', 'postre']);
    data?.forEach(r => {
      if (Array.isArray(r.etiquetas)) r.etiquetas.forEach(t => allTags.add(t.toLowerCase().trim()));
    });
    res.json(Array.from(allTags).sort());
  } catch (e) { res.status(500).json({ error: 'Error etiquetas' }); }
});

// ── RECETAS ──────────────────────────────────────────────────
app.get('/api/users/me/recipes', authMW, async (req, res) => {
  const { data, error } = await supabase.from('recetas').select('*').eq('usuario_id', req.user.id).order('fecha', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/users/:id/recipes', async (req, res) => {
  const { data, error } = await supabase.from('recetas').select('*').eq('usuario_id', req.params.id).order('fecha', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/recipes', optAuth, async (req, res) => {
  const { q, orden, filter, maxPrecio, maxTiempo } = req.query;
  let query = supabase.from('recetas').select('*');
  
  if (q) query = query.or(`titulo.ilike.%${q}%,ingredientes.ilike.%${q}%`);
  
  // Sincronizar con home.js: orden=likes o filter=populares
  if (orden === 'likes' || filter === 'populares') {
    query = query.order('likes', { ascending: false });
  } else {
    query = query.order('id', { ascending: false });
  }

  if (maxPrecio) query = query.lte('precio_numerico', parseInt(maxPrecio));
  if (maxTiempo) query = query.lte('tiempo_numerico', parseInt(maxTiempo));

  const { data, error } = await query.limit(50);
  if (error) {
    console.error('Recipes Query Error:', error);
    return res.status(500).json({ error: 'Error al obtener recetas' });
  }
  res.json(data || []);
});

app.get('/api/recipes/:id', optAuth, async (req, res) => {
  const { data: recipe, error } = await supabase.from('recetas').select('*').eq('id', req.params.id).maybeSingle();
  if (error || !recipe) return res.status(404).json({ error: 'Receta no encontrada' });
  
  // Protección Premium
  if (recipe.es_premium) {
    if (!req.user || (!req.user.es_premium && req.user.rol !== 'premium' && req.user.rol !== 'admin')) {
      return res.status(403).json({ error: 'Exclusivo para Premium' });
    }
  }
  res.json(recipe);
});

app.post('/api/recipes', authMW, async (req, res) => {
  const receta = { ...req.body, autor: req.user.username, usuario_id: req.user.id, fecha: new Date().toISOString(), likes: 0 };
  const { data } = await supabase.from('recetas').insert(receta).select().maybeSingle();
  await otorgarPuntos(req.user.id, 'subir_receta', `Receta: ${req.body.titulo}`);
  res.json(data);
});

app.delete('/api/recipes/:id', authMW, async (req, res) => {
  const { data } = await supabase.from('recetas').select('autor').eq('id', req.params.id).maybeSingle();
  if (data?.autor === req.user.username) {
    await supabase.from('recetas').delete().eq('id', req.params.id);
    return res.json({ mensaje: 'Eliminado' });
  }
  res.status(403).json({ error: 'Sin permiso' });
});

// ── COMENTARIOS ──────────────────────────────────────────────
app.get('/api/recipes/:id/comments', async (req, res) => {
  // Unir con la tabla usuarios para obtener username y foto
  const { data, error } = await supabase
    .from('comentarios')
    .select('*, usuarios(username, nombre, foto_perfil, es_premium, rol)')
    .eq('receta_id', req.params.id)
    .order('fecha', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  
  // Transformar para que el frontend reciba usuario como objeto
  const transformado = (data || []).map(c => ({
    ...c,
    usuario: { ...c.usuarios, id: c.usuario_id } // Incluir ID explícitamente
  }));
  
  res.json(transformado);
});

app.post('/api/recipes/:id/comments', authMW, async (req, res) => {
  const { texto, contenido } = req.body; // Soporta ambos nombres de campo
  const finalContenido = texto || contenido;
  if (!finalContenido) return res.status(400).json({ error: 'Sin contenido' });
  
  // Verificar si es premium si se requiere
  // const esPrem = req.user.es_premium || req.user.rol === 'premium' || req.user.rol === 'admin';
  // if (!esPrem) return res.status(403).json({ error: 'Exclusivo para Premium' });

  const comentario = {
    receta_id: req.params.id,
    usuario_id: req.user.id,
    autor: req.user.username,
    contenido: finalContenido,
    texto: finalContenido, // Para compatibilidad
    fecha: new Date().toISOString()
  };
  const { data } = await supabase.from('comentarios').insert(comentario).select().maybeSingle();
  res.json(data);
});

  app.delete('/api/comments/:id', authMW, async (req, res) => {
    const { data: c } = await supabase.from('comentarios').select('usuario_id').eq('id', req.params.id).maybeSingle();
    if (!c) return res.status(404).json({ error: 'No existe' });
    if (c.usuario_id === req.user.id || req.user.rol === 'admin') {
      await supabase.from('comentarios').delete().eq('id', req.params.id);
      return res.json({ mensaje: 'Eliminado' });
    }
    res.status(403).json({ error: 'Sin permiso' });
  });

  app.post('/api/comments/:id/replies', authMW, async (req, res) => {
    const { texto, contenido } = req.body;
    const finalContenido = texto || contenido;
    if (!finalContenido) return res.status(400).json({ error: 'Sin contenido' });
    
    const respuesta = {
      receta_id: null, // Opcional si se saca de la base
      usuario_id: req.user.id,
      padre_id: req.params.id,
      texto: finalContenido,
      fecha: new Date().toISOString()
    };
    
    // Obtener el receta_id del padre
    const { data: padre } = await supabase.from('comentarios').select('receta_id').eq('id', req.params.id).single();
    if (padre) respuesta.receta_id = padre.receta_id;

    const { data, error } = await supabase.from('comentarios').insert(respuesta).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get('/api/activity', optAuth, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*, usuarios(username, foto_perfil, es_premium), recetas(titulo)')
        .order('fecha', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      const resData = (data || []).map(c => ({
        ...c,
        usuario: { ...c.usuarios, id: c.usuario_id },
        receta_titulo: c.recetas?.titulo || 'Receta'
      }));
      
      res.json(resData);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

// ── LIKES / FAVS / HISTORY ──────────────────────────────────
app.post('/api/recipes/:id/like', authMW, async (req, res) => {
  await supabase.from('likes').insert({ receta_id: req.params.id, usuario_id: req.user.id, fecha: new Date().toISOString() });
  const { data: r } = await supabase.from('recetas').select('likes').eq('id', req.params.id).single();
  await supabase.from('recetas').update({ likes: (r?.likes || 0) + 1 }).eq('id', req.params.id);
  res.json({ likes: (r?.likes || 0) + 1 });
});

app.get('/api/users/me/favorites', authMW, async (req, res) => {
  const { data: favs } = await supabase.from('favoritos').select('receta_id').eq('usuario_id', req.user.id);
  if (!favs?.length) return res.json([]);
  const { data } = await supabase.from('recetas').select('*').in('id', favs.map(f => f.receta_id));
  res.json(data || []);
});

app.get('/api/users/me/history', authMW, async (req, res) => {
  const { data: hist } = await supabase.from('historial').select('receta_id').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(30);
  if (!hist?.length) return res.json([]);
  const { data } = await supabase.from('recetas').select('*').in('id', hist.map(h => h.receta_id));
  res.json(data || []);
});

app.post('/api/users/me/history', authMW, async (req, res) => {
  await supabase.from('historial').upsert({ receta_id: req.body.recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() }, { onConflict: 'receta_id,usuario_id' });
  res.json({ ok: true });
});

app.delete('/api/users/me/history/:recipeId', authMW, async (req, res) => {
  await supabase.from('historial').delete().eq('usuario_id', req.user.id).eq('receta_id', req.params.recipeId);
  res.json({ mensaje: 'Eliminado' });
});

// ── PLAN / SHOPPING ──────────────────────────────────────────
app.get('/api/users/me/planner', authMW, async (req, res) => {
  const { data } = await supabase.from('planes_semanales').select('plan').eq('usuario_id', req.user.id).maybeSingle();
  res.json(data || { plan: {} });
});

app.post('/api/users/me/planner', authMW, async (req, res) => {
  await supabase.from('usuarios').upsert({ usuario_id: req.user.id, plan: req.body.plan, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
  res.json({ ok: true });
});

// ── STATS ──────────────────────────────────────────────────
app.get('/api/users/me/stats', authMW, async (req, res) => {
  try {
    const { count: recipes } = await supabase.from('recetas').select('*', { count: 'exact', head: true }).eq('usuario_id', req.user.id);
    const { count: favorites } = await supabase.from('favoritos').select('*', { count: 'exact', head: true }).eq('usuario_id', req.user.id);
    const { data: likesData } = await supabase.from('recetas').select('likes').eq('usuario_id', req.user.id);
    const likes = likesData?.reduce((acc, r) => acc + (r.likes || 0), 0) || 0;
    
    res.json({ recetas: recipes || 0, favoritos: favorites || 0, visitas: likes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/stats', async (req, res) => {
  try {
    const { count: recipes } = await supabase.from('recetas').select('*', { count: 'exact', head: true }).eq('usuario_id', req.params.id);
    const { data: likesData } = await supabase.from('recetas').select('likes').eq('usuario_id', req.params.id);
    const likes = likesData?.reduce((acc, r) => acc + (r.likes || 0), 0) || 0;
    
    res.json({ recetas: recipes || 0, visitas: likes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CHATBOT IA ──────────────────────────────────────────────
function tokenize(t) { return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\W+/).filter(w => w.length > 2); }
function cosineSimilarity(a, b) {
  const sA = new Set(a), sB = new Set(b), all = new Set([...sA, ...sB]);
  let dot = 0, mA = 0, mB = 0;
  all.forEach(t => { const vA = sA.has(t)?1:0, vB = sB.has(t)?1:0; dot += vA*vB; mA += vA*vA; mB += vB*vB; });
  return mA && mB ? dot / (Math.sqrt(mA)*Math.sqrt(mB)) : 0;
}

function clasificarIntencion(m) {
  const t = m.toLowerCase();
  if (/crea.*plan|armar.*plan|hacer.*plan/i.test(t)) return 'crear_plan';
  if (/familiar|familia|para todos/i.test(t)) return 'plan_familiar';
  if (/dulce|postre|azucar/i.test(t)) return 'dulces';
  if (/[0-9].*minuto|tiempo/i.test(t)) return 'tiempo_especifico';
  if (/presupuesto.*[0-9]|precio.*[0-9]|dinero/i.test(t)) return 'presupuesto_especifico';
  if (/recomienda|sugiere|que (cocin|prepar|hag)|quiero (cocinar|hacer|comer)/i.test(t)) return 'recomendar';
  if (/ingrediente|tengo|con .*(pollo|arroz|huevo|carne|papa|frijol|pasta)/i.test(t)) return 'por_ingrediente';
  if (/barato|economi|poco dinero/i.test(t)) return 'economica';
  if (/rapid|facil|minutos/i.test(t)) return 'rapida';
  if (/saludo|hola|hey/i.test(t)) return 'saludo';
  return 'buscar';
}

app.post('/api/chatbot', authMW, async (req, res) => {
  if (!req.user.es_premium && req.user.rol !== 'premium') return res.status(403).json({ error: 'Chef IA es Premium' });
  const { mensaje } = req.body;
  const int = clasificarIntencion(mensaje);
  
  if (int === 'saludo') return res.json({ respuesta: '¡Hola! Soy tu Chef IA 👨‍🍳. ¿Quieres un plan familiar para el lunes, algo dulce o una comida de $50?', recetas: [] });

  try {
    let query = supabase.from('recetas').select('*');
    if (int === 'economica') query = query.lte('precio_numerico', 40);
    else if (int === 'rapida') query = query.lte('tiempo_numerico', 25);
    else if (int === 'dulces') query = query.ilike('titulo', '%dulce%');
    else if (int === 'plan_familiar') query = query.ilike('titulo', '%familiar%');
    
    const match = mensaje.match(/([0-9]+)/);
    if (match) {
      if (int === 'tiempo_especifico' || int === 'crear_plan') query = query.lte('tiempo_numerico', parseInt(match[1]));
      if (int === 'presupuesto_especifico') query = query.lte('precio_numerico', parseInt(match[1]));
    }

    const { data: results } = await query.limit(30);
    let final = (results || []).sort(() => 0.5 - Math.random()).slice(0, 5);

    let resp = 'Aquí tienes unas opciones:';
    if (int === 'crear_plan' && final.length) {
      const dia = (mensaje.match(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/i) || ['lunes'])[0].toLowerCase();
      const rec = final[0];
      const { data: p } = await supabase.from('planes_semanales').select('plan').eq('usuario_id', req.user.id).maybeSingle();
      const nP = p?.plan || {};
      nP[dia] = { id: rec.id, titulo: rec.titulo, imagen: rec.imagen };
      await supabase.from('planes_semanales').upsert({ usuario_id: req.user.id, plan: nP, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
      resp = `✅ He añadido **${rec.titulo}** a tu plan para el **${dia}**.`;
    }

    res.json({ respuesta: resp, recetas: final.map(r => ({ id: r.id, titulo: r.titulo, imagen: r.imagen, precio: r.precio, tiempo: r.tiempo })) });
  } catch (e) { res.status(500).json({ error: 'Error IA' }); }
});

app.listen(PORT, () => console.log(`ForaneoKitchen en http://localhost:${PORT}`));
