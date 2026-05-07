// receta.js — CORREGIDO: campo es_premium correcto, imágenes y navegación
import { supabase } from './supabaseClient.js';

let recetaActual = null;
let currentUser  = null;

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;

function escapeHTML(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showToast(m, err = false) {
  let t = document.getElementById('receta-toast');
  if (!t) { t = document.createElement('div'); t.id = 'receta-toast'; t.className = 'notification-toast'; document.body.appendChild(t); }
  t.textContent = m;
  t.classList.toggle('error', err);
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function tienePermiso(u, p) {
  if (!u) return false;
  // Admins y Premium siempre tienen permiso (manejo flexible de tipos)
  const esPrem = u.es_premium === true || u.es_premium === 'true' || u.esPremium === true || u.esPremium === 'true';
  if (esPrem || u.rol === 'admin' || u.rol === 'premium') return true;
  
  const prefs = Array.isArray(u.preferencias) ? u.preferencias : [];
  if (prefs.length === 0) return false;
  
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = prefs.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  
  if (tag) {
    const parts = tag.split(':');
    if (parts.length < 2) return false;
    
    const expiraStr = parts[1];
    if (expiraStr === 'PERMANENT') return true;
    
    const expira = new Date(expiraStr);
    return expira > new Date();
  }
  return false;
}

function formatFecha(f) {
  const d = new Date(f), now = new Date(), diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-MX');
}

// Estado para Planificador
let diaPlanSeleccionado = null;
let comidaPlanSeleccionada = null;

// Cache de Recetas para velocidad
const cacheRecetas = {};

// ── Cargar usuario desde localStorage ─────────────────────────────────────────
async function cargarUsuario() {
  const userId = localStorage.getItem('userId');
  if (!userId) return;
  try {
    // Intentar con el id como UUID string
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).maybeSingle();
    if (data) {
      currentUser = data;
    } else {
      // Fallback a localStorage si falla la red o DB
      currentUser = {
        id: userId,
        es_premium: localStorage.getItem('userPremium') === 'true',
        rol: localStorage.getItem('userRol') || 'free',
        username: localStorage.getItem('userName')
      };
    }
  } catch (e) {
    console.warn('Fallback a localStorage:', e);
    let prefs = [];
    try { prefs = JSON.parse(localStorage.getItem('userPrefs') || '[]'); } catch { prefs = []; }
    
    currentUser = {
      id: userId,
      es_premium: localStorage.getItem('userPremium') === 'true',
      rol: localStorage.getItem('userRol') || 'free',
      username: localStorage.getItem('userName'),
      preferencias: prefs
    };
  }
}

// ── Cargar receta ──────────────────────────────────────────────────────────────
async function cargarReceta() {
  const id        = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('receta-container');
  if (!id) { mostrarError('No se especificó la receta'); return; }

  // OPTIMIZACIÓN: Cargar desde cache si existe
  const cached = localStorage.getItem(`recipe_${id}`);
  if (cached) {
    try {
      recetaActual = JSON.parse(cached);
      renderizarReceta(recetaActual);
      cargarComentarios(id);
    } catch(e) {}
  } else {
    container.innerHTML = `<div class="receta-loading"><div class="loading-spinner"></div><p>Cargando...</p></div>`;
  }

  try {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(`/api/recipes/${id}`, { headers });
    if (!response.ok) {
      if (response.status === 403) throw new Error('Esta receta es exclusiva para usuarios Premium 👑');
      throw new Error('Error al conectar con el servidor');
    }
    
    const freshData = await response.json();
    
    // Solo actualizar si no hay cache o los datos cambiaron
    if (!recetaActual || JSON.stringify(freshData) !== JSON.stringify(recetaActual)) {
      recetaActual = freshData;
      try {
        localStorage.setItem(`recipe_${id}`, JSON.stringify(freshData));
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn('Almacenamiento lleno, no se guardó el cache de esta receta');
          // No borrar todo para no cerrar sesión
        }
      }
      renderizarReceta(recetaActual);
      cargarComentarios(id);
    }
  } catch (error) {
    console.error('Error cargando receta:', error);
    if (!recetaActual) mostrarError(error.message || 'Error al cargar la receta');
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
      await supabase.rpc('eliminar_like', { p_receta_id: recetaActual.id, p_usuario_id: userId });
    } else {
      await supabase.rpc('agregar_like',  { p_receta_id: recetaActual.id, p_usuario_id: userId });
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
// Registrar vista en historial usando la API del backend
async function registrarVista(id) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch('/api/users/me/history', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipeId: id })
    });
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
    const response = await fetch(`/api/recipes/${recipeId}/comments`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    
    if (response.status === 403) {
      lista.innerHTML = ''; // Limpiar si es premium lock
      return;
    }
    
    if (!response.ok) throw new Error('Error en API de comentarios');
    
    const allComments = await response.json();

    if (!allComments?.length) {
      lista.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">Sin comentarios aún. ¡Sé el primero!</div>';
      return;
    }

    // Construir árbol en memoria
    const padres = allComments.filter(c => !c.padre_id);
    const hijosPorPadre = {};
    
    allComments.filter(c => c.padre_id).forEach(c => {
      if (!hijosPorPadre[c.padre_id]) hijosPorPadre[c.padre_id] = [];
      hijosPorPadre[c.padre_id].push(c);
    });

    lista.innerHTML = padres.map(p => renderComentario(p, hijosPorPadre[p.id] || [])).join('');
  } catch (e) {
    console.error('Error cargando comentarios:', e);
    lista.innerHTML = '<div style="color:#e53935;text-align:center;">Error al cargar comentarios</div>';
  }
}

