'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gikqmtsrhgdxzxvjxcbd.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const PUNTOS = {
  ver_receta: 2,
  like: 3,
  comentar: 5,
  subir_receta: 20,
  ser_likeado: 5,
  favorito: 2
};

app.use(express.json({ limit: '20mb' }));
app.use(cors());

// Corrige texto con doble codificación UTF-8
function fixMojibake(s) {
  if (typeof s !== 'string') return s;
  try {
    if (s.includes('\u00c3') || s.includes('\u00f0')) {
      const buf = Buffer.from(s, 'latin1');
      const fixed = buf.toString('utf8');
      if (fixed !== s && !fixed.includes('\uFFFD')) return fixed;
    }
  } catch (e) { }
  return s;
}

// Oculta el correo del autor
function censor(s) {
  if (!s) return 'Usuario';
  if (!s.includes('@')) return s;
  const name = s.split('@')[0];
  if (name.length <= 2) return name + '...';
  return name[0] + '.....' + name[name.length - 1];
}

// Sistema de Validación de Contenido
const PROFANITY_LIST = ['puto', 'puta', 'mierda', 'pendejo', 'pendeja', 'culero', 'cabron', 'chinga', 'verga', 'pito', 'fuck', 'shit', 'asshole', 'idiota', 'estupido'];

const VALIDACION = {
  isOffensive: (str) => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return PROFANITY_LIST.some(word => lower.includes(word));
  },
  isGibberish: (str) => {
    if (!str || str.length < 4) return false;
    // Chequeo de consonantes repetidas (> 4 seguidas)
    if (/[bcdfghjklmnpqrstvwxyzñ]{5,}/i.test(str)) return true;
    // Falta de vocales en cadenas largas
    if (str.length > 10 && !/[aeiouáéíóúü]/i.test(str)) return true;
    // Caracteres repetidos (aaaaa...)
    if (/(.)\1{4,}/.test(str)) return true;
    return false;
  },
  isInvalid: (str) => VALIDACION.isOffensive(str) || VALIDACION.isGibberish(str),
  passwordStrength: (pass) => {
    return pass.length >= 8 && /[a-zA-Z]/.test(pass) && /[0-9]/.test(pass);
  },
  // Validaciones de Receta
  isRecipeTitleValid: (t) => {
    if (!t || t.length < 5) return false;
    if (VALIDACION.isInvalid(t)) return false;
    return /[aeiouáéíóúü]/i.test(t);
  },
  areIngredientsValid: (i) => {
    if (!i || i.length < 10) return false;
    if (VALIDACION.isInvalid(i)) return false;
    // Buscar números o unidades comunes
    const units = /gramos|kg|ml|litro|taza|pieza|cucharada|pisca|sobre|diente|cebolla|sal|pimienta|aceite|agua|leche|huevo|harina|azúcar/i;
    return /[0-9]/.test(i) || units.test(i);
  },
  areStepsValid: (s) => {
    if (!s || s.length < 20) return false;
    if (VALIDACION.isInvalid(s)) return false;
    // Buscar verbos de cocina o pasos numerados
    const verbs = /mezclar|cocinar|picar|hervir|freir|hornear|servir|agregar|calentar|cortar|limpiar|batir|asar/i;
    return verbs.test(s) || /[0-9]\.?\s/.test(s) || s.includes('\n');
  }
};

function deepFixEncoding(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') return fixMojibake(obj);
  if (Array.isArray(obj)) return obj.map(deepFixEncoding);
  if (typeof obj === 'object') {
    const fixed = {};
    for (const key in obj) {
      fixed[key] = deepFixEncoding(obj[key]);
    }
    return fixed;
  }
  return obj;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/login.html'));


// Helpers
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

async function checkPremiumExpiration(user) {
  if (user && user.es_premium && user.premium_hasta && new Date(user.premium_hasta) < new Date()) {
    await supabase.from('usuarios').update({ es_premium: false, rol: 'free' }).eq('id', user.id);
    user.es_premium = false;
    user.rol = 'free';
    return true;
  }
  return false;
}

async function authMW(req, res, next) {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'No autorizado' });
  const d = decodeToken(t);
  if (!d) return res.status(401).json({ error: 'Token inválido' });

  const { data } = await supabase.from('usuarios').select('*').eq('id', d.id).maybeSingle();
  if (!data) return res.status(401).json({ error: 'Sesión inválida' });

  await checkPremiumExpiration(data);
  req.user = data;
  next();
}

async function optAuth(req, res, next) {
  try {
    const t = req.headers.authorization?.split(' ')[1];
    if (t) {
      const d = decodeToken(t);
      if (d?.id) {
        req.userId = d.id;
        const { data } = await supabase
          .from('usuarios')
          .select('id, rol, es_premium, premium_hasta, preferencias')
          .eq('id', d.id)
          .maybeSingle();
        if (data) {
          await checkPremiumExpiration(data);
          req.user = data;
        }
      }
    }
  } catch (e) { console.error('optAuth Error:', e); }
  next();
}

function tienePermiso(u, p) {
  if (!u) return false;
  if (u.es_premium === true || u.rol === 'admin' || u.rol === 'premium') return true;
  const prefs = Array.isArray(u.preferencias) ? u.preferencias : [];
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = prefs.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  if (tag) {
    const parts = tag.split(':');
    if (parts.length < 2) return false;
    const exp = parts[1];
    // Ya no se permiten accesos PERMANENT. Siempre debe haber una fecha válida.
    if (exp === 'PERMANENT') return false; 
    return new Date(exp) > new Date();
  }
  return false;
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
      usuario_id: userId, accion, puntos: pts,
      descripcion: extra, fecha: new Date().toISOString()
    });
    const { data: u } = await supabase.from('usuarios').select('puntos').eq('id', userId).single();
    await supabase.from('usuarios').update({ puntos: (u?.puntos || 0) + pts }).eq('id', userId);
  } catch (e) { console.warn('Puntos warn:', e.message); }
}

