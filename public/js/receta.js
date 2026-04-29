// receta.js — CORREGIDO: campo es_premium correcto, imágenes y navegación
import { supabase } from './supabaseClient.js';

let recetaActual = null;
let currentUser  = null;

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;

function escapeHTML(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showToast(m, err = false) {
  let t = document.getElementById('receta-toast');
  if (!t) { t = document.createElement('div'); t.id = 'receta-toast'; t.className = 'notification-toast'; document.body.appendChild(t); }
  t.textContent = m; t.style.background = err ? '#e53935' : '#4caf50';
  t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function formatFecha(f) {
  const d = new Date(f), now = new Date(), diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-MX');
}

// ── Cargar usuario desde localStorage ─────────────────────────────────────────
async function cargarUsuario() {
  const userId = localStorage.getItem('userId');
  if (!userId) return;
  try {
    // Intentar con el id numérico o como string
    const { data } = await supabase.from('usuarios').select('*').eq('id', userId).single();
    currentUser = data;
  } catch { currentUser = null; }
}

// ── Cargar receta ──────────────────────────────────────────────────────────────
async function cargarReceta() {
  const id        = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('receta-container');
  if (!id) { mostrarError('No se especificó la receta'); return; }

  container.innerHTML = `<div class="receta-loading"><div class="loading-spinner"></div><p>Cargando...</p></div>`;

  try {
    // CORRECCIÓN: sin filtro es_premium_receta (campo no existe), usar es_premium
    // Los usuarios Free pueden ver recetas no-premium, Premium ve todas
    let query = supabase.from('recetas').select('*').eq('id', parseInt(id));
    const esPremium = currentUser?.es_premium || currentUser?.esPremium;
    if (!esPremium) {
      // Si no es premium, solo puede ver recetas no-premium
      // Pero primero cargar para verificar si es premium o no
      query = query.or('es_premium.eq.false,es_premium.is.null');
    }

    const { data, error } = await query.single();
    if (error || !data) throw new Error('Receta no encontrada');

    recetaActual = data;
    renderizarReceta(recetaActual);
    if (currentUser) await registrarVista(recetaActual.id);
    await cargarComentarios(recetaActual.id);
  } catch (e) {
    console.error('Error cargando receta:', e);
    mostrarError('Receta no encontrada o sin acceso');
  }
}

// ── Like ───────────────────────────────────────────────────────────────────────
async function toggleLike() {
  const userId = localStorage.getItem('userId');
  if (!userId) { showToast('Inicia sesión para dar like', true); return; }

  const btn     = document.getElementById('like-btn');
  const countEl = document.getElementById('like-count');
  const liked   = btn.dataset.liked === '1';
  btn.disabled  = true;
  const old     = parseInt(countEl.textContent) || 0;
  countEl.textContent = liked ? Math.max(old - 1, 0) : old + 1;
  btn.classList.toggle('liked', !liked);
  btn.dataset.liked = liked ? '0' : '1';

  try {
    if (liked) {
      await supabase.rpc('eliminar_like', { p_receta_id: recetaActual.id, p_usuario_id: parseInt(userId) });
    } else {
      await supabase.rpc('agregar_like',  { p_receta_id: recetaActual.id, p_usuario_id: parseInt(userId) });
    }
    const { data } = await supabase.from('recetas').select('likes').eq('id', recetaActual.id).single();
    if (data) countEl.textContent = data.likes;
    showToast(liked ? 'Like eliminado' : '❤️ ¡Like!');
  } catch {
    countEl.textContent = old;
    btn.classList.toggle('liked', liked);
    btn.dataset.liked = liked ? '1' : '0';
  } finally { btn.disabled = false; }
}

// ── Favorito ───────────────────────────────────────────────────────────────────
async function toggleFav() {
  const userId = localStorage.getItem('userId');
  if (!userId) { showToast('Inicia sesión para guardar', true); return; }

  const btn = document.getElementById('fav-btn');
  const fav = btn.dataset.fav === '1';
  btn.disabled = true;
  btn.textContent = fav ? '☆ Guardar' : '⭐ Guardado';
  btn.classList.toggle('favorited', !fav);
  btn.dataset.fav = fav ? '0' : '1';

  try {
    if (fav) {
      await supabase.from('favoritos').delete().eq('usuario_id', userId).eq('receta_id', recetaActual.id);
    } else {
      await supabase.from('favoritos').insert({ usuario_id: userId, receta_id: recetaActual.id });
    }
    showToast(fav ? 'Eliminado de favoritos' : '⭐ Guardado');
  } catch {
    btn.textContent = fav ? '⭐ Guardado' : '☆ Guardar';
    btn.classList.toggle('favorited', fav);
    btn.dataset.fav = fav ? '1' : '0';
  } finally { btn.disabled = false; }
}

// ── Historial ──────────────────────────────────────────────────────────────────
async function registrarVista(id) {
  const userId = localStorage.getItem('userId');
  if (!userId || (!currentUser?.es_premium && !currentUser?.esPremium)) return;
  try {
    await supabase.from('historial').upsert(
      { usuario_id: userId, receta_id: id, fecha: new Date().toISOString() },
      { onConflict: 'usuario_id,receta_id' }
    );
  } catch { /* silencioso */ }
}

// ── Agregar al planificador ────────────────────────────────────────────────────
function agregarAPlan() {
  const userId = localStorage.getItem('userId');
  if (!userId) { showToast('Inicia sesión para usar el planificador', true); return; }
  window.location.href = `planificador.html?agregar=${recetaActual.id}`;
}

// ── Comentarios ────────────────────────────────────────────────────────────────
async function cargarComentarios(recipeId) {
  const lista = document.getElementById('comentarios-lista');
  if (!lista) return;
  try {
    // Traer comentarios con info de usuario por join
    const { data } = await supabase
      .from('comentarios')
      .select('*, usuario:usuario_id(username, nombre)')
      .eq('receta_id', recipeId)
      .order('fecha');

    if (!data?.length) {
      lista.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">Sin comentarios aún. ¡Sé el primero!</div>';
      return;
    }

    const userId = localStorage.getItem('userId');
    lista.innerHTML = data.map(c => {
      const uname  = c.usuario?.username || c.usuario?.nombre || 'Usuario';
      const inicial = uname[0].toUpperCase();
      const esPropio = userId && String(c.user_id) === String(userId);
      return `
        <div class="comentario-item">
          <div class="comentario-avatar"><div class="avatar-placeholder">${inicial}</div></div>
          <div class="comentario-contenido">
            <div class="comentario-header">
              <strong>${escapeHTML(uname)}</strong>
              <small>${formatFecha(c.fecha)}</small>
            </div>
            <p>${escapeHTML(c.texto)}</p>
            ${esPropio ? `<button class="btn-eliminar-comentario" onclick="window.eliminarComentario(${c.id})">🗑️</button>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Error cargando comentarios:', e);
    lista.innerHTML = '<div style="color:#e53935;text-align:center;">Error al cargar comentarios</div>';
  }
}

async function enviarComentario() {
  const userId = localStorage.getItem('userId');
  if (!userId) { showToast('Inicia sesión para comentar', true); return; }
  const inp   = document.getElementById('nuevo-comentario');
  const texto = inp?.value.trim();
  if (!texto) { showToast('Escribe un comentario', true); return; }
  const btn = document.getElementById('enviar-comentario-btn');
  if (btn) btn.disabled = true;
  try {
    const { error } = await supabase.from('comentarios').insert({
      receta_id: recetaActual.id,
      usuario_id:   userId,
      texto,
      fecha:     new Date().toISOString()
    });
    if (error) throw error;
    if (inp) inp.value = '';
    showToast('💬 Comentario publicado');
    await cargarComentarios(recetaActual.id);
  } catch (e) { showToast('Error al publicar: ' + (e.message || ''), true); }
  finally { if (btn) btn.disabled = false; }
}

async function eliminarComentario(cid) {
  if (!confirm('¿Eliminar comentario?')) return;
  try {
    await supabase.from('comentarios').delete().eq('id', cid);
    await cargarComentarios(recetaActual.id);
    showToast('Comentario eliminado');
  } catch { showToast('Error al eliminar', true); }
}

// ── Renderizar receta ──────────────────────────────────────────────────────────
function renderizarReceta(r) {
  const container = document.getElementById('receta-container');

  // CORRECCIÓN: parsear ingredientes y pasos defensivamente
  const ings  = (r.ingredientes || '').split(',').map(i => i.trim()).filter(i => i);
  const pasos = (r.pasos || '').split(/\d+\./).filter(p => p.trim()).map(p => p.trim());
  if (!pasos.length) pasos.push(r.pasos || '');

  // CORRECCIÓN: usar imagen directamente — si viene de Supabase Storage ya es URL pública
  const imagenSrc = r.imagen || PLACEHOLDER;

  const likedCls = r.usuarioLike ? 'liked'     : '';
  const favCls   = r.esFavorito  ? 'favorited' : '';
  const userId   = localStorage.getItem('userId');

  container.innerHTML = `
    <button class="back-btn" onclick="window.history.back()">← Volver</button>
    <div class="receta-container">
      <div class="receta-imagen">
        <img src="${imagenSrc}"
             alt="${escapeHTML(r.titulo)}"
             onerror="this.src='${PLACEHOLDER}'"
             loading="lazy">
      </div>
      ${r.video_youtube || r.video_url ? `
      <div class="receta-video" style="margin-top: 20px; border-radius: 12px; overflow: hidden; background: #000;">
        ${r.video_youtube ? `
          <iframe width="100%" height="315" src="https://www.youtube.com/embed/${r.video_youtube}" frameborder="0" allowfullscreen></iframe>
        ` : `
          <video src="${r.video_url}" controls style="width: 100%; max-height: 400px;"></video>
        `}
      </div>
      ` : ''}
      <div class="receta-content">
        <h1>${escapeHTML(r.titulo)}</h1>
        <div class="receta-autor">👨‍🍳 ${escapeHTML(r.autor || 'Anónimo')}</div>

        <div class="acciones-receta" style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap;">
          <button class="btn-like ${likedCls}" id="like-btn"
            data-liked="${r.usuarioLike ? 1 : 0}"
            onclick="window.toggleLike()">
            ❤️ <span id="like-count">${r.likes || 0}</span>
          </button>
          <button class="btn-fav ${favCls}" id="fav-btn"
            data-fav="${r.esFavorito ? 1 : 0}"
            onclick="window.toggleFav()">
            ${r.esFavorito ? '⭐ Guardado' : '☆ Guardar'}
          </button>
          <button class="btn-plan-mini" onclick="window.agregarAPlan()">📅 Al plan</button>
        </div>

        <div class="info-cards">
          <div class="info-card">
            <span class="info-icon">💰</span>
            <div class="info-label">COSTO</div>
            <div class="info-value total">${escapeHTML(r.precio || '$$')}</div>
          </div>
          <div class="info-card">
            <span class="info-icon">⏱️</span>
            <div class="info-label">TIEMPO</div>
            <div class="info-value">${escapeHTML(r.tiempo || '30 min')}</div>
          </div>
        </div>

        <div class="seccion">
          <h2>📝 Ingredientes</h2>
          <ul class="lista-ingredientes">
            ${ings.map(i => `<li>🥘 ${escapeHTML(i)}</li>`).join('')}
          </ul>
        </div>

        <div class="seccion">
          <h2>👨‍🍳 Preparación</h2>
          <div class="pasos-lista">
            ${pasos.map((p, idx) => `
              <div class="paso-item">
                <div class="paso-numero">${idx + 1}</div>
                <div class="paso-texto">${escapeHTML(p)}</div>
              </div>`).join('')}
          </div>
        </div>

        <button class="btn-plan-semanal" onclick="window.agregarAPlan()">
          📅 Agregar al planificador
        </button>

        <div class="seccion">
          <h2>💬 Comentarios</h2>
          <div id="comentarios-lista" class="comentarios-lista">
            <div style="text-align:center;padding:20px;">Cargando comentarios...</div>
          </div>
          ${userId ? `
            <div class="nuevo-comentario-area" style="display:flex;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #eee;">
              <textarea id="nuevo-comentario" placeholder="Escribe un comentario..." rows="2"
                style="flex:1;padding:12px;border:2px solid #e8f5e9;border-radius:16px;font-family:inherit;resize:none;outline:none;font-size:0.9rem;"></textarea>
              <button id="enviar-comentario-btn"
                style="padding:8px 20px;background:linear-gradient(135deg,#4caf50,#2e7d32);color:white;border:none;border-radius:30px;cursor:pointer;font-weight:500;white-space:nowrap;">
                Enviar
              </button>
            </div>` : `
            <p style="text-align:center;color:#aaa;margin-top:16px;">
              <a href="login.html" style="color:#4caf50;font-weight:600;">Inicia sesión</a> para comentar
            </p>`}
        </div>
      </div>
    </div>`;

  // Listener del botón enviar comentario
  document.getElementById('enviar-comentario-btn')?.addEventListener('click', enviarComentario);
}

function mostrarError(msg) {
  const c = document.getElementById('receta-container');
  if (c) c.innerHTML = `
    <div class="error-message">
      <span class="error-icon">😕</span>
      <p>${escapeHTML(msg)}</p>
      <button onclick="window.location.href='home.html'">← Volver al inicio</button>
    </div>`;
}

// Exponer globalmente
window.toggleLike        = toggleLike;
window.toggleFav         = toggleFav;
window.agregarAPlan      = agregarAPlan;
window.eliminarComentario = eliminarComentario;

async function init() {
  await cargarUsuario();
  await cargarReceta();
}
init();