let comentarioPadreId = null;

// Renderizar comentario individual
function renderComentario(comentario, respuestas = []) {
  const uname = comentario.usuario?.username || comentario.usuario?.nombre || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = comentario.usuario?.foto_perfil;
  const autorPremium = comentario.usuario?.es_premium || comentario.usuario?.rol === 'premium' || false;
  const autorBadge = autorPremium ? '<span style="font-size:0.7rem">👑</span>' : '<span style="font-size:0.7rem">🆓</span>';
  const userId = localStorage.getItem('userId');
  const esPropio = userId && String(comentario.usuario_id) === String(userId);
  const puedeResponder = currentUser?.es_premium || currentUser?.rol === 'premium' || false;
  
  const avatarHTML = foto
    ? `<img src="${foto}" alt="${escapeHTML(uname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div class="avatar-placeholder">${inicial}</div>`;
  
  let respuestasHTML = '';
  if (respuestas.length > 0) {
    respuestasHTML = `
      <div style="margin-top: 12px; margin-left: 32px; border-left: 2px solid #eee; padding-left: 10px;">
        ${respuestas.map(r => renderComentarioRespuesta(r)).join('')}
      </div>
    `;
  }
  
  return `
    <div class="comentario-item" data-id="${comentario.id}" style="display: flex; gap: 12px; align-items: flex-start;">
      <div class="comentario-avatar" style="width: 40px; height: 40px; flex-shrink: 0;">${avatarHTML}</div>
      <div class="comentario-contenido" style="flex: 1; min-width: 0;">
        <div class="comentario-header" style="display: flex; justify-content: space-between;">
          <strong>${escapeHTML(uname)} ${autorBadge}</strong>
          <small>${formatFecha(comentario.fecha)}</small>
        </div>
        <p style="font-style: ${comentario.texto === '🚫 [Comentario eliminado]' ? 'italic' : 'normal'}; color: ${comentario.texto === '🚫 [Comentario eliminado]' ? '#999' : 'inherit'};">${escapeHTML(comentario.texto)}</p>
        <div class="comentario-acciones" style="display:flex; gap:10px; margin-top:5px;">
          ${puedeResponder && comentario.texto !== '🚫 [Comentario eliminado]' ? `<button style="background:none;border:none;color:#4caf50;cursor:pointer;font-size:0.85rem;" onclick="window.abrirResponder(${comentario.id}, '${escapeHTML(uname)}')">💬 Responder</button>` : ''}
          ${esPropio && comentario.texto !== '🚫 [Comentario eliminado]' ? `<button style="background:none;border:none;color:#e53935;cursor:pointer;font-size:0.85rem;" onclick="window.eliminarComentario(${comentario.id})">🗑️ Eliminar</button>` : ''}
        </div>
        ${respuestasHTML}
      </div>
    </div>
  `;
}