// AUTH
app.post('/api/auth/registro', async (req, res) => {
  const { nombre, apellido, email, username, password, confirmPassword, esPremium } = req.body;
  if (!nombre || !apellido || !email || !username || !password || !confirmPassword)
    return res.status(400).json({ error: 'Faltan campos' });

  if (VALIDACION.isInvalid(nombre) || VALIDACION.isInvalid(apellido) || VALIDACION.isInvalid(username)) {
    return res.status(400).json({ error: 'El nombre, apellido o usuario contiene palabras no permitidas o parece incoherente' });
  }

  if (!VALIDACION.passwordStrength(password)) {
    return res.status(400).json({ error: 'La contraseña debe ser más segura: mínimo 8 caracteres, letras y números' });
  }

  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
  if (!nameRegex.test(nombre)) return res.status(400).json({ error: 'Nombre inválido (solo letras)' });
  if (!nameRegex.test(apellido)) return res.status(400).json({ error: 'Apellido inválido (solo letras)' });

  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Contraseñas no coinciden' });

  const { data: eu } = await supabase.from('usuarios').select('id').eq('username', username).maybeSingle();
  if (eu) return res.status(400).json({ error: 'Nombre de usuario ya existe' });

  const otp = genOTP();
  await supabase.from('otp_tokens').insert({
    email, otp, tipo: 'registro',
    datos: { nombre, apellido, email, username, password, esPremium },
    expires_at: new Date(Date.now() + 600000).toISOString(),
    usado: false
  });
  await sendOTP(email, otp, 'registro');
  res.json({ mensaje: 'Código enviado', email });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const { data: stored } = await supabase
    .from('otp_tokens').select('*')
    .eq('email', email).eq('usado', false)
    .gt('expires_at', new Date().toISOString())
    .order('id', { ascending: false }).limit(1).maybeSingle();

  if (!stored || stored.otp !== otp.toString().trim())
    return res.status(400).json({ error: 'Código inválido o expirado' });

  await supabase.from('otp_tokens').update({ usado: true }).eq('id', stored.id);

  if (stored.tipo === 'registro') {
    const { nombre, apellido, username, password, esPremium } = stored.datos;
    const hash = await bcrypt.hash(password, 10);
    let premiumHasta = null;
    if (esPremium) {
      const d = new Date(); d.setMonth(d.getMonth() + 1); premiumHasta = d.toISOString();
    }
    const { data: nu, error: insertError } = await supabase.from('usuarios').insert({
      nombre, apellido, email, username,
      password_hash: hash,
      rol: esPremium ? 'premium' : 'free',
      es_premium: esPremium || false,
      premium_hasta: premiumHasta,
      puntos: 0,
      fecha_registro: new Date().toISOString()
    }).select().maybeSingle();

    if (insertError) {
      console.error('❌ Error al registrar usuario:', insertError);
      return res.status(500).json({ error: 'Error interno al registrar el usuario' });
    }
    return res.json({ token: makeToken(nu), user: nu });
  }
  res.json({ mensaje: 'Verificado' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  let { data: u } = await supabase.from('usuarios').select('*').eq('username', username).maybeSingle();
  if (!u) {
    const { data } = await supabase.from('usuarios').select('*').eq('email', username).maybeSingle();
    u = data;
  }
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(400).json({ error: 'Credenciales inválidas' });

  await supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', u.id);
  res.json({ token: makeToken(u), user: u });
});

// ── SUSCRIPCIÓN — con guardia anti doble pago ─────────────────────────────────
app.post('/api/auth/subscribe', authMW, async (req, res) => {
  const { renovar } = req.body;

  // Bloquear renovación si quedan más de 7 días y no está cancelada
  if (renovar && req.user.es_premium && req.user.premium_hasta && !req.user.premium_cancelado) {
    const diasRestantes = Math.floor(
      (new Date(req.user.premium_hasta) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (diasRestantes > 7) {
      return res.status(400).json({
        error: `Tu membresía aún tiene ${diasRestantes} días vigentes. Podrás renovar cuando queden 7 días o menos.`,
        diasRestantes
      });
    }
  }

  let d = new Date();
  if (renovar && req.user.es_premium && req.user.premium_hasta) {
    d = new Date(req.user.premium_hasta);
    if (d < new Date()) d = new Date(); // Si ya venció, partir de hoy
  }
  d.setMonth(d.getMonth() + 1);
  const hasta = d.toISOString();

  const { error } = await supabase.from('usuarios').update({
    es_premium: true,
    rol: 'premium',
    premium_hasta: hasta,
    premium_cancelado: false
  }).eq('id', req.user.id);

  if (error) {
    console.error('Error al activar premium:', error);
    return res.status(500).json({ error: 'Error al procesar la suscripción' });
  }
  res.json({ mensaje: '¡Suscripción exitosa!', premiumHasta: hasta });
});

// Cancelar membresía
app.post('/api/auth/cancel-premium', authMW, async (req, res) => {
  if (!req.user.es_premium)
    return res.status(400).json({ error: 'No tienes una membresía activa para cancelar' });
  if (req.user.premium_cancelado)
    return res.status(400).json({ error: 'Tu membresía ya está marcada como cancelada' });

  const { error } = await supabase
    .from('usuarios').update({ premium_cancelado: true }).eq('id', req.user.id);

  if (error) {
    console.error('Error al cancelar premium:', error);
    return res.status(500).json({ error: 'Error al cancelar la membresía' });
  }
  res.json({ mensaje: 'Cancelación programada. Tu acceso Premium sigue activo hasta la fecha de vencimiento.' });
});

// ── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────
app.get('/api/users/me/payment-methods', authMW, async (req, res) => {
  const { data } = await supabase.from('metodos_pago').select('*')
    .eq('usuario_id', req.user.id).order('fecha_registro', { ascending: false });
  res.json(deepFixEncoding(data || []));
});

app.post('/api/users/me/payment-methods', authMW, async (req, res) => {
  const { numero } = req.body;
  const mask = `**** **** **** ${String(numero).slice(-4)}`;
  const { data } = await supabase.from('metodos_pago').insert({
    usuario_id: req.user.id,
    tarjeta_mask: mask,
    token_pago: 'tok_' + Math.random().toString(36).substr(2, 9),
    fecha_registro: new Date().toISOString()
  }).select().maybeSingle();
  res.json(data);
});

// ── PERFIL ───────────────────────────────────────────────────────────────────
app.get('/api/auth/me', authMW, async (req, res) => { res.json(req.user); });

app.put('/api/auth/me', authMW, async (req, res) => {
  const { nombre, apellido, username, bio, preferencias, foto_perfil } = req.body;

  if (VALIDACION.isInvalid(nombre) || VALIDACION.isInvalid(apellido) || VALIDACION.isInvalid(username) || VALIDACION.isInvalid(bio)) {
    return res.status(400).json({ error: 'Se detectó contenido inapropiado o incoherente en los campos del perfil' });
  }

  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
  if (nombre && !nameRegex.test(nombre)) return res.status(400).json({ error: 'Nombre inválido' });
  if (apellido && !nameRegex.test(apellido)) return res.status(400).json({ error: 'Apellido inválido' });

  const updates = {};
  if (nombre !== undefined) updates.nombre = nombre;
  if (apellido !== undefined) updates.apellido = apellido;
  if (bio !== undefined) updates.bio = bio;
  if (preferencias !== undefined) updates.preferencias = preferencias;
  if (foto_perfil !== undefined) updates.foto_perfil = foto_perfil;

  console.log(`[DEBUG] Actualizando perfil para usuario ${req.user.id}. Campos:`, Object.keys(updates));

  // Verificar que el nuevo username no esté en uso
  if (username && username !== req.user.username) {
    const { data: existe } = await supabase.from('usuarios')
      .select('id').eq('username', username).maybeSingle();

    if (existe) return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });

    updates.username = username;
  }

  const { error } = await supabase.from('usuarios')
    .update(updates).eq('id', req.user.id);

  if (error) {
    console.error('❌ Error Supabase al actualizar perfil:', error);
    return res.status(500).json({ error: 'Error al guardar el perfil' });
  }

  // Sincronizar username en recetas y comentarios
  if (updates.username) {
    await Promise.all([
      supabase.from('recetas').update({ autor: updates.username }).eq('usuario_id', req.user.id),
      supabase.from('comentarios').update({ autor: updates.username }).eq('usuario_id', req.user.id)
    ]);
  }

  res.json({ mensaje: 'Perfil actualizado', username: updates.username || req.user.username });
});

app.put('/api/auth/me/password', authMW, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan campos' });

  const { data: user } = await supabase.from('usuarios').select('password_hash').eq('id', req.user.id).single();
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('id', req.user.id);
  res.json({ mensaje: 'Contraseña actualizada' });
});


app.get('/api/users/:id/profile', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, username, nombre, apellido, bio, foto_perfil, es_premium, rol, puntos, fecha_registro')
    .eq('id', req.params.id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
  data.username = censor(data.username);
  res.json(data);
});

// ── ETIQUETAS ────────────────────────────────────────────────────────────────
app.get('/api/tags', async (req, res) => {
  try {
    const { data } = await supabase.from('recetas').select('etiquetas');
    const allTags = new Set(['fitness', 'vegetariano', 'vegano', 'sin gluten', 'keto', 'mexicana', 'postre']);
    data?.forEach(r => {
      if (Array.isArray(r.etiquetas))
        r.etiquetas.forEach(t => allTags.add(String(t).toLowerCase().trim()));
    });
    res.json(Array.from(allTags).sort());
  } catch (e) { res.status(500).json({ error: 'Error al obtener etiquetas' }); }
});

// ── RECETAS ──────────────────────────────────────────────────────────────────
app.get('/api/users/me/recipes', authMW, async (req, res) => {
  const { data, error } = await supabase.from('recetas').select('*')
    .eq('usuario_id', req.user.id).order('fecha', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // En este endpoint (mis recetas), el usuario siempre puede verlas aunque sean premium
  // Pero añadimos los flags para consistencia
  const ids = data?.map(r => r.id) || [];
  let userLikes = new Set();
  if (ids.length > 0) {
    const { data: likes } = await supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids);
    likes?.forEach(l => userLikes.add(l.receta_id));
  }

  const result = (data || []).map(r => ({
    ...r,
    likedByUser: userLikes.has(r.id),
    favoriteByUser: true // Si son mis recetas, o si las estoy listando aquí, asumimos consistencia o checkamos favoritos
  }));

  res.json(result);
});

app.get('/api/users/:id/recipes', optAuth, async (req, res) => {
  const esPremium = req.user && (req.user.es_premium === true || req.user.rol === 'premium' || req.user.rol === 'admin');

  let query = supabase.from('recetas').select('*')
    .eq('usuario_id', req.params.id);

  /*
  if (!esPremium) {
    query = query.eq('es_premium', false);
  }
  */

  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const result = (data || []).map(r => ({
    ...r,
    autor: censor(r.autor || 'Chef Foráneo')
  }));

  res.json(deepFixEncoding(result));
});

// GET /api/recipes — con filtros, join de usuario, y filtrado premium
app.get('/api/recipes', optAuth, async (req, res) => {
  const { q, orden, filter, maxPrecio, maxTiempo, ignorePrefs } = req.query;

  // Determinar si el usuario es premium
  const esPremium = req.user && (req.user.es_premium === true || req.user.rol === 'premium' || req.user.rol === 'admin');

  // Hacer join con usuarios para obtener el nombre del autor
  let query = supabase.from('recetas')
    .select('*, usuarios(id, username, nombre, foto_perfil, es_premium, rol)');

  // SE MUESTRAN TODAS LAS RECETAS A TODOS (el bloqueo es al entrar al detalle)
  /*
  if (!esPremium) {
    query = query.eq('es_premium', false);
  }
  */

  // FILTRADO POR PREFERENCIAS DEL PERFIL (si no se indica ignorarlas)
  if (req.user && Array.isArray(req.user.preferencias) && req.user.preferencias.length > 0 && !ignorePrefs) {
    const prefs = req.user.preferencias.filter(p => typeof p === 'string' && !p.startsWith('PERMISO_'));
    if (prefs.length > 0) {
      // Filtrar recetas que tengan al menos una de las etiquetas del perfil
      query = query.overlaps('etiquetas', prefs);
    }
  }

  if (q) query = query.or(`titulo.ilike.%${q}%,ingredientes.ilike.%${q}%`);

  // Orden: popular = mayor likes, si hay empate ordenar por comentarios_count
  if (orden === 'likes' || filter === 'populares') {
    query = query.order('likes', { ascending: false }).order('comentarios_count', { ascending: false });
  } else {
    query = query.order('id', { ascending: false });
  }

  if (maxPrecio) query = query.lte('precio_numerico', parseInt(maxPrecio));
  if (maxTiempo) query = query.lte('tiempo_numerico', parseInt(maxTiempo));

  let { data, error } = await query.limit(50);
  if (error) {
    console.error('Recipes Query Error:', error);
    return res.status(500).json({ error: 'Error al obtener recetas' });
  }

  // Si el usuario está logueado, marcar cuáles le gustan y cuáles tiene en favoritos
  let userLikes = new Set();
  let userFavs = new Set();
  if (req.user && data?.length > 0) {
    const ids = data.map(r => r.id);
    const [{ data: likes }, { data: favs }] = await Promise.all([
      supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids),
      supabase.from('favoritos').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids)
    ]);
    likes?.forEach(l => userLikes.add(l.receta_id));
    favs?.forEach(f => userFavs.add(f.receta_id));
  }

  // Normalizar: añadir campo "autor" y flags de usuario
  data = (data || []).map(r => ({
    ...r,
    autor: censor(r.usuarios?.username || r.autor || 'Chef Foráneo'),
    usuario: r.usuarios ? { ...r.usuarios, username: censor(r.usuarios.username) } : null,
    likedByUser: userLikes.has(r.id),
    favoriteByUser: userFavs.has(r.id)
  }));

  // Filtrar por preferencias alimenticias solo cuando no hay búsqueda ni filtro especial activo
  const sinFiltroEspecial = !q && !maxPrecio && !maxTiempo && !orden && filter !== 'populares';
  if (!ignorePrefs && sinFiltroEspecial && req.user) {
    const prefs = (Array.isArray(req.user.preferencias) ? req.user.preferencias : [])
      .filter(p => typeof p === 'string' && !p.startsWith('PERMISO_'))
      .map(p => p.toLowerCase().trim());

    if (prefs.length > 0 && data?.length > 0) {
      const filtradas = data.filter(r => {
        const tags = Array.isArray(r.etiquetas)
          ? r.etiquetas.map(t => String(t).toLowerCase().trim()) : [];
        return tags.some(t => prefs.includes(t));
      });
      if (filtradas.length > 0) data = filtradas;
    }
  }

  res.json(deepFixEncoding(data || []));
});


