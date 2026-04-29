/**
 * ForaneoKitchen MVP â€” server.js CORREGIDO COMPLETO
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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  if (!d) return res.status(401).json({ error: 'Token invÃ¡lido' });
  const { data } = await supabase.from('usuarios').select('*').eq('id', d.id).maybeSingle();
  if (!data) return res.status(401).json({ error: 'SesiÃ³n invÃ¡lida' });
  if (data.es_premium && data.premium_hasta && new Date(data.premium_hasta) < new Date()) {
    await supabase.from('usuarios').update({ es_premium: false, rol: 'free' }).eq('id', data.id);
    data.es_premium = false; data.rol = 'free';
  }
  req.user = data;
  next();
}

function tienePermiso(u, p) {
  if (!u) return false;
  if (u.es_premium) return true;
  if (!u.preferencias || !Array.isArray(u.preferencias)) return false;
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = u.preferencias.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  if (tag) {
    const expira = new Date(tag.split(':')[1]);
    return expira > new Date();
  }
  return false;
}

async function optAuth(req, res, next) {
  const t = req.headers.authorization?.split(' ')[1];
  if (t) { 
    const d = decodeToken(t); 
    if (d) {
      req.userId = d.id;
      // Opcional: cargar datos del usuario para permisos
      const { data } = await supabase.from('usuarios').select('*').eq('id', d.id).maybeSingle();
      if (data) req.user = data;
    }
  }
  next();
}

function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

async function sendOTP(email, otp, tipo) {
  console.log(`\nðŸ“§ [${tipo.toUpperCase()}] OTP para ${email}`);
  console.log(`ðŸ‘‰ CÃ“DIGO: ${otp}\n`);
  return true;
}

// FIX: otorgarPuntos con try/catch correcto
async function otorgarPuntos(userId, accion, extra = '') {
  const pts = PUNTOS[accion] || 0;
  if (pts === 0) return;
  try {
    await supabase.from('puntos_log').insert({
      usuario_id: userId, accion, puntos: pts,
      descripcion: extra, fecha: new Date().toISOString()
    });
  } catch (e) { console.warn('puntos_log insert warn:', e.message); }

  try {
    // Intentar obtener puntos actuales
    const { data: u } = await supabase.from('usuarios').select('puntos').eq('id', userId).single();
    const nuevosPuntos = (u?.puntos || 0) + pts;
    await supabase.from('usuarios').update({ puntos: nuevosPuntos }).eq('id', userId);
  } catch (e2) { console.warn('puntos update warn:', e2.message); }
}

// ────────────────────────────────────────────────────────────────────────────
//  AUTH - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, esPremium } = req.body;
  if (!nombre || !apellido || !email || !username || !password || !confirmPassword)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Las contraseÃ±as no coinciden' });
  if (password.length < 8)
    return res.status(400).json({ error: 'MÃ­nimo 8 caracteres en la contraseÃ±a' });

  const { data: eu } = await supabase.from('usuarios').select('id').eq('username', username).maybeSingle();
  if (eu) return res.status(400).json({ error: 'El usuario ya existe' });
  const { data: ee } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (ee) return res.status(400).json({ error: 'El email ya estÃ¡ registrado' });

  await supabase.from('otp_tokens').delete().eq('email', email).eq('tipo', 'registro');

  const otp = genOTP();
  const { error: otpError } = await supabase.from('otp_tokens').insert({
    email, otp, tipo: 'registro',
    datos: { nombre, apellido, email, username, password, esPremium: esPremium || false },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    usado: false
  });

  if (otpError) {
    console.error('âŒ Error OTP:', otpError);
    return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
  }

  await sendOTP(email, otp, 'registro');
  res.json({ mensaje: 'CÃ³digo enviado a tu correo', email });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email y cÃ³digo requeridos' });

  const { data: stored } = await supabase
    .from('otp_tokens').select('*')
    .eq('email', email).eq('usado', false)
    .gt('expires_at', new Date().toISOString())
    .order('id', { ascending: false }).limit(1).maybeSingle();

  if (!stored) return res.status(400).json({ error: 'CÃ³digo expirado. Solicita uno nuevo.' });
  if (stored.otp !== otp.toString().trim()) return res.status(400).json({ error: 'CÃ³digo incorrecto' });

  await supabase.from('otp_tokens').update({ usado: true }).eq('id', stored.id);

  if (stored.tipo === 'registro') {
    const { nombre, apellido, username, password, esPremium } = stored.datos;
    const hash = await bcrypt.hash(password, 10);
    const { data: nu, error: insertError } = await supabase.from('usuarios').insert({
      nombre, apellido, email, username,
      password_hash: hash,
      rol: esPremium ? 'premium' : 'free',
      es_premium: esPremium || false,
      puntos: 0, bio: '', foto_perfil: null, preferencias: [],
      fecha_registro: new Date().toISOString()
    }).select().maybeSingle();

    if (insertError) {
      console.error('âŒ Error creando usuario:', insertError);
      return res.status(500).json({ error: 'Error al crear usuario: ' + insertError.message });
    }
    return res.json({ token: makeToken(nu), user: nu });
  }

  if (stored.tipo === 'reset') {
    await supabase.from('otp_tokens').insert({
      email, otp: 'VERIFIED', tipo: 'reset',
      datos: { verified: true }, usado: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    return res.json({ mensaje: 'CÃ³digo verificado.' });
  }

  res.json({ mensaje: 'Verificado' });
});

app.post('/api/auth/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const { data: pending } = await supabase.from('otp_tokens')
    .select('datos, tipo').eq('email', email).eq('tipo', 'registro').eq('usado', false)
    .order('id', { ascending: false }).limit(1).maybeSingle();
  if (!pending) return res.status(400).json({ error: 'No hay registro pendiente para ese email' });
  await supabase.from('otp_tokens').delete().eq('email', email).eq('tipo', 'registro');
  const otp = genOTP();
  await supabase.from('otp_tokens').insert({
    email, otp, tipo: 'registro', datos: pending.datos, usado: false,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });
  await sendOTP(email, otp, 'registro');
  res.json({ mensaje: 'Nuevo cÃ³digo enviado' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseÃ±a requeridos' });

  let { data: u } = await supabase.from('usuarios').select('*').eq('username', username).maybeSingle();
  if (!u) {
    const { data: uByEmail } = await supabase.from('usuarios').select('*').eq('email', username).maybeSingle();
    u = uByEmail;
  }
  if (!u) return res.status(400).json({ error: 'Usuario o contraseÃ±a incorrectos' });

  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(400).json({ error: 'Usuario o contraseÃ±a incorrectos' });

  if (u.es_premium && u.premium_hasta && new Date(u.premium_hasta) < new Date()) {
    await supabase.from('usuarios').update({ es_premium: false, rol: 'free' }).eq('id', u.id);
    u.es_premium = false; u.rol = 'free';
  }

  await supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', u.id);

  console.log(`âœ… Login: ${u.username} (${u.rol})`);
  res.json({
    token: makeToken(u),
    user: { id: u.id, username: u.username, email: u.email, rol: u.rol, esPremium: u.es_premium, puntos: u.puntos || 0 }
  });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const { data } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (!data) return res.status(404).json({ error: 'No hay cuenta con ese email' });
  await supabase.from('otp_tokens').delete().eq('email', email).eq('tipo', 'reset');
  const otp = genOTP();
  await supabase.from('otp_tokens').insert({
    email, otp, tipo: 'reset', datos: {}, usado: false,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });
  await sendOTP(email, otp, 'reset');
  res.json({ mensaje: 'CÃ³digo enviado' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword, confirmNewPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
  if (newPassword !== confirmNewPassword) return res.status(400).json({ error: 'Las contraseÃ±as no coinciden' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'MÃ­nimo 8 caracteres' });
  const { data: v } = await supabase.from('otp_tokens')
    .select('*').eq('email', email).eq('tipo', 'reset').eq('otp', 'VERIFIED').eq('usado', false)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!v) return res.status(400).json({ error: 'Debes verificar el cÃ³digo primero' });
  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('email', email);
  await supabase.from('otp_tokens').update({ usado: true }).eq('id', v.id);
  res.json({ mensaje: 'ContraseÃ±a actualizada' });
});

// ────────────────────────────────────────────────────────────────────────────
//  USUARIO / PERFIL - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/auth/me', authMW, async (req, res) => {
  const u = req.user;
  const [{ count: cr }, { count: cf }, { count: ch }] = await Promise.all([
    supabase.from('recetas').select('id', { count: 'exact', head: true }).eq('autor', u.username),
    supabase.from('favoritos').select('id', { count: 'exact', head: true }).eq('usuario_id', u.id),
    supabase.from('historial').select('id', { count: 'exact', head: true }).eq('usuario_id', u.id)
  ]);
  res.json({
    id: u.id, nombre: u.nombre, apellido: u.apellido,
    email: u.email, username: u.username,
    rol: u.rol, es_premium: u.es_premium,
    premium_hasta: u.premium_hasta,
    puntos: u.puntos || 0,
    bio: u.bio || '', foto_perfil: u.foto_perfil,
    preferencias: u.preferencias || [],
    fecha_registro: u.fecha_registro,
    stats: { recetas: cr || 0, favoritos: cf || 0, historial: ch || 0 }
  });
});

// Actualizar perfil (nombre, apellido, bio, preferencias, avatar)
app.put('/api/auth/me', authMW, async (req, res) => {
  const { nombre, apellido, bio, preferencias, foto_perfil } = req.body;
  const upd = {};
  if (nombre !== undefined) upd.nombre = nombre;
  if (apellido !== undefined) upd.apellido = apellido;
  if (bio !== undefined) upd.bio = bio;
  if (preferencias !== undefined) upd.preferencias = preferencias;
  if (foto_perfil !== undefined) upd.foto_perfil = foto_perfil;

  const { error } = await supabase.from('usuarios').update(upd).eq('id', req.user.id);
  if (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
  res.json({ mensaje: 'Perfil actualizado' });
});

// Subir avatar (base64)
app.post('/api/auth/avatar', authMW, async (req, res) => {
  const { avatarBase64 } = req.body;
  if (!avatarBase64) return res.status(400).json({ error: 'Imagen requerida' });
  const { error } = await supabase.from('usuarios').update({ foto_perfil: avatarBase64 }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: 'Error al actualizar avatar' });
  res.json({ avatarUrl: avatarBase64 });
});

app.get('/api/users/:username', optAuth, async (req, res) => {
  const { data: u } = await supabase.from('usuarios')
    .select('id,username,nombre,apellido,rol,es_premium,bio,foto_perfil,puntos,fecha_registro')
    .eq('username', req.params.username).maybeSingle();
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { data: recetas } = await supabase.from('recetas')
    .select('id,titulo,imagen,likes,es_premium,fecha')
    .eq('autor', u.username).order('fecha', { ascending: false });
  const totalLikes = (recetas || []).reduce((s, r) => s + (r.likes || 0), 0);
  res.json({ ...u, recetas: recetas || [], totalLikes });
});

// ────────────────────────────────────────────────────────────────────────────
//  PUNTOS Y CANJE PREMIUM - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/users/me/activity', authMW, async (req, res) => {
  try {
    const [likes, favorites, comments, recipes, points] = await Promise.all([
      supabase.from('likes').select('*, receta:receta_id(titulo)').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('favoritos').select('*, receta:receta_id(titulo)').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('comentarios').select('*, receta:receta_id(titulo)').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('recetas').select('*').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('puntos_log').select('*').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(10)
    ]);

    const activity = [
      ...(likes.data || []).map(l => ({ tipo: 'like', fecha: l.fecha, texto: `Diste like a "${l.receta?.titulo || 'Receta'}"`, id: l.receta_id })),
      ...(favorites.data || []).map(f => ({ tipo: 'favorito', fecha: f.fecha, texto: `Añadiste "${f.receta?.titulo || 'Receta'}" a favoritos`, id: f.receta_id })),
      ...(comments.data || []).map(c => ({ tipo: 'comentario', fecha: c.fecha, texto: `Comentaste en "${c.receta?.titulo || 'Receta'}": "${c.texto.substring(0, 30)}..."`, id: c.receta_id })),
      ...(recipes.data || []).map(r => ({ tipo: 'receta', fecha: r.fecha, texto: `Publicaste la receta "${r.titulo}"`, id: r.id })),
      ...(points.data || []).filter(p => p.puntos !== 0).map(p => ({ tipo: 'punto', fecha: p.fecha, texto: `${p.puntos > 0 ? 'Ganaste' : 'Canjeaste'} ${Math.abs(p.puntos)} puntos: ${p.descripcion}` }))
    ];

    activity.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(activity.slice(0, 30));
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Error al cargar actividad' });
  }
});

app.get('/api/users/me/puntos', authMW, async (req, res) => {
  const { data: logs } = await supabase.from('puntos_log')
    .select('*').eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(20);
  res.json({ puntos: req.user.puntos || 0, historial: logs || [] });
});

app.post('/api/users/me/canjear-premium', authMW, async (req, res) => {
  const { dias } = req.body;
  const costos = { 7: COSTO_PREMIUM_7D, 30: COSTO_PREMIUM_30D, 90: COSTO_PREMIUM_90D };
  const costo = costos[dias];
  if (!costo) return res.status(400).json({ error: 'OpciÃ³n invÃ¡lida. Elige 7, 30 o 90 dÃ­as.' });
  const puntosActuales = req.user.puntos || 0;
  if (puntosActuales < costo)
    return res.status(400).json({ error: `Necesitas ${costo} puntos. Tienes ${puntosActuales}.` });
  const hasta = new Date();
  if (req.user.es_premium && req.user.premium_hasta && new Date(req.user.premium_hasta) > hasta)
    hasta.setTime(new Date(req.user.premium_hasta).getTime());
  hasta.setDate(hasta.getDate() + dias);
  await supabase.from('usuarios').update({
    puntos: puntosActuales - costo, es_premium: true, rol: 'premium',
    premium_hasta: hasta.toISOString()
  }).eq('id', req.user.id);
  await supabase.from('puntos_log').insert({
    usuario_id: req.user.id, accion: 'canjear',
    puntos: -costo, descripcion: `${dias} dÃ­as Premium`,
    fecha: new Date().toISOString()
  });
  res.json({ mensaje: `âœ… Â¡${dias} dÃ­as Premium activados!`, premiumHasta: hasta, puntosRestantes: puntosActuales - costo });
});

// ────────────────────────────────────────────────────────────────────────────
//  RECETAS - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/recipes', optAuth, async (req, res) => {
try {
  const { q, tag, sort, maxPrecio, maxTiempo, preferencias, orden, ignorePrefs } = req.query;
  let query = supabase.from('recetas').select('*');

  if (q) query = query.or(`titulo.ilike.%${q}%,ingredientes.ilike.%${q}%`);
  if (tag) query = query.contains('etiquetas', [tag]);

  if (sort === 'popular' || orden === 'likes') {
    query = query.order('likes', { ascending: false });
  } else {
    query = query.order('fecha', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  let recetasFinales = data || [];

  // Algoritmo de recomendación y Filtrado Estricto
  if (preferencias && recetasFinales.length > 0 && ignorePrefs !== 'true') {
    const tags = (typeof preferencias === 'string' ? preferencias : Array.isArray(preferencias) ? preferencias.join(',') : '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    
    if (tags.length > 0) {
      // Filtrado estricto: si el usuario tiene preferencias, solo mostrar lo que coincida
      recetasFinales = recetasFinales.filter(r => {
        const titulo = (r.titulo || '').toLowerCase();
        const ingredientes = (r.ingredientes || '').toLowerCase();
        const etiquetas = Array.isArray(r.etiquetas) ? r.etiquetas.map(e => e.toLowerCase()) : [];
        
        let match = false;
        let score = 0;
        
        tags.forEach(tag => {
          const hasTag = etiquetas.includes(tag) || titulo.includes(tag) || ingredientes.includes(tag);
          if (hasTag) {
            match = true;
            if (etiquetas.includes(tag)) score += 10;
            else if (titulo.includes(tag)) score += 5;
            else score += 2;
          }
        });
        
        r._score = score;
        return match;
      });

      // Si no quedó nada tras el filtro estricto, podrías querer mostrar todo o nada.
      // El usuario pidió "solo deben mostrarse esas", así que lo dejamos así.
      
      if (!sort && !orden) {
        recetasFinales.sort((a, b) => (b._score || 0) - (a._score || 0));
      }
    }
  }

  let likesSet = new Set(), favsSet = new Set();
  if (req.userId) {
    const [{ data: lks }, { data: fvs }] = await Promise.all([
      supabase.from('likes').select('receta_id').eq('usuario_id', req.userId),
      supabase.from('favoritos').select('receta_id').eq('usuario_id', req.userId)
    ]);
    (lks || []).forEach(l => likesSet.add(l.receta_id));
    (fvs || []).forEach(f => favsSet.add(f.receta_id));
  }

  const recetas = recetasFinales.map(r => ({
    id: r.id,
    titulo: r.titulo,
    ingredientes: r.ingredientes,
    precio: r.precio,
    precio_numerico: r.precio_numerico,
    tiempo: r.tiempo,
    tiempo_numerico: r.tiempo_numerico,
    imagen: r.imagen,
    video_url: r.video_url,
    video_youtube: r.video_youtube,
    es_premium: r.es_premium,
    etiquetas: r.etiquetas || [],
    likes: r.likes || 0,
    autor: r.autor || 'Anónimo',
    usuario_id: r.usuario_id,
    usuario: { id: r.usuario_id, username: r.autor || 'Anónimo' },
    fecha: r.fecha,
    usuarioLike: likesSet.has(r.id),
    esFavorito: favsSet.has(r.id)
  }));

  res.json(recetas);
} catch (err) {
  console.error('API Error /recipes:', err);
  res.status(500).json({ error: 'Error al cargar recetas' });
}
});


app.get('/api/recipes/:id', optAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invÃ¡lido' });

  const { data: r, error } = await supabase.from('recetas').select('*').eq('id', id).maybeSingle();
  if (error || !r) return res.status(404).json({ error: 'Receta no encontrada' });

  // Control de acceso para recetas Premium
  const esPremiumUser = req.user?.es_premium || req.user?.rol === 'premium';
  if (r.es_premium && !esPremiumUser) {
    return res.status(403).json({
      error: 'Esta receta es exclusiva para usuarios Premium 👑',
      isPremiumFeature: true,
      receta: {
        id: r.id,
        titulo: r.titulo,
        imagen: r.imagen,
        es_premium: true,
        autor: r.autor || 'Anónimo'
      }
    });
  }

  let liked = false, favorito = false;
  if (req.userId) {
    const [{ data: lk }, { data: fv }] = await Promise.all([
      supabase.from('likes').select('id').eq('receta_id', id).eq('usuario_id', req.userId).maybeSingle(),
      supabase.from('favoritos').select('id').eq('receta_id', id).eq('usuario_id', req.userId).maybeSingle()
    ]);
    liked = !!lk; favorito = !!fv;

    // Registrar vista
    await otorgarPuntos(req.userId, 'ver_receta', `Vista receta ${id}`);
  }

  // Obtener rol del autor
  let autorRol = 'free';
  if (r.usuario_id) {
    const { data: userData } = await supabase.from('usuarios').select('rol').eq('id', r.usuario_id).maybeSingle();
    autorRol = userData?.rol || 'free';
  }

  res.json({
    ...r,
    autor: r.autor || 'AnÃ³nimo',
    autorRol: autorRol,
    usuarioLike: liked,
    esFavorito: favorito
  });
});

// FIX: POST receta sin usuario_id (evita error UUID)
app.post('/api/recipes', authMW, async (req, res) => {
  const {
    titulo, ingredientes, pasos, precio, precioNumerico,
    tiempo, tiempoNumerico, imagen, videoUrl, videoYoutube,
    esPremium, etiquetas
  } = req.body;

  if (!titulo || !ingredientes || !pasos)
    return res.status(400).json({ error: 'TÃ­tulo, ingredientes y pasos son obligatorios' });

  // Construir objeto sin usuario_id (columna UUID incompatible)
  const recetaData = {
    titulo: titulo.trim(),
    ingredientes: ingredientes.trim(),
    pasos: pasos.trim(),
    precio: precio || '',
    precio_numerico: parseFloat(String(precio).replace(/[^0-9.]/g, '')) || precioNumerico || 0,
    tiempo: tiempo || '',
    tiempo_numerico: parseInt(String(tiempo).replace(/[^0-9]/g, '')) || tiempoNumerico || 0,
    imagen: imagen || null,
    video_url: videoUrl || null,
    video_youtube: videoYoutube || null,
    es_premium: esPremium || false,
    etiquetas: etiquetas || [],
    autor: req.user.username,
    usuario_id: req.user.id,
    likes: 0,
    fecha: new Date().toISOString()
  };

  const { data, error } = await supabase.from('recetas').insert(recetaData).select().maybeSingle();
  if (error) {
    console.error('Error inserting recipe:', error);
    return res.status(500).json({ error: 'Error al crear receta: ' + error.message });
  }

  const puntosAOtorgar = esPremium ? 30 : 20;
  await otorgarPuntos(req.user.id, 'subir_receta', `Publicaste una receta ${esPremium ? 'Premium' : 'Normal'}: ${titulo}`);

  // Bono primera receta
  const { count } = await supabase.from('recetas').select('id', { count: 'exact', head: true }).eq('autor', req.user.username);
  if (count === 1) {
    try {
      const { data: pu } = await supabase.from('usuarios').select('puntos').eq('id', req.user.id).single();
      await supabase.from('usuarios').update({ puntos: (pu?.puntos || 0) + 50 }).eq('id', req.user.id);
      await supabase.from('puntos_log').insert({
        usuario_id: req.user.id, accion: 'bono_primera_receta', puntos: 50,
        descripcion: 'ðŸŽ‰ Â¡Primera receta publicada!', fecha: new Date().toISOString()
      });
    } catch (e) { console.warn('bono primera receta warn:', e.message); }
  }

  res.json(data);
});

app.delete('/api/recipes/:id', authMW, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data: r } = await supabase.from('recetas').select('autor').eq('id', id).maybeSingle();
  if (!r) return res.status(404).json({ error: 'No encontrada' });
  if (r.autor !== req.user.username) return res.status(403).json({ error: 'Sin permiso' });
  await supabase.from('recetas').delete().eq('id', id);
  res.json({ mensaje: 'Receta eliminada' });
});

// ────────────────────────────────────────────────────────────────────────────
//  LIKES - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.post('/api/recipes/:id/like', authMW, async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const { data: ex } = await supabase.from('likes')
    .select('id').eq('receta_id', recipeId).eq('usuario_id', req.user.id).maybeSingle();
  if (ex) return res.status(400).json({ error: 'Ya diste like' });

  await supabase.from('likes').insert({ receta_id: recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() });

  const { data: r } = await supabase.from('recetas').select('likes,autor').eq('id', recipeId).single();
  const newLikes = (r?.likes || 0) + 1;
  await supabase.from('recetas').update({ likes: newLikes }).eq('id', recipeId);

  await otorgarPuntos(req.user.id, 'like', `Like a receta ${recipeId}`);

  // Dar puntos al autor de la receta
  if (r?.autor && r.autor !== req.user.username) {
    const { data: autorUser } = await supabase.from('usuarios').select('id').eq('username', r.autor).maybeSingle();
    if (autorUser) {
      await otorgarPuntos(autorUser.id, 'ser_likeado', `Like recibido receta ${recipeId}`);
      // NotificaciÃ³n
      await supabase.from('notificaciones').insert({
        usuario_id: autorUser.id,
        tipo: 'like_recibido',
        leida: false,
        mensaje: `@${req.user.username} le dio â¤ï¸ a tu receta: ${r.titulo}`,
        metadata: { receta_id: recipeId }
      });
    }
  }

  res.json({ likes: newLikes });
});

app.delete('/api/recipes/:id/like', authMW, async (req, res) => {
  const recipeId = parseInt(req.params.id);
  await supabase.from('likes').delete().eq('receta_id', recipeId).eq('usuario_id', req.user.id);
  const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
  const newLikes = Math.max((r?.likes || 1) - 1, 0);
  await supabase.from('recetas').update({ likes: newLikes }).eq('id', recipeId);
  res.json({ likes: newLikes });
});

// ────────────────────────────────────────────────────────────────────────────
//  COMENTARIOS - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/recipes/:id/comments', async (req, res) => {
  const { data } = await supabase.from('comentarios')
    .select('*')
    .eq('receta_id', parseInt(req.params.id))
    .order('fecha', { ascending: true });

  // Enriquecer con info del usuario
  const enriched = await Promise.all((data || []).map(async c => {
    const { data: u } = await supabase.from('usuarios')
      .select('id,username,foto_perfil,rol').eq('id', c.usuario_id).maybeSingle();
    return { ...c, usuario: u || { id: c.usuario_id, username: 'Usuario', foto_perfil: null, rol: 'free' } };
  }));

  res.json(enriched);
});

app.post('/api/recipes/:id/comments', authMW, async (req, res) => {
  const { texto, padre_id } = req.body;
  
  // Lógica de permisos: Free puede comentar, Premium puede comentar y responder
  if (padre_id && !req.user.es_premium && req.user.rol !== 'premium') {
    return res.status(403).json({ error: 'Solo usuarios Premium pueden responder comentarios.' });
  }

  if (!texto?.trim()) return res.status(400).json({ error: 'Comentario vacío' });
  if (texto.length > 500) return res.status(400).json({ error: 'Máximo 500 caracteres' });

  const { data, error } = await supabase.from('comentarios').insert({
    receta_id: parseInt(req.params.id),
    usuario_id: req.user.id,
    texto: texto.trim(),
    padre_id: padre_id || null,
    fecha: new Date().toISOString()
  }).select().maybeSingle();

  if (error) { console.error('comentario error:', error); return res.status(500).json({ error: 'Error al publicar comentario' }); }

  await otorgarPuntos(req.user.id, 'comentar', `Comentario en receta ${req.params.id}`);

  // NotificaciÃ³n para el autor del comentario original si es respuesta
  if (padre_id) {
    try {
      const { data: padre } = await supabase.from('comentarios').select('usuario_id').eq('id', padre_id).single();
      if (padre && padre.usuario_id !== req.user.id) {
        await supabase.from('notificaciones').insert({
          usuario_id: padre.usuario_id,
          tipo: 'respuesta_comentario',
          leida: false,
          mensaje: `@${req.user.username} respondiÃ³ a tu comentario`,
          metadata: { receta_id: req.params.id, comentario_id: data.id }
        });
      }
    } catch (e) { console.warn('Notif error:', e); }
  }

  // NotificaciÃ³n para el autor de la receta
  try {
    const { data: receta } = await supabase.from('recetas').select('usuario_id,titulo').eq('id', req.params.id).single();
    if (receta && receta.usuario_id && receta.usuario_id !== req.user.id) {
      await supabase.from('notificaciones').insert({
        usuario_id: receta.usuario_id,
        tipo: 'nuevo_comentario',
        leida: false,
        mensaje: `@${req.user.username} comentÃ³ en tu receta: ${receta.titulo}`,
        metadata: { receta_id: req.params.id, comentario_id: data.id }
      });
    }
  } catch (e) { console.warn('Notif error receta:', e); }

  res.json({ ...data, usuario: { id: req.user.id, username: req.user.username, foto_perfil: req.user.foto_perfil, rol: req.user.rol } });
});

app.delete('/api/comments/:id', authMW, async (req, res) => {
  const { data } = await supabase.from('comentarios').select('usuario_id, texto').eq('id', req.params.id).maybeSingle();
  if (!data) return res.status(404).json({ error: 'No encontrado' });
  if (data.usuario_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });
  
  // En lugar de borrar la fila (que rompería el hilo de respuestas), 
  // actualizamos el texto a "eliminado"
  await supabase.from('comentarios').update({ texto: '🚫 [Comentario eliminado]' }).eq('id', req.params.id);
  res.json({ mensaje: 'Eliminado', eliminado: true });
});

// ────────────────────────────────────────────────────────────────────────────
//  FAVORITOS - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

// FIX: Favoritos con dos queries separadas (mÃ¡s confiable que join)
app.get('/api/users/me/favorites', authMW, async (req, res) => {
  const { data: favs } = await supabase.from('favoritos')
    .select('receta_id')
    .eq('usuario_id', req.user.id)
    .order('fecha', { ascending: false });

  if (!favs || !favs.length) return res.json([]);

  const ids = favs.map(f => f.receta_id).filter(Boolean);
  if (!ids.length) return res.json([]);

  const { data: recetas } = await supabase.from('recetas')
    .select('id,titulo,imagen,likes,precio,tiempo,es_premium,autor,fecha')
    .in('id', ids);

  // Preservar orden de favoritos
  const map = {};
  (recetas || []).forEach(r => { map[r.id] = r; });
  res.json(ids.map(id => map[id]).filter(Boolean));
});

app.get('/api/users/me/favorites/:recipeId', authMW, async (req, res) => {
  const { data } = await supabase.from('favoritos')
    .select('id').eq('receta_id', parseInt(req.params.recipeId)).eq('usuario_id', req.user.id).maybeSingle();
  res.json({ favorito: !!data });
});

app.post('/api/users/me/favorites/:recipeId', authMW, async (req, res) => {
  const rId = parseInt(req.params.recipeId);
  const { data: ex } = await supabase.from('favoritos')
    .select('id').eq('receta_id', rId).eq('usuario_id', req.user.id).maybeSingle();
  if (ex) return res.status(400).json({ error: 'Ya en favoritos' });
  await supabase.from('favoritos').insert({ receta_id: rId, usuario_id: req.user.id, fecha: new Date().toISOString() });
  await otorgarPuntos(req.user.id, 'favorito', `Favorito receta ${rId}`);
  res.json({ mensaje: 'Agregado a favoritos' });
});

app.delete('/api/users/me/favorites/:recipeId', authMW, async (req, res) => {
  await supabase.from('favoritos')
    .delete().eq('receta_id', parseInt(req.params.recipeId)).eq('usuario_id', req.user.id);
  res.json({ mensaje: 'Eliminado de favoritos' });
});

// ────────────────────────────────────────────────────────────────────────────
//  HISTORIAL (solo Premium) - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/users/me/history', authMW, async (req, res) => {
  if (!tienePermiso(req.user, 'historial'))
    return res.status(403).json({ error: 'El historial es exclusivo para usuarios Premium o con permiso temporal', isPremiumFeature: true });

  const { data: hist } = await supabase.from('historial')
    .select('receta_id, fecha').eq('usuario_id', req.user.id)
    .order('fecha', { ascending: false }).limit(30);

  if (!hist || !hist.length) return res.json([]);

  const ids = hist.map(h => h.receta_id).filter(Boolean);
  const { data: recetas } = await supabase.from('recetas')
    .select('id,titulo,imagen,likes,precio,tiempo,fecha').in('id', ids);

  const map = {};
  (recetas || []).forEach(r => { map[r.id] = r; });
  res.json(ids.map(id => map[id]).filter(Boolean));
});

app.post('/api/users/me/history', authMW, async (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' });

  await otorgarPuntos(req.user.id, 'ver_receta', `Vista receta ${recipeId}`);

  if (!tienePermiso(req.user, 'historial')) return res.json({ mensaje: 'OK (no Premium/Permiso)' });

  const { data: ex } = await supabase.from('historial')
    .select('id').eq('receta_id', recipeId).eq('usuario_id', req.user.id).maybeSingle();
  if (ex) {
    await supabase.from('historial').update({ fecha: new Date().toISOString() }).eq('id', ex.id);
  } else {
    await supabase.from('historial').insert({ receta_id: recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() });
  }
  res.json({ mensaje: 'OK' });
});

// ────────────────────────────────────────────────────────────────────────────
//  RECETAS DEL USUARIO - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

// FIX: Usar autor (text) en vez de usuario_id (UUID incompatible)
app.get('/api/users/me/recipes', authMW, async (req, res) => {
  const { data } = await supabase.from('recetas')
    .select('*').eq('autor', req.user.username).order('fecha', { ascending: false });
  res.json(data || []);
});

app.get('/api/users/me/notifications', authMW, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', req.userId)
      .eq('leida', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar notificaciones' });
  }
});

// Endpoint duplicado de historial eliminado (el correcto está en la sección de HISTORIAL arriba)

// Planificador semanal
app.get('/api/users/me/planner', authMW, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('planes_semanales')
      .select('*')
      .eq('usuario_id', req.user.id)
      .maybeSingle();
      
    if (error) throw error;
    res.json(data || { plan: null });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar planificador' });
  }
});

app.post('/api/users/me/planner', authMW, async (req, res) => {
  try {
    const { plan } = req.body;
    const { error } = await supabase
      .from('planes_semanales')
      .upsert({
        usuario_id: req.user.id,
        plan: plan,
        updated_at: new Date().toISOString()
      }, { onConflict: 'usuario_id' });
      
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar planificador' });
  }
});

// Puntos del usuario
app.get('/api/users/me/points', authMW, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('puntos')
      .eq('id', req.userId)
      .maybeSingle();

    if (error) throw error;
    res.json({ puntos: data?.puntos || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar puntos' });
  }
});

app.post('/api/users/me/notifications/read', authMW, async (req, res) => {
  await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', req.user.id);
  res.json({ mensaje: 'Notificaciones leÃ­das' });
});

app.get('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('usuarios')
    .select('id, username, nombre, apellido, bio, foto_perfil, rol, es_premium, puntos, fecha_registro')
    .eq('id', id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

app.get('/api/users/:id/recipes', async (req, res) => {
  const { id } = req.params;
  const { data: user } = await supabase.from('usuarios').select('username').eq('id', id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { data } = await supabase.from('recetas')
    .select('*').eq('autor', user.username).order('fecha', { ascending: false });
  res.json(data || []);
});

app.get('/api/users/me/activity', authMW, async (req, res) => {
  const { data } = await supabase.from('puntos_log')
    .select('*')
    .eq('usuario_id', req.user.id)
    .order('fecha', { ascending: false })
    .limit(50);
  res.json(data || []);
});

// ────────────────────────────────────────────────────────────────────────────
//  ACTIVIDAD RECIENTE (para comunidad) - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/activity', async (req, res) => {
  // Comentarios recientes de todos los usuarios
  const { data: comentarios } = await supabase.from('comentarios')
    .select('id, texto, fecha, receta_id, usuario_id')
    .order('fecha', { ascending: false }).limit(30);

  if (!comentarios || !comentarios.length) return res.json([]);

  // Enriquecer con datos de usuario y receta
  const userIds = [...new Set(comentarios.map(c => c.usuario_id))];
  const recetaIds = [...new Set(comentarios.map(c => c.receta_id))];

  const [{ data: users }, { data: recetas }] = await Promise.all([
    supabase.from('usuarios').select('id,username,foto_perfil,es_premium').in('id', userIds),
    supabase.from('recetas').select('id,titulo').in('id', recetaIds)
  ]);

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  const recetaMap = {};
  (recetas || []).forEach(r => { recetaMap[r.id] = r; });

  const enriched = comentarios.map(c => ({
    ...c,
    usuario: userMap[c.usuario_id] || { username: 'Usuario', foto_perfil: null, es_premium: false },
    receta: recetaMap[c.receta_id] || { titulo: 'Receta eliminada' }
  }));

  res.json(enriched);
});

// ────────────────────────────────────────────────────────────────────────────
//  PLAN SEMANAL Y LISTA DE COMPRAS - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

// Eliminados endpoints duplicados de /api/users/me/plan

// LISTA DE COMPRAS
app.get('/api/users/me/shopping-list', authMW, async (req, res) => {
  try {
    const { data, error } = await supabase.from('lista_compras')
      .select('items')
      .eq('usuario_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data?.items || []);
  } catch (err) {
    console.error('Error shopping list:', err);
    res.status(500).json({ error: 'Error al obtener lista de compras' });
  }
});

app.post('/api/users/me/shopping-list', authMW, async (req, res) => {
  const { items } = req.body;
  try {
    const { error } = await supabase.from('lista_compras')
      .upsert({
        usuario_id: req.user.id,
        items: items || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'usuario_id' });
    if (error) throw error;
    res.json({ mensaje: 'Lista de compras guardada' });
  } catch (err) {
    console.error('Error saving shopping list:', err);
    res.status(500).json({ error: 'Error al guardar lista de compras' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  SERVIDOR - Formatear para que el frontend lo lea fácil
// ────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nðŸ³ ForaneoKitchen corriendo â†’ http://localhost:${PORT}`);
  console.log(`   Roles: Free y Premium activos`);
  console.log(`   Sistema de puntos: ${Object.entries(PUNTOS).map(([k, v]) => `${k}=+${v}pts`).join(' | ')}\n`);
});