function renderComentarioRespuesta(respuesta) {
  const uname = respuesta.usuario?.username || respuesta.usuario?.nombre || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = respuesta.usuario?.foto_perfil;
  const autorPremium = respuesta.usuario?.es_premium || respuesta.usuario?.rol === 'premium' || false;
  const autorBadge = autorPremium ? '👑' : '🆓';
  const userId = localStorage.getItem('userId');
  const esPropio = userId && String(respuesta.usuario_id) === String(userId);
  
  const avatarHTML = foto
    ? `<img src="${foto}" alt="${escapeHTML(uname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div class="avatar-placeholder">${inicial}</div>`;
  
  return `
    <div class="comentario-item respuesta" data-id="${respuesta.id}" style="margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
      <div class="comentario-avatar" style="width: 30px; height: 30px; flex-shrink: 0;">${avatarHTML}</div>
      <div class="comentario-contenido">
        <div class="comentario-header">
          <strong>${escapeHTML(uname)} <span style="font-size:0.7rem">${autorBadge}</span></strong>
          <small>${formatFecha(respuesta.fecha)}</small>
        </div>
        <p style="font-style: ${respuesta.texto === '🚫 [Comentario eliminado]' ? 'italic' : 'normal'}; color: ${respuesta.texto === '🚫 [Comentario eliminado]' ? '#999' : 'inherit'};">${escapeHTML(respuesta.texto)}</p>
        <div class="comentario-acciones" style="margin-top:5px;">
          ${esPropio && respuesta.texto !== '🚫 [Comentario eliminado]' ? `<button style="background:none;border:none;color:#e53935;cursor:pointer;font-size:0.85rem;" onclick="window.eliminarComentario(${respuesta.id})">🗑️ Eliminar</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Abrir modal para responder
window.abrirResponder = function(comentarioId, autorNombre) {
  if (!currentUser) {
    showToast('Inicia sesión para responder', true);
    return;
  }
  
  const esPremium = currentUser.es_premium || currentUser.rol === 'premium';
  if (!esPremium) {
    showToast('⚠️ Solo usuarios Premium pueden responder comentarios.', true);
    return;
  }
  
  comentarioPadreId = comentarioId;
  const contexto = document.getElementById('respuesta-contexto');
  if (contexto) contexto.innerHTML = `<strong>Respondiendo a @${escapeHTML(autorNombre)}</strong>`;
  
  const txt = document.getElementById('respuesta-texto');
  if (txt) txt.value = '';
  
  const modal = document.getElementById('modal-respuesta');
  if (modal) modal.style.display = 'flex';
};

// Cerrar modal
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('close-respuesta-modal') || e.target.id === 'modal-respuesta') {
    const modal = document.getElementById('modal-respuesta');
    if (modal) modal.style.display = 'none';
  }
});