app.get('/api/recipes/:id', optAuth, async (req, res) => {
  const { data: recipe, error } = await supabase.from('recetas')
    .select('*, usuarios(username, nombre, foto_perfil, es_premium, rol)')
    .eq('id', req.params.id).maybeSingle();

  if (error || !recipe) return res.status(404).json({ error: 'Receta no encontrada' });

  // Normalizar autor
  recipe.autor = censor(recipe.usuarios?.username || recipe.autor || 'Chef Foráneo');
  if (recipe.usuarios) {
    recipe.usuarios.username = censor(recipe.usuarios.username);
  }

  if (recipe.es_premium) {
    const isAuthor = req.user && String(req.user.id) === String(recipe.usuario_id);
    if (!isAuthor && !tienePermiso(req.user, 'VIDEOS'))
      return res.status(403).json({ error: 'Esta es una receta Premium. ¡Desbloquea videos con tus puntos o hazte Premium!' });
  }

  // Añadir flags si el usuario está logueado
  if (req.user) {
    const [{ data: liked }, { data: faved }] = await Promise.all([
      supabase.from('likes').select('id').eq('usuario_id', req.user.id).eq('receta_id', recipe.id).maybeSingle(),
      supabase.from('favoritos').select('id').eq('usuario_id', req.user.id).eq('receta_id', recipe.id).maybeSingle()
    ]);
    recipe.likedByUser = !!liked;
    recipe.favoriteByUser = !!faved;
  }

  res.json(deepFixEncoding(recipe));
});

// FIX: mapeo correcto camelCase → snake_case
app.post('/api/recipes', authMW, async (req, res) => {
  const {
    titulo, ingredientes, pasos, descripcion,
    precio, precioNumerico,
    tiempo, tiempoNumerico,
    porciones,
    imagen,
    videoUrl, videoYoutube,
    esPremium, etiquetas
  } = req.body;

  if (!titulo || !ingredientes || !pasos || !tiempo || !precio)
    return res.status(400).json({ error: 'Faltan campos obligatorios: título, ingredientes, pasos, tiempo y costo aproximado.' });

  if (!VALIDACION.isRecipeTitleValid(titulo)) {
    return res.status(400).json({ error: 'El título de la receta es demasiado corto o parece incoherente. Debe ser un nombre de platillo real.' });
  }

  if (!VALIDACION.areIngredientsValid(ingredientes)) {
    return res.status(400).json({ error: 'Los ingredientes parecen incoherentes. Por favor, incluye ingredientes y cantidades válidas.' });
  }

  if (!VALIDACION.areStepsValid(pasos)) {
    return res.status(400).json({ error: 'Los pasos de preparación deben ser instrucciones claras y detalladas (mínimo 20 caracteres).' });
  }

  if (VALIDACION.isInvalid(descripcion)) {
    return res.status(400).json({ error: 'La descripción contiene palabras no permitidas o texto incoherente.' });
  }

  if (Array.isArray(etiquetas)) {
    for (const tag of etiquetas) {
      if (VALIDACION.isInvalid(tag)) {
        return res.status(400).json({ error: `La categoría "${tag}" no es permitida o es incoherente.` });
      }
    }
  }

  const receta = {
    titulo,
    descripcion: descripcion || '',
    ingredientes,
    pasos,
    precio: precio || '$$',
    precio_numerico: precioNumerico || 0,   // ← snake_case
    tiempo: tiempo || '30 min',
    tiempo_numerico: tiempoNumerico || 30,  // ← snake_case
    porciones: porciones || '2-4',
    imagen: imagen || null,
    video_url: videoUrl || null, // ← snake_case
    video_youtube: videoYoutube || null, // ← snake_case
    es_premium: esPremium || false, // ← snake_case
    etiquetas: etiquetas || [],
    autor: req.user.username,
    usuario_id: req.user.id,
    fecha: new Date().toISOString(),
    likes: 0,
    comentarios_count: 0
  };
  
  // Validar si el usuario puede agregar video o marcar como premium (solo Premium)
  const isPremiumUser = req.user.es_premium || req.user.rol === 'premium' || req.user.rol === 'admin';
  if (!isPremiumUser && (videoUrl || videoYoutube || esPremium)) {
    return res.status(403).json({ error: 'Las funciones de video y recetas Premium son exclusivas para usuarios Premium 👑' });
  }

  const { data, error } = await supabase.from('recetas').insert(receta).select().maybeSingle();
  if (error) {
    console.error('❌ Error al insertar receta:', error);
    return res.status(500).json({ error: error.message });
  }
  await otorgarPuntos(req.user.id, 'subir_receta', `Receta: ${titulo}`);
  res.json(data);
});

// Endpoint para editar receta
app.put('/api/recipes/:id', authMW, async (req, res) => {
  const { id } = req.params;
  const {
    titulo, ingredientes, pasos, descripcion,
    precio, precioNumerico,
    tiempo, tiempoNumerico,
    porciones,
    imagen,
    videoUrl, videoYoutube,
    esPremium, etiquetas
  } = req.body;

  // 1. Verificar que la receta existe y pertenece al usuario
  const { data: recipe, error: fetchError } = await supabase
    .from('recetas')
    .select('usuario_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !recipe) return res.status(404).json({ error: 'Receta no encontrada' });
  if (recipe.usuario_id !== req.user.id && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'No tienes permiso para editar esta receta' });
  }

  // 2. Preparar el objeto de actualización
  const updates = {
    titulo,
    descripcion: descripcion || '',
    ingredientes,
    pasos,
    precio: precio || '$$',
    precio_numerico: precioNumerico || 0,
    tiempo: tiempo || '30 min',
    tiempo_numerico: tiempoNumerico || 30,
    porciones: porciones || '2-4',
    es_premium: esPremium || false,
    etiquetas: etiquetas || []
  };

  if (imagen !== undefined) updates.imagen = imagen;
  
  // Validar si el usuario puede agregar video o marcar como premium (solo Premium)
  const isPremiumUser = req.user.es_premium || req.user.rol === 'premium' || req.user.rol === 'admin';
  if (isPremiumUser) {
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    if (videoYoutube !== undefined) updates.video_youtube = videoYoutube;
    if (esPremium !== undefined) updates.es_premium = esPremium;
  } else {
    if (videoUrl || videoYoutube || esPremium) {
      return res.status(403).json({ error: 'Las funciones de video y recetas Premium son exclusivas para usuarios Premium 👑' });
    }
  }

  const { data, error } = await supabase
    .from('recetas')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('❌ Error al actualizar receta:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.delete('/api/recipes/:id', authMW, async (req, res) => {
  const { data } = await supabase.from('recetas').select('usuario_id, imagen, video_url').eq('id', req.params.id).maybeSingle();
  if (!data) return res.status(404).json({ error: 'Receta no encontrada' });
  if (data.usuario_id !== req.user.id && req.user.rol !== 'admin')
    return res.status(403).json({ error: 'Sin permiso' });

  // Intentar borrar archivos de storage si existen
  try {
    const filesToDelete = [];
    if (data.imagen && data.imagen.includes('/storage/v1/object/public/recetas/')) {
      filesToDelete.push(data.imagen.split('/recetas/')[1]);
    }
    if (data.video_url && data.video_url.includes('/storage/v1/object/public/recetas/')) {
      filesToDelete.push(data.video_url.split('/recetas/')[1]);
    }
    if (filesToDelete.length > 0) {
      await supabase.storage.from('recetas').remove(filesToDelete);
    }
  } catch (e) {
    console.error('Error borrando archivos de storage:', e);
  }

  await supabase.from('recetas').delete().eq('id', req.params.id);
  res.json({ mensaje: 'Receta y archivos asociados eliminados' });
});