// Enviar respuesta
document.addEventListener('DOMContentLoaded', () => {
  const btnResp = document.getElementById('enviar-respuesta');
  if (btnResp) {
    btnResp.addEventListener('click', async () => {
      const texto = document.getElementById('respuesta-texto').value.trim();
      if (!texto) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;
      
      btnResp.disabled = true;
      btnResp.textContent = '...';
      
      try {
        const res = await fetch(`/api/recipes/${recetaActual.id}/comments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ texto, padre_id: comentarioPadreId })
        });
        
        if (!res.ok) throw new Error('Error al responder');
        
        showToast('💬 Respuesta publicada (+5 pts)');
        document.getElementById('modal-respuesta').style.display = 'none';
        await cargarComentarios(recetaActual.id);
        
      } catch (error) {
        console.error('Error al responder:', error);
        showToast('Error al publicar respuesta', true);
      } finally {
        btnResp.disabled = false;
        btnResp.textContent = 'Responder';
      }
    });
  }
});

async function enviarComentario() {
  const input = document.getElementById('nuevo-comentario');
  const texto = input?.value.trim();
  const token = localStorage.getItem('token');
  
  if (!token) { showToast('Debes iniciar sesión para comentar', true); return; }
  if (!texto) return;
  
  try {
    const res = await fetch(`/api/recipes/${recetaActual.id}/comments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ texto })
    });
    
    if (!res.ok) throw new Error('Error al comentar');
    
    input.value = '';
    showToast('💬 Comentario publicado (+5 pts)');
    await cargarComentarios(recetaActual.id);
    
    // Actualizar puntos en UI si es posible
    const puntosBadge = document.getElementById('puntos-badge');
    if (puntosBadge) {
      const current = parseInt(puntosBadge.textContent.replace(/\D/g, '')) || 0;
      puntosBadge.textContent = `⭐ ${current + 5} pts`;
    }
  } catch (error) {
    console.error(error);
    showToast('🔒 Opción bloqueada. ¡Cámbiate a Premium para participar!', true);
  }
}

async function eliminarComentario(cid) {
  if (!confirm('¿Eliminar comentario?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/comments/${cid}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al eliminar');
    
    // Optimizamos refrescando solo los comentarios, no la página
    await cargarComentarios(recetaActual.id);
    showToast('Comentario eliminado');
  } catch (error) { 
    console.error(error);
    showToast('Error al eliminar', true); 
  }
}

// ── Eliminar Receta ────────────────────────────────────────────────────────────
// Permite al creador eliminar su receta completamente
async function eliminarReceta(id) {
  if (!confirm('¿Estás SEGURO de que deseas eliminar esta receta permanentemente?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al eliminar');
    }
    showToast('Receta eliminada con éxito');
    setTimeout(() => window.location.href = 'home.html', 1500);
  } catch (error) {
    console.error(error);
    showToast(error.message, true);
  }
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
  const esPropio = userId && String(r.usuario_id) === String(userId);

  container.innerHTML = `
    <div class="receta-container" style="opacity:0; animation: fadeInUp 0.6s ease-out forwards;">
      <div class="receta-imagen">
        <img src="${imagenSrc}"
             alt="${escapeHTML(r.titulo)}"
             onerror="this.src='${PLACEHOLDER}'"
             loading="lazy">
      </div>
      
      ${!r.video_youtube && !r.video_url && r.autorRol === 'free' ? `
        <div class="free-note" style="background: #f5f5f5; padding: 10px; border-radius: 8px; margin: 10px 0; font-size: 0.85rem; color: #666; border-left: 4px solid #4caf50;">
          ℹ️ Receta compartida por usuario Free (Sin video)
        </div>
      ` : ''}

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
        <div class="receta-autor" ${r.usuario_id ? `onclick="window.location.href='perfil.html?id=${r.usuario_id}'"` : ''} style="${r.usuario_id ? 'cursor:pointer; color:#4caf50;' : 'color:#999;'}">👨‍🍳 ${escapeHTML(r.autor || 'Anónimo')}</div>

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
          
          ${esPropio ? `
          <button class="btn-eliminar-receta" onclick="window.eliminarReceta(${r.id})" style="background: #ffebee; color: #d32f2f; border: 1px solid #ffcdd2; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 5px; margin-left: auto;">
            🗑️ Eliminar Receta
          </button>
          ` : ''}
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
          ${(userId && tienePermiso(currentUser, 'comentarios')) ? `
            <div id="comentarios-lista" class="comentarios-lista">
              <div style="text-align:center;padding:20px;">Cargando comentarios...</div>
            </div>
            <div class="nuevo-comentario-area" style="display:flex;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #eee;">
              <textarea id="nuevo-comentario" 
                placeholder="Escribe un comentario..." 
                rows="2"
                style="flex:1;padding:12px;border:2px solid #e8f5e9;border-radius:16px;font-family:inherit;resize:none;outline:none;font-size:0.9rem;"></textarea>
              <button id="enviar-comentario-btn" onclick="window.enviarComentario()"
                style="padding:8px 20px;background:linear-gradient(135deg,#4caf50,#2e7d32);color:white;border:none;border-radius:30px;cursor:pointer;font-weight:500;white-space:nowrap;">
                Enviar
              </button>
            </div>` : userId ? `
            <div class="premium-lock-box" style="text-align:center;padding:40px 20px;background:#f9f9f9;border-radius:24px;margin-top:16px;border:2px dashed #4caf50;">
              <div style="font-size:3rem;margin-bottom:15px;">🔒</div>
              <h3 style="color:#1b5e20;margin-bottom:10px;">¡Únete a la conversación!</h3>
              <p style="margin:0;color:#666;font-size:0.95rem;line-height:1.5;">Los comentarios y consejos del Chef IA son exclusivos para usuarios <strong>Premium</strong> 👑</p>
              <button onclick="window.location.href='perfil.html'" style="margin-top:20px;padding:10px 25px;background:#4caf50;color:white;border:none;border-radius:20px;font-weight:600;cursor:pointer;transition:all .3s;">Actualizar a Premium</button>
            </div>` : `
            <p style="text-align:center;color:#aaa;margin-top:16px;padding:20px;background:#f5f5f5;border-radius:12px;">
              <a href="login.html" style="color:#4caf50;font-weight:600;">Inicia sesión</a> para ver y participar en los comentarios.
            </p>`}
        </div>
      </div>
    </div>`;

  // Formatear para que el frontend lo lea fácil
  // Ya no necesitamos addEventListener manual porque usamos onclick="window.enviarComentario()"
}

function mostrarError(msg) {
  const c = document.getElementById('receta-container');
  if (c) c.innerHTML = `
    <div class="error-message">
      <span class="error-icon">😕</span>
      <p>${escapeHTML(msg)}</p>
    </div>`;
}

// Formatear para que el frontend lo lea fácil
window.toggleLike = toggleLike;
window.toggleFav = toggleFav;
window.eliminarComentario = eliminarComentario;
window.eliminarReceta = eliminarReceta;
window.enviarComentario = enviarComentario;

// ── AGREGAR AL PLAN SEMANAL ──────────────────────────────────────────────────
async function guardarEnPlan(dia, comida) {
  const token = localStorage.getItem('token');
  if (!token || !recetaActual) {
    showToast('Error: Datos insuficientes', true);
    return;
  }

  // Feedback inmediato (Optimistic)
  const modal = document.getElementById('modal-plan');
  const originalContent = document.getElementById('plan-paso-2').innerHTML;
  document.getElementById('plan-paso-2').innerHTML = `<div style="text-align:center;padding:20px;"><div class="loading-spinner" style="width:30px;height:30px;"></div><p>Guardando en tu plan...</p></div>`;

  try {
    const resGet = await fetch('/api/users/me/planner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let planData = await resGet.json();
    let plan = planData.plan || {};

    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const comidas = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];
    
    dias.forEach(d => {
      if (!plan[d]) plan[d] = {};
      comidas.forEach(c => {
        if (!plan[d][c]) plan[d][c] = [];
      });
    });

    const existe = plan[dia][comida].some(r => r.id === recetaActual.id);
    if (existe) {
      showToast(`Esta receta ya está en tu plan del ${dia}`, true);
      modal.style.display = 'none';
      document.getElementById('plan-paso-2').innerHTML = originalContent;
      return;
    }

    plan[dia][comida].push({
      id: recetaActual.id,
      titulo: recetaActual.titulo,
      imagen: recetaActual.imagen,
      precio: recetaActual.precio,
      precio_numerico: recetaActual.precio_numerico || 0,
      tiempo: recetaActual.tiempo
    });

    const resPost = await fetch('/api/users/me/planner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });

    if (resPost.ok) {
      showToast(`✅ ¡Listo! Agregada al ${dia} (${comida})`);
      modal.style.display = 'none';
    } else {
      throw new Error('Error al guardar');
    }
  } catch (error) {
    console.error('Error planificador:', error);
    showToast('Error al actualizar el planificador', true);
  } finally {
    document.getElementById('plan-paso-2').innerHTML = originalContent;
    setupPlanEventListeners(); // Re-adjuntar eventos si el contenido cambió
  }
}

window.agregarAPlan = function() {
  if (!currentUser) {
    showToast('Inicia sesión para planificar comidas', true);
    return;
  }
  const modal = document.getElementById('modal-plan');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('plan-paso-1').style.display = 'block';
    document.getElementById('plan-paso-2').style.display = 'none';
  }
};

function setupPlanEventListeners() {
  // Delegación de eventos para los botones de día y comida
  const modal = document.getElementById('modal-plan');
  if (!modal) return;

  modal.onclick = (e) => {
    const btnDia = e.target.closest('.btn-dia');
    const btnComida = e.target.closest('.btn-comida');
    const btnCerrar = e.target.closest('.close-plan-modal');
    const btnVolver = e.target.closest('#btn-volver-paso-1');

    if (btnDia) {
      diaPlanSeleccionado = btnDia.dataset.dia;
      const nombresDias = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
      document.getElementById('texto-dia-seleccionado').textContent = `Agregando al ${nombresDias[diaPlanSeleccionado]}`;
      document.getElementById('plan-paso-1').style.display = 'none';
      document.getElementById('plan-paso-2').style.display = 'block';
    }
    
    if (btnComida) {
      const comida = btnComida.dataset.comida;
      guardarEnPlan(diaPlanSeleccionado, comida);
    }

    if (btnCerrar || e.target === modal) {
      modal.style.display = 'none';
    }

    if (btnVolver) {
      document.getElementById('plan-paso-1').style.display = 'block';
      document.getElementById('plan-paso-2').style.display = 'none';
    }
  };
}

async function init() {
  await cargarUsuario();
  await cargarReceta();
  setupPlanEventListeners();
}
init();