// ── COMENTARIOS ──────────────────────────────────────────────────────────────
app.get('/api/recipes/:id/comments', optAuth, async (req, res) => {
  // Solo Premium o con permiso pueden ver comentarios
  if (!tienePermiso(req.user, 'COMENTARIOS')) {
    return res.status(403).json({ error: 'Acceso restringido. Canjea tus puntos por un pase de comentarios o hazte Premium.' });
  }

  const { data, error } = await supabase
    .from('comentarios')
    .select('*, usuarios(username, nombre, foto_perfil, es_premium, rol)')
    .eq('receta_id', req.params.id)
    .order('fecha', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  const transformado = (data || []).map(c => ({
    ...c,
    usuario: {
      ...c.usuarios,
      id: c.usuario_id,
      username: censor(c.usuarios?.username)
    }
  }));
  res.json(deepFixEncoding(transformado));
});

app.post('/api/recipes/:id/comments', authMW, async (req, res) => {
  // Solo Premium o con permiso pueden comentar
  if (!tienePermiso(req.user, 'COMENTARIOS')) {
    return res.status(403).json({ error: 'Esta acción requiere membresía Premium o un pase de comentarios 💬' });
  }

  const { texto, contenido } = req.body;
  const finalContenido = texto || contenido;
  if (!finalContenido) return res.status(400).json({ error: 'Sin contenido' });

  if (VALIDACION.isInvalid(finalContenido)) {
    return res.status(400).json({ error: 'Tu comentario contiene lenguaje no permitido o parece incoherente' });
  }

  const { data, error } = await supabase.from('comentarios').insert({
    receta_id: req.params.id,
    usuario_id: req.user.id,
    autor: req.user.username,
    contenido: finalContenido,
    texto: finalContenido,
    fecha: new Date().toISOString()
  }).select().maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  // Incrementar contador de comentarios en la receta
  const { data: r } = await supabase.from('recetas').select('comentarios_count').eq('id', req.params.id).single();
  await supabase.from('recetas').update({ comentarios_count: (r?.comentarios_count || 0) + 1 }).eq('id', req.params.id);

  await otorgarPuntos(req.user.id, 'comentar', `Comentario en receta ${req.params.id}`);
  res.json(deepFixEncoding(data));
});

app.delete('/api/comments/:id', authMW, async (req, res) => {
  const { data: c } = await supabase.from('comentarios').select('usuario_id, receta_id').eq('id', req.params.id).maybeSingle();
  if (!c) return res.status(404).json({ error: 'No existe' });
  if (c.usuario_id !== req.user.id && req.user.rol !== 'admin')
    return res.status(403).json({ error: 'Sin permiso' });
  await supabase.from('comentarios').delete().eq('id', req.params.id);

  // Decrementar contador de comentarios en la receta
  if (c.receta_id) {
    const { data: r } = await supabase.from('recetas').select('comentarios_count').eq('id', c.receta_id).single();
    const newCount = Math.max(0, (r?.comentarios_count || 0) - 1);
    await supabase.from('recetas').update({ comentarios_count: newCount }).eq('id', c.receta_id);
  }

  res.json({ mensaje: 'Eliminado' });
});

app.post('/api/comments/:id/replies', authMW, async (req, res) => {
  const { texto, contenido } = req.body;
  const finalContenido = texto || contenido;
  if (!finalContenido) return res.status(400).json({ error: 'Sin contenido' });
  const { data: padre } = await supabase.from('comentarios').select('receta_id').eq('id', req.params.id).single();
  const { data, error } = await supabase.from('comentarios').insert({
    receta_id: padre?.receta_id || null,
    usuario_id: req.user.id,
    padre_id: req.params.id,
    texto: finalContenido,
    fecha: new Date().toISOString()
  }).select().maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


app.get('/api/activity', authMW, async (req, res) => {
  // Solo Premium o con permiso pueden ver actividad
  if (!tienePermiso(req.user, 'COMUNIDAD')) {
    return res.status(403).json({ error: 'La actividad de la comunidad es exclusiva para usuarios Premium o con pase de comunidad' });
  }

  try {
    // Obtenemos comentarios, likes y nuevas recetas
    const [{ data: comments }, { data: likes }, { data: recipes }] = await Promise.all([
      supabase.from('comentarios').select('*, usuarios(username, foto_perfil, es_premium), recetas(id, titulo)').order('fecha', { ascending: false }).limit(10),
      supabase.from('likes').select('*, usuarios(username, foto_perfil, es_premium), recetas(id, titulo)').order('fecha', { ascending: false }).limit(10),
      supabase.from('recetas').select('*, usuarios(username, foto_perfil, es_premium)').order('fecha', { ascending: false }).limit(5)
    ]);

    let activity = [];

    if (comments) {
      comments.forEach(c => activity.push({
        id: `c-${c.id}`,
        tipo: 'comentario',
        fecha: c.fecha,
        texto: c.texto,
        usuario: {
          id: c.usuario_id,
          username: censor(c.usuarios?.username),
          foto_perfil: c.usuarios?.foto_perfil,
          es_premium: c.usuarios?.es_premium
        },
        receta: c.recetas
      }));
    }

    if (likes) {
      likes.forEach(l => activity.push({
        id: `l-${l.id}`,
        tipo: 'like',
        fecha: l.fecha,
        texto: `le dio like a ${l.recetas?.titulo || 'una receta'}`,
        usuario: {
          id: l.usuario_id,
          username: censor(l.usuarios?.username),
          foto_perfil: l.usuarios?.foto_perfil,
          es_premium: l.usuarios?.es_premium
        },
        receta: l.recetas
      }));
    }

    if (recipes) {
      recipes.forEach(r => activity.push({
        id: `r-${r.id}`,
        tipo: 'receta',
        fecha: r.fecha,
        texto: `publicó una nueva receta: ${r.titulo}`,
        usuario: {
          id: r.usuario_id,
          username: censor(r.usuarios?.username),
          foto_perfil: r.usuarios?.foto_perfil,
          es_premium: r.usuarios?.es_premium
        },
        receta: { id: r.id, titulo: r.titulo }
      }));
    }

    // Ordenar por fecha descendente
    activity.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(deepFixEncoding(activity.slice(0, 20)));
  } catch (e) {
    console.error('Activity Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── LIKES — con control de duplicados ────────────────────────────────────────
app.post('/api/recipes/:id/like', authMW, async (req, res) => {
  const recipeId = req.params.id;
  const userId = req.user.id;

  try {
    // Intentar insertar el like (el unique constraint en la DB evitará duplicados)
    const { error: insertError } = await supabase.from('likes').insert({
      receta_id: recipeId, usuario_id: userId, fecha: new Date().toISOString()
    });

    if (insertError) {
      // Si el error es por duplicado (código 23505 en Postgres)
      if (insertError.code === '23505' || insertError.message.includes('unique')) {
        const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
        return res.json({ likes: r?.likes || 0, alreadyLiked: true });
      }
      throw insertError;
    }

    // Si se insertó con éxito, actualizar el contador denormalizado
    // Usamos select() para obtener el valor más reciente y evitar desincronización
    const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
    const newCount = (r?.likes || 0) + 1;
    await supabase.from('recetas').update({ likes: newCount }).eq('id', recipeId);

    await otorgarPuntos(userId, 'like', `Like en receta ${recipeId}`);
    res.json({ likes: newCount, alreadyLiked: false });
  } catch (e) {
    console.error('Error in like:', e);
    res.status(500).json({ error: 'Error al procesar el like' });
  }
});

app.delete('/api/recipes/:id/like', authMW, async (req, res) => {
  const recipeId = req.params.id;
  const userId = req.user.id;

  // Verificar que existe el like
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('receta_id', recipeId)
    .eq('usuario_id', userId)
    .maybeSingle();

  if (!existing) {
    const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
    return res.json({ likes: r?.likes || 0, removed: false });
  }

  await supabase.from('likes').delete().eq('receta_id', recipeId).eq('usuario_id', userId);
  const { data: r } = await supabase.from('recetas').select('likes').eq('id', recipeId).single();
  const newCount = Math.max((r?.likes || 1) - 1, 0);
  await supabase.from('recetas').update({ likes: newCount }).eq('id', recipeId);
  res.json({ likes: newCount, removed: true });
});


// ── FAVORITOS — endpoints completos ──────────────────────────────────────────
app.post('/api/recipes/:id/favorite', authMW, async (req, res) => {
  try {
    const { data: existe } = await supabase
      .from('favoritos').select('id')
      .eq('usuario_id', req.user.id).eq('receta_id', req.params.id).maybeSingle();
    if (existe) return res.json({ mensaje: 'Ya está en favoritos', added: false });

    const { error } = await supabase.from('favoritos').insert({
      usuario_id: req.user.id, receta_id: req.params.id, fecha: new Date().toISOString()
    });
    if (error) throw error;
    await otorgarPuntos(req.user.id, 'favorito', `Favorito receta ${req.params.id}`);
    res.json({ mensaje: 'Guardado en favoritos', added: true });
  } catch (e) {
    console.error('Error al guardar favorito:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/recipes/:id/favorite', authMW, async (req, res) => {
  try {
    const { error } = await supabase.from('favoritos')
      .delete().eq('usuario_id', req.user.id).eq('receta_id', req.params.id);
    if (error) throw error;
    res.json({ mensaje: 'Eliminado de favoritos', removed: true });
  } catch (e) {
    console.error('Error al eliminar favorito:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/me/favorites', authMW, async (req, res) => {
  const { data: favs } = await supabase.from('favoritos').select('receta_id').eq('usuario_id', req.user.id);
  if (!favs?.length) return res.json([]);

  const esPremium = req.user.es_premium === true || req.user.rol === 'premium' || req.user.rol === 'admin';

  let query = supabase.from('recetas').select('*').in('id', favs.map(f => f.receta_id));
  /*
  if (!esPremium) {
    query = query.eq('es_premium', false);
  }
  */

  const { data } = await query;

  // Añadir flags
  const ids = data?.map(r => r.id) || [];
  let userLikes = new Set();
  if (ids.length > 0) {
    const { data: likes } = await supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids);
    likes?.forEach(l => userLikes.add(l.receta_id));
  }

  const result = (data || []).map(r => ({
    ...r,
    likedByUser: userLikes.has(r.id),
    favoriteByUser: true
  }));

  res.json(deepFixEncoding(result));
});

app.get('/api/users/me/likes', authMW, async (req, res) => {
  try {
    const { data: userLikes } = await supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id);
    if (!userLikes?.length) return res.json([]);

    const { data: recipes, error } = await supabase
      .from('recetas')
      .select('*')
      .in('id', userLikes.map(l => l.receta_id));

    if (error) throw error;
    
    const ids = recipes?.map(r => r.id) || [];
    let userFavs = new Set();
    if (ids.length > 0) {
      const { data: favs } = await supabase.from('favoritos').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids);
      favs?.forEach(f => userFavs.add(f.receta_id));
    }

    const result = (recipes || []).map(r => ({
      ...r,
      likedByUser: true,
      favoriteByUser: userFavs.has(r.id)
    }));

    res.json(deepFixEncoding(result));
  } catch (e) {
    console.error('Error fetching liked recipes:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── HISTORIAL ────────────────────────────────────────────────────────────────
app.get('/api/users/me/history', authMW, async (req, res) => {
  const { data: hist } = await supabase.from('historial').select('receta_id')
    .eq('usuario_id', req.user.id).order('fecha', { ascending: false }).limit(30);
  if (!hist?.length) return res.json([]);

  // Solo Premium o con permiso pueden ver historial
  if (!tienePermiso(req.user, 'HISTORIAL')) {
    return res.status(403).json({ error: 'El historial de navegación es una función Premium 📜' });
  }

  const esPremium = req.user.es_premium === true || req.user.rol === 'premium' || req.user.rol === 'admin';
  let query = supabase.from('recetas').select('*').in('id', hist.map(h => h.receta_id));
  /*
  if (!esPremium) {
    query = query.eq('es_premium', false);
  }
  */

  const { data } = await query;

  // Añadir flags
  const ids = data?.map(r => r.id) || [];
  let userLikes = new Set();
  let userFavs = new Set();
  if (ids.length > 0) {
    const [{ data: likes }, { data: favs }] = await Promise.all([
      supabase.from('likes').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids),
      supabase.from('favoritos').select('receta_id').eq('usuario_id', req.user.id).in('receta_id', ids)
    ]);
    likes?.forEach(l => userLikes.add(l.receta_id));
    favs?.forEach(f => userFavs.add(f.receta_id));
  }

  const result = (data || []).map(r => ({
    ...r,
    likedByUser: userLikes.has(r.id),
    favoriteByUser: userFavs.has(r.id)
  }));

  res.json(result);
});

app.post('/api/users/me/history', authMW, async (req, res) => {
  await supabase.from('historial').upsert(
    { receta_id: req.body.recipeId, usuario_id: req.user.id, fecha: new Date().toISOString() },
    { onConflict: 'receta_id,usuario_id' }
  );
  await otorgarPuntos(req.user.id, 'ver_receta', `Vista receta ${req.body.recipeId}`);
  res.json({ ok: true });
});

app.delete('/api/users/me/history/:recipeId', authMW, async (req, res) => {
  await supabase.from('historial').delete()
    .eq('usuario_id', req.user.id).eq('receta_id', req.params.recipeId);
  res.json({ mensaje: 'Eliminado del historial' });
});

// ── PLANIFICADOR — FIX: tabla correcta planes_semanales ──────────────────────
app.get('/api/users/me/planner', authMW, async (req, res) => {
  const { data } = await supabase.from('planes_semanales').select('plan')
    .eq('usuario_id', req.user.id).maybeSingle();
  res.json(data || { plan: {} });
});

app.post('/api/users/me/planner', authMW, async (req, res) => {
  const { error } = await supabase.from('planes_semanales').upsert(
    { usuario_id: req.user.id, plan: req.body.plan },
    { onConflict: 'usuario_id' }
  );
  if (error) {
    console.error('❌ Error al guardar plan:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

// ── STATS ────────────────────────────────────────────────────────────────────
app.get('/api/users/me/stats', authMW, async (req, res) => {
  try {
    const [{ count: recipes }, { count: favorites }, { data: likesData }] = await Promise.all([
      supabase.from('recetas').select('*', { count: 'exact', head: true }).eq('usuario_id', req.user.id),
      supabase.from('favoritos').select('*', { count: 'exact', head: true }).eq('usuario_id', req.user.id),
      supabase.from('recetas').select('likes').eq('usuario_id', req.user.id)
    ]);
    const likes = likesData?.reduce((acc, r) => acc + (r.likes || 0), 0) || 0;
    res.json({ recetas: recipes || 0, favoritos: favorites || 0, visitas: likes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/stats', async (req, res) => {
  try {
    const [{ count: recipes }, { data: likesData }] = await Promise.all([
      supabase.from('recetas').select('*', { count: 'exact', head: true }).eq('usuario_id', req.params.id),
      supabase.from('recetas').select('likes').eq('usuario_id', req.params.id)
    ]);
    const likes = likesData?.reduce((acc, r) => acc + (r.likes || 0), 0) || 0;
    res.json({ recetas: recipes || 0, visitas: likes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CANJES DE PUNTOS ─────────────────────────────────────────────────────────
app.post('/api/users/me/redeem', authMW, async (req, res) => {
  const { rewardId, points, days, type } = req.body;
  const user = req.user;
  if ((user.puntos || 0) < points)
    return res.status(400).json({ error: 'Puntos insuficientes' });

  let updates = { puntos: (user.puntos || 0) - points };
  let message = `Canje exitoso: ${rewardId}`;

  if (days && days > 0) {
    // Restringir recompensas a máximo 5 días
    const safeDays = Math.min(Math.max(days, 1), 5);
    const base = user.es_premium && user.premium_hasta ? new Date(user.premium_hasta) : new Date();
    base.setDate(base.getDate() + safeDays);
    updates.es_premium = true;
    updates.rol = 'premium';
    updates.premium_hasta = base.toISOString();
    message = `¡Tienes ${safeDays} día(s) Premium!`;
  }

  if (type === 'videos') {
    // Ya no es permanente, se otorga por 3 días por defecto o lo que indique reward
    const videoDays = Math.min(Math.max(days || 3, 1), 5);
    const expira = new Date(Date.now() + videoDays * 86400000).toISOString();
    const prefs = Array.isArray(user.preferencias) ? [...user.preferencias] : [];
    const tagPrefix = 'PERMISO_VIDEOS:';
    const filtered = prefs.filter(p => !String(p).startsWith(tagPrefix));
    filtered.push(`PERMISO_VIDEOS:${expira}`);
    updates.preferencias = filtered;
    message = `¡Acceso a videos desbloqueado por ${videoDays} días!`;
  }

  if (type && type.startsWith('permiso_') && type !== 'permiso_videos') {
    const prefs = Array.isArray(user.preferencias) ? [...user.preferencias] : [];
    const safeDays = Math.min(Math.max(days || 1, 1), 5);
    const expira = new Date(Date.now() + safeDays * 86400000).toISOString();
    const tagKey = type.replace('permiso_', '').toUpperCase();
    const tag = `PERMISO_${tagKey}:${expira}`;
    const tagPrefix = `PERMISO_${tagKey}:`;
    const filtered = prefs.filter(p => !String(p).startsWith(tagPrefix));
    filtered.push(tag);
    updates.preferencias = filtered;
    message = `¡Permiso activado por ${safeDays} día(s)!`;
  }

  const { data: updated, error } = await supabase.from('usuarios')
    .update(updates).eq('id', user.id).select().maybeSingle();

  if (error) {
    console.error('Error al canjear:', error);
    return res.status(500).json({ error: 'Error al procesar el canje' });
  }

  await supabase.from('puntos_log').insert({
    usuario_id: user.id, accion: 'canje', puntos: -points,
    descripcion: message, fecha: new Date().toISOString()
  });

  res.json({
    message,
    points: updated.puntos,
    es_premium: updated.es_premium,
    rol: updated.rol,
    preferencias: updated.preferencias
  });
});

// ── CHATBOT IA ───────────────────────────────────────────────────────────────
function clasificarIntencion(m) {
  const t = m.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos para comparar
    .replace(/[¿?¡!]/g, '');

  // Saludos coloquiales
  if (/^(hola|holi|holaa|hey|hi|buenas|que tal|como estas|ola|buenas tardes|buen dia|buenos dias|buen dia)/.test(t)) return 'saludo';

  // Plan alimenticio / semanal
  if (/plan.*(semana|semanal|diario|dieta|alimenticio|alimentacion|comer|menu)|armar.*(plan|menu|dieta)|crear.*(plan|menu|dieta)|hacer.*(plan|menu|dieta)|sugiere.*(plan|dieta|menu)|dame.*(plan|dieta|menu)/.test(t)) return 'crear_plan';

  // Top / mejores recetas
  if (/top|mejores?|mas (populares?|likead|vistos?)|las mejores?|recomienda|recommend|suger|que (cocin|prepar|hag)|quiero (cocinar|hacer|comer)|que (como|hago|preparo|cocino)|que me recomiend/.test(t)) return 'recomendar';

  // Por ingrediente principal (coloquial)
  if (/pollo|res|carne|cerdo|pescado|salmon|atun|huevo|pasta|arroz|frijol|papa|verdura|vegetales|tofu|camar|camaron|mariscos/.test(t) && !/plan/.test(t)) return 'por_ingrediente';

  // Receta específica por nombre
  if (/receta.*(de |para |con )|como (hago|haces|preparo|se hace|cocino|cocinar)/.test(t)) return 'buscar';

  // Día de la semana
  if (/lunes|martes|miercoles|jueves|viernes|sabado|domingo/.test(t)) return 'crear_plan';

  // Económica / barata
  if (/barat[oa]|economi|poco dinero|sin dinero|barato|economico|low cost|barata/.test(t)) return 'economica';

  // Rápida / fácil
  if (/rapid[ao]|facil|sencill[ao]|rapido|en poco tiempo|pocos minutos|sin complicacion|quick|easy/.test(t)) return 'rapida';

  // Postre / dulce
  if (/dulce|postre|pastel|pastes|torta|galleta|helado|chocolate|azucar|dessert/.test(t)) return 'dulces';

  // Familiar
  if (/familiar|familia|para todos|muchas personas|para ninos|para grupo/.test(t)) return 'plan_familiar';

  // Tiempo específico en minutos
  if (/([0-9]+)\s*(min|minutos?|m)/.test(t)) return 'tiempo_especifico';

  // Presupuesto específico
  if (/(\$|mxn|pesos?|precio|presupuesto)\s*([0-9]+)/.test(t) || /([0-9]+)\s*(peso|pesos?|mxn|\$)/.test(t)) return 'presupuesto_especifico';

  // Fitness / saludable
  if (/saludable|fitness|dieta|light|sin grasa|bajo.*(calorias|carb)|proteina|vegano|vegetarian/.test(t)) return 'saludable';

  return 'buscar';
}

// Extraer ingrediente mencionado en el mensaje
function extraerIngrediente(m) {
  const ingredientes = ['pollo', 'res', 'carne', 'cerdo', 'pescado', 'salmon', 'atun', 'huevo', 'pasta', 'arroz', 'frijol', 'papa', 'verdura', 'tofu', 'camaron', 'mariscos'];
  const t = m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ingredientes.find(i => t.includes(i)) || null;
}

// Extraer día de la semana
function extraerDia(m) {
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const t = m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return dias.find(d => t.includes(d)) || 'lunes';
}

// Respuesta amigable según intención
function generarRespuesta(intencion, ingrediente, dia, count) {
  const nombres = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
  switch (intencion) {
    case 'saludo':
      return '¡Hola! Soy Chef IA 👨‍🍳✨ ¿Qué se te antoja cocinar hoy? Puedo ayudarte con recetas rápidas, económicas, planes semanales, o lo que quieras 🍽️';
    case 'recomendar':
      return count > 0 ? `🌟 Aquí están las recetas más populares para ti:` : '😕 No encontré recetas populares en este momento, intenta con otro tema.';
    case 'economica':
      return count > 0 ? `💰 Recetas económicas que no quemarán tu bolsillo:` : '😕 No encontré recetas económicas disponibles, intenta más tarde.';
    case 'rapida':
      return count > 0 ? `⚡ ¡Sin perder tiempo! Aquí van recetas rápidas:` : '😕 No encontré recetas rápidas disponibles.';
    case 'dulces':
      return count > 0 ? `🍰 ¡Para los más golosos! Aquí tus postres favoritos:` : '😕 No encontré postres disponibles.';
    case 'plan_familiar':
      return count > 0 ? `👨‍👩‍👧 Recetas ideales para toda la familia:` : '😕 No encontré recetas familiares disponibles.';
    case 'por_ingrediente':
      return count > 0 ? `🥘 Aquí tienes recetas con ${ingrediente || 'ese ingrediente'}:` : `😕 No encontré recetas con ${ingrediente || 'ese ingrediente'}.`;
    case 'saludable':
      return count > 0 ? `🥗 Recetas saludables para tu bienestar:` : '😕 No encontré recetas saludables disponibles.';
    case 'tiempo_especifico':
      return count > 0 ? `⏱️ Aquí tienes recetas que puedes preparar rápido:` : '😕 No encontré recetas en ese rango de tiempo.';
    case 'presupuesto_especifico':
      return count > 0 ? `💰 ¡Ajustado al bolsillo! Estas recetas entran en tu presupuesto:` : '😕 No encontré recetas en ese rango de precio, intenta subir un poco el presupuesto.';
    case 'crear_plan':
      return count > 0 ? `📅 He preparado tu plan para el **${nombres[dia] || dia}**:` : '😕 No pude generar un plan en este momento.';
    default:
      return count > 0 ? `🍳 Encontré estas recetas para ti:` : '😕 No encontré resultados exactos. Intenta con frases como "recetas con pollo", "recetas de $40" o "postres rápidos".';
  }
}

app.post('/api/chatbot', authMW, async (req, res) => {
  if (!tienePermiso(req.user, 'CHAT')) {
    return res.status(403).json({ error: 'El Chef IA es exclusivo para usuarios Premium o con pase de Chat 🤖' });
  }
  const { mensaje } = req.body;
  if (!mensaje || !mensaje.trim())
    return res.json({ respuesta: '¡Hola! ¿En qué te puedo ayudar? Escribe algo como "receta rápida", "comida económica" o "receta de pollo" 😊', recetas: [] });

  const int = clasificarIntencion(mensaje);

  if (int === 'saludo')
    return res.json({ respuesta: '¡Hola! Soy Chef IA 👨‍🍳✨ ¿Qué se te antoja cocinar hoy? Puedo ayudarte con recetas rápidas, económicas, planes semanales o buscar por ingrediente. ¡Solo dime!', recetas: [] });

  try {
    let query = supabase.from('recetas').select('*');
    const ingrediente = extraerIngrediente(mensaje);
    const dia = extraerDia(mensaje);

    // Aplicar filtros según intención
    if (int === 'economica') query = query.lte('precio_numerico', 40).order('precio_numerico', { ascending: true });
    else if (int === 'rapida') query = query.lte('tiempo_numerico', 25).order('tiempo_numerico', { ascending: true });
    else if (int === 'dulces') query = query.or('etiquetas.cs.{postre},titulo.ilike.%dulce%,titulo.ilike.%postre%');
    else if (int === 'plan_familiar') query = query.or('etiquetas.cs.{familiar},titulo.ilike.%familiar%');
    else if (int === 'saludable') query = query.or('etiquetas.cs.{saludable},etiquetas.cs.{fitness},etiquetas.cs.{vegetariano}');
    else if (int === 'recomendar') query = query.order('likes', { ascending: false });
    else if (int === 'por_ingrediente' && ingrediente) {
      query = query.or(`titulo.ilike.%${ingrediente}%,ingredientes.ilike.%${ingrediente}%`);
    } else if (int === 'crear_plan') {
      // Plan del día: buscar variadas para cubrir desayuno/comida/cena
      query = query.order('likes', { ascending: false });
    } else {
      // Búsqueda general: usar el texto del mensaje
      const terminos = mensaje.trim().split(/\s+/).filter(w => w.length > 2).slice(0, 3);
      if (terminos.length > 0) {
        const orQuery = terminos.map(t => `titulo.ilike.%${t}%`).join(',');
        query = query.or(orQuery);
      }
    }

    // Aplicar filtros numéricos extra si están en el mensaje
    const minMatch = mensaje.match(/([0-9]+)\s*(min|minutos?|m)/i);
    if (minMatch) {
      const mins = parseInt(minMatch[1]);
      query = query.lte('tiempo_numerico', mins).order('tiempo_numerico', { ascending: true });
    }

    const precMatch = mensaje.match(/(\$|mxn|pesos?|precio|presupuesto)\s*([0-9]+)/i) || mensaje.match(/([0-9]+)\s*(peso|pesos?|mxn|\$)/i);
    if (precMatch) {
      // Si el primer regex matcheó, el número está en el grupo 2.
      // Si el segundo regex matcheó, el número está en el grupo 1.
      const valor = (isNaN(parseInt(precMatch[1]))) ? precMatch[2] : precMatch[1];
      const pesos = parseInt(valor);
      if (!isNaN(pesos)) {
        query = query.lte('precio_numerico', pesos).order('precio_numerico', { ascending: true });
      }
    }

    const { data: results } = await query.limit(30);
    const final = (results || []).sort(() => 0.5 - Math.random()).slice(0, 5);

    let resp = generarRespuesta(int, ingrediente, dia, final.length);

    // Si es plan semanal, crear el plan en la base de datos
    if (int === 'crear_plan' && final.length > 0) {
      const tiposComida = ['desayuno', 'comida', 'cena'];
      const { data: p } = await supabase.from('planes_semanales').select('plan').eq('usuario_id', req.user.id).maybeSingle();
      const nP = p?.plan || {};
      if (!nP[dia]) nP[dia] = {};

      // Asignar recetas a los tipos de comida disponibles
      final.forEach((rec, idx) => {
        const tipo = tiposComida[idx % tiposComida.length];
        if (!nP[dia][tipo]) nP[dia][tipo] = [];
        // Evitar duplicados
        if (!nP[dia][tipo].some(r => r.id === rec.id)) {
          nP[dia][tipo].push({ id: rec.id, titulo: rec.titulo, imagen: rec.imagen });
        }
      });

      await supabase.from('planes_semanales').upsert(
        { usuario_id: req.user.id, plan: nP },
        { onConflict: 'usuario_id' }
      );

      const nombres = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
      resp = `✅ ¡Plan creado para el **${nombres[dia] || dia}**! He agregado ${final.length} receta(s) a tu planificador semanal. Puedes verlo en la sección de Planificador. 📅`;
    }

    res.json({
      respuesta: resp,
      recetas: final.map(r => ({ id: r.id, titulo: r.titulo, imagen: r.imagen, precio: r.precio, tiempo: r.tiempo, likes: r.likes }))
    });
  } catch (e) {
    console.error('Error chatbot:', e);
    res.status(500).json({ error: 'Error en Chef IA' });
  }
});


// ── Inicio ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🍳 ForaneoKitchen en http://localhost:${PORT}`));