// comunidad.js
import { supabase } from './supabaseClient.js';

const API_BASE = (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1"))
  ? window.location.origin + "/api"
  : window.location.origin + "/api";


let currentUser = null;
let recetas = [];
let recetasPopulares = [];
let comentariosRecientes = [];
let recetaModalId = null;
let comentarioPadreId = null;


const recetasContainer = document.getElementById('recetas-comunidad');
const popularesContainer = document.getElementById('recetas-populares');
const actividadContainer = document.getElementById('actividad-reciente');
const modalComentarios = document.getElementById('modal-comentarios');
const modalRespuesta = document.getElementById('modal-respuesta');

function actualizarScrollBody() {
  if (modalComentarios.classList.contains('active') || modalRespuesta.classList.contains('active')) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}


const PLACEHOLDER_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23FDFBF7'/%3E%3Ccircle cx='50' cy='38' r='20' fill='%23E07A5F'/%3E%3Cpath d='M20 90 c0-25 15-35 30-35 s30 10 30 35' fill='%23E07A5F'/%3E%3C/svg%3E`;

// Cargar usuario desde la API
async function cargarUsuario() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      currentUser = await res.json();

      return;
    }
  } catch (e) {
  }

  // Fallback: localStorage
  const userId = localStorage.getItem('userId');
  if (userId) {
    const isPremium = localStorage.getItem('userPremium');
    let prefs = [];
    try { prefs = JSON.parse(localStorage.getItem('userPrefs') || '[]'); } catch { prefs = []; }
    currentUser = {
      id: userId,
      es_premium: isPremium === 'true' || isPremium === true,
      rol: localStorage.getItem('userRol') || 'free',
      puntos: parseInt(localStorage.getItem('userPuntos') || 0),
      username: localStorage.getItem('userName'),
      preferencias: prefs
    };
  }
}


function showToast(msg, isError = false) {
  let t = document.getElementById('comunidad-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'comunidad-toast';
    t.className = 'notification-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = isError ? '#e53935' : '#E07A5F';
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 3000);
}


function escapeHTML(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tienePermiso(u, p) {
  if (!u) return false;
  const esPrem = u.es_premium === true || u.es_premium === 'true' || u.esPremium === true || u.esPremium === 'true';
  if (esPrem || u.rol === 'admin' || u.rol === 'premium') return true;
  
  const prefs = Array.isArray(u.preferencias) ? u.preferencias : [];
  if (prefs.length === 0) return false;
  
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = prefs.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  
  if (tag) {
    const colonIdx = tag.indexOf(':');
    if (colonIdx === -1) return false;
    
    const expiraStr = tag.substring(colonIdx + 1);
    if (expiraStr === 'PERMANENT') return true;
    
    const expira = new Date(expiraStr);
    return expira > new Date();
  }
  return false;
}


function formatFecha(f) {
  const d = new Date(f);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Recetas recientes
async function cargarRecetasRecientes() {
  if (!recetasContainer) return;
  recetasContainer.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const res = await fetch('/api/recipes?orden=reciente');
    const data = await res.json();
    recetas = data || [];
    renderizarRecetas(recetasContainer, recetas);
  } catch (error) {
    console.error('Error cargando recetas:', error);
    recetasContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#999">Error al cargar recetas</div>';
  }
}

// Recetas populares
async function cargarRecetasPopulares() {
  if (!popularesContainer) return;
  popularesContainer.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const res = await fetch('/api/recipes?orden=likes');
    const data = await res.json();
    recetasPopulares = data || [];
    renderizarRecetas(popularesContainer, recetasPopulares);
  } catch (error) {
    console.error('Error cargando recetas populares:', error);
    popularesContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#999">Error al cargar recetas</div>';
  }
}

// Actividad reciente
async function cargarActividadReciente() {
  if (!actividadContainer) return;
  actividadContainer.innerHTML = '<div class="loading-spinner"></div>';

  // Solo Premium puede ver la actividad
  const tieneAcceso = currentUser && (
    currentUser.es_premium === true ||
    currentUser.es_premium === 'true' ||
    currentUser.rol === 'premium' ||
    currentUser.rol === 'admin' ||
    tienePermiso(currentUser, 'comunidad')
  );

  if (!tieneAcceso) {
    actividadContainer.innerHTML = `
      <div class="premium-lock-box" style="text-align:center;padding:60px 20px;background:#FDFBF7;border-radius:24px;border:2px dashed #E07A5F;margin:20px 0;">
        <div style="font-size:3rem;margin-bottom:15px;color:#D95D39;"><i data-lucide="lock" style="width:64px;height:64px;"></i></div>
        <h3 style="color:#D95D39;margin-bottom:10px;">Actividad Exclusiva</h3>
        <p style="margin:0;color:#666;font-size:0.95rem;line-height:1.5;">
          La actividad de la comunidad y los comentarios son exclusivos para usuarios <strong>Premium</strong> <i data-lucide="crown" style="width:18px;height:18px;display:inline-block;vertical-align:middle;"></i>
        </p>
        <button onclick="window.location.href='perfil.html'" 
          style="margin-top:20px;padding:12px 30px;background:#E07A5F;color:white;border:none;border-radius:30px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
          Mejorar Cuenta <i data-lucide="arrow-right" style="width:18px;"></i>
        </button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/activity`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 403) {
      actividadContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:#FDFBF7;border-radius:24px;border:2px dashed #E07A5F;">
          <div style="font-size:3rem;color:#D95D39;"><i data-lucide="lock" style="width:64px;height:64px;"></i></div>
          <h3 style="color:#D95D39;margin-top:15px">Actividad Exclusiva Premium</h3>
          <p style="margin:10px 0;color:#666;font-size:0.95rem;line-height:1.5;">Actualiza tu cuenta para ver la actividad de la comunidad.</p>
          <button onclick="window.location.href='perfil.html'" class="tab-btn active" style="margin-top:20px;padding:12px 30px;border-radius:30px;background:#E07A5F;">Mejorar a Premium</button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    if (res.ok) {
      const data = await res.json();
      comentariosRecientes = data || [];
      renderizarActividad(comentariosRecientes);
    } else {
      throw new Error('Error en API');
    }
  } catch (e) {
    console.error('Error community activity:', e);
    actividadContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#999">Error al cargar la actividad de la comunidad.</div>';
  }
}
// Renderizar recetas
function renderizarRecetas(container, recetasList) {
  if (!container) return;
  
  if (!recetasList.length) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:#999">No hay recetas aún.</div>';
    return;
  }
  const puedeComentar = currentUser && (
    currentUser.es_premium === true ||
    currentUser.es_premium === 'true' ||
    currentUser.rol === 'premium' ||
    currentUser.rol === 'admin' ||
    tienePermiso(currentUser, 'comentarios')
  );
  
  container.innerHTML = recetasList.map(r => {
    const img = r.imagen || PLACEHOLDER_IMG;
    const likedClass = r.likedByUser ? 'liked' : '';
    const favClass = r.favoriteByUser ? 'favorited' : '';
    const autorPremium = r.usuario?.es_premium || false;
    const autorBadge = autorPremium 
      ? '<span class="autor-badge premium"><i data-lucide="crown"></i> Premium</span>' 
      : '<span class="autor-badge free">Free</span>';
    
 
    const comentarBtn = puedeComentar
      ? `<button class="comentar-btn" onclick="window.abrirComentarios(${r.id}, '${escapeHTML(r.titulo)}')"><i data-lucide="message-square"></i> Comentar</button>`
      : `<button class="comentar-btn comentar-bloqueado" onclick="window.mostrarBloqueoComentarios()" title="Solo Premium"><i data-lucide="lock"></i> Comentar</button>`;
    
    return `
      <div class="receta-comunidad-card" data-id="${r.id}" onclick="window.irAReceta(${r.id}, event)">
        <div class="receta-imagen-mini">
          <img src="${img}" alt="${escapeHTML(r.titulo)}" loading="lazy"
               onerror="this.src='${PLACEHOLDER_IMG}'">
        </div>
        <div class="receta-info-comunidad">
          <h3>${escapeHTML(r.titulo)}</h3>
          <p class="receta-autor" ${r.usuario_id || r.usuario?.id ? `onclick="event.stopPropagation(); window.location.href='perfil.html?id=${r.usuario_id || r.usuario?.id}'"` : ''} style="${r.usuario_id || r.usuario?.id ? 'cursor:pointer; color:#E07A5F;' : 'color:#999;'}">
            <i data-lucide="user"></i> ${escapeHTML(r.usuario?.username || 'Anónimo')}
            ${autorBadge}
          </p>
          <div class="receta-stats">
            <span class="receta-tiempo"><i data-lucide="clock"></i> ${escapeHTML(r.tiempo || '30 min')}</span>
            <span class="receta-precio"><i data-lucide="banknote"></i> ${escapeHTML(r.precio || '$$')}</span>
          </div>
          <div class="recipe-tags">
            ${(r.etiquetas || []).slice(0, 3).map(t => `<span class="recipe-tag">${escapeHTML(t)}</span>`).join('')}
          </div>
          <div class="acciones-comunidad" onclick="event.stopPropagation()">
            <button class="like-btn ${likedClass}"
              data-id="${r.id}" data-liked="${r.likedByUser ? '1' : '0'}"
              onclick="window.toggleLike(${r.id}, this)">
              <i data-lucide="heart"></i> <span class="like-count">${r.likes || 0}</span>
            </button>
            <button class="favorito-btn ${favClass}"
              data-id="${r.id}" data-fav="${r.favoriteByUser ? '1' : '0'}"
              onclick="window.toggleFavorito(${r.id}, this)">
              <i data-lucide="star"></i> ${r.favoriteByUser ? 'Guardado' : 'Guardar'}
            </button>
            ${comentarBtn}
          </div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}


function renderizarActividad(items) {
  if (!actividadContainer) return;
  if (!items.length) {
    actividadContainer.innerHTML = '<div style="text-align:center;padding:60px;color:#999">No hay actividad reciente.</div>';
    return;
  }
  
  actividadContainer.innerHTML = items.map(item => {
    const avatar = item.usuario?.foto_perfil 
      ? `<img src="${item.usuario.foto_perfil}" alt="${escapeHTML(item.usuario.username)}">`
      : `<div class="avatar-placeholder">${(item.usuario?.username?.charAt(0) || 'U').toUpperCase()}</div>`;
    
    const autorBadge = item.usuario?.es_premium ? '<i data-lucide="crown"></i>' : '';
    
    let activityText = '';
    if (item.tipo === 'comentario') {
      activityText = `comentó: "${escapeHTML(item.texto.substring(0, 80))}${item.texto.length > 80 ? '...' : ''}"`;
    } else if (item.tipo === 'like') {
      activityText = `le dio <i data-lucide="heart" style="fill:#E07A5F;color:#E07A5F;display:inline-block;"></i> a <strong>${escapeHTML(item.receta?.titulo || 'una receta')}</strong>`;
    } else if (item.tipo === 'receta') {
      activityText = `publicó una nueva receta: <strong>${escapeHTML(item.receta?.titulo || 'Sin título')}</strong>`;
    }

    return `
      <div class="actividad-item" onclick="window.location.href='receta.html?id=${item.receta?.id || ''}'" style="cursor:pointer;">
        <div class="actividad-avatar">${avatar}</div>
        <div class="actividad-contenido">
          <div class="actividad-header">
            <span class="actividad-autor" style="color:#E07A5F;">
              ${escapeHTML(item.usuario?.username || 'Usuario')} 
              <span style="display:inline-block;vertical-align:middle;">${autorBadge}</span>
            </span>
            <span class="actividad-fecha">${formatFecha(item.fecha)}</span>
          </div>
          <div class="actividad-texto">${activityText}</div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarActividadPersonal(activity) {
  if (!actividadContainer) return;
  actividadContainer.innerHTML = '<h4 style="margin-bottom:15px; color:#D95D39">Tu actividad reciente:</h4>' + activity.map(a => {
    const iconos = { like: 'heart', favorito: 'star', comentario: 'message-square', receta: 'file-text', punto: 'award' };
    return `
      <div class="actividad-item personal">
        <div class="actividad-icon" style="font-size:1.5rem; margin-right:15px; color:#E07A5F;"><i data-lucide="${iconos[a.tipo] || 'pin'}"></i></div>
        <div class="actividad-contenido">
          <div class="actividad-texto">${escapeHTML(a.texto)}</div>
          <div class="actividad-fecha" style="font-size:0.8rem; color:#666">${formatFecha(a.fecha)}</div>
          ${a.id ? `<button onclick="window.location.href='receta.html?id=${a.id}'" style="border:none; background:none; color:#E07A5F; cursor:pointer; padding:0; font-size:0.8rem; margin-top:5px; font-weight:600;">Ver receta →</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}


async function toggleLike(recipeId, btn) {
  if (!currentUser) {
    showToast('Inicia sesión para dar like', true);
    return;
  }
  const token = localStorage.getItem('token');
  const liked = btn.dataset.liked === '1';
  const countEl = btn.querySelector('.like-count');
  btn.disabled = true;
  const oldCount = parseInt(countEl.textContent) || 0;
  countEl.textContent = liked ? Math.max(oldCount - 1, 0) : oldCount + 1;
  btn.classList.toggle('liked', !liked);
  btn.dataset.liked = liked ? '0' : '1';
  try {
    const res = await fetch(`${API_BASE}/recipes/${recipeId}/like`, {
      method: liked ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error');
    const data = await res.json();
    if (data.likes !== undefined) countEl.textContent = data.likes;
    showToast(liked ? 'Like eliminado' : '¡Like!');
  } catch (error) {
    countEl.textContent = oldCount;
    btn.classList.toggle('liked', liked);
    btn.dataset.liked = liked ? '1' : '0';
    showToast('Error al procesar like', true);
  } finally {
    btn.disabled = false;
  }
}


async function toggleFavorito(recipeId, btn) {
  if (!currentUser) {
    showToast('Inicia sesión para guardar favoritos', true);
    return;
  }
  const token = localStorage.getItem('token');
  const fav = btn.dataset.fav === '1';
  btn.disabled = true;
  btn.classList.toggle('favorited', !fav);
  btn.innerHTML = `<i data-lucide="star"></i> ${!fav ? 'Guardado' : 'Guardar'}`;
  btn.dataset.fav = fav ? '0' : '1';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  try {
    const res = await fetch(`${API_BASE}/recipes/${recipeId}/favorite`, {
      method: fav ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error');
    showToast(fav ? 'Eliminado de favoritos' : 'Guardado en favoritos');
  } catch (error) {
    btn.classList.toggle('favorited', fav);
    btn.innerHTML = `<i data-lucide="star"></i> ${fav ? 'Guardado' : 'Guardar'}`;
    btn.dataset.fav = fav ? '1' : '0';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    showToast('Error al procesar favorito', true);
  } finally {
    btn.disabled = false;
  }
}


async function abrirComentarios(recipeId, titulo) {
  recetaModalId = recipeId;
  comentarioPadreId = null;
  document.getElementById('modal-comentarios-titulo').innerHTML = `<i data-lucide="message-circle"></i> ${escapeHTML(titulo)}`;
  
  const lista = document.getElementById('comentarios-lista');
  const inputArea = document.querySelector('.modal-input-area');
  
  modalComentarios.classList.add('active');
  actualizarScrollBody();
  
  if (!tienePermiso(currentUser, 'comentarios')) {
    lista.innerHTML = `
      <div class="premium-lock-box" style="text-align:center;padding:40px 20px;background:#FDFBF7;border-radius:24px;margin-top:16px;border:2px dashed #E07A5F;">
        <div style="font-size:3rem;margin-bottom:15px;color:#D95D39;"><i data-lucide="lock" style="width:48px;height:48px;"></i></div>
        <h3 style="color:#D95D39;margin-bottom:10px;">¡Únete a la conversación!</h3>
        <p style="margin:0;color:#666;font-size:0.95rem;line-height:1.5;">Los comentarios y consejos del Chef IA son exclusivos para usuarios <strong>Premium</strong> <i data-lucide="crown" style="width:18px;height:18px;display:inline-block;vertical-align:middle;"></i></p>
        <button onclick="window.location.href='perfil.html'" style="margin-top:20px;padding:12px 25px;background:#E07A5F;color:white;border:none;border-radius:25px;font-weight:600;cursor:pointer;transition:all .3s;">Actualizar a Premium</button>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (inputArea) inputArea.style.display = 'none';
    return;
  }
  
  if (inputArea) inputArea.style.display = 'flex';
  document.getElementById('nuevo-comentario').value = '';
  await cargarComentarios(recipeId);
}


async function cargarComentarios(recipeId) {
  const lista = document.getElementById('comentarios-lista');
  lista.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Cargando…</div>';
  
  try {
    const res = await fetch(`${API_BASE}/recipes/${recipeId}/comments`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    
    if (res.status === 403) {
      lista.innerHTML = '';
      return;
    }
    
    if (!res.ok) throw new Error('Error al cargar comentarios');
    
    const allComments = await res.json();
    
    if (!allComments?.length) {
      lista.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa">Sin comentarios. ¡Sé el primero! <i data-lucide="message-square-plus" style="width:24px;display:inline-block;vertical-align:middle;"></i></div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }
    
    // Organizar comentarios en árbol padre-hijo
    const padres = allComments.filter(c => !c.padre_id);
    const hijosPorPadre = {};
    
    allComments.filter(c => c.padre_id).forEach(c => {
      if (!hijosPorPadre[c.padre_id]) hijosPorPadre[c.padre_id] = [];
      hijosPorPadre[c.padre_id].push(c);
    });
    
    lista.innerHTML = padres.map(p => renderComentario(p, hijosPorPadre[p.id] || [])).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
  } catch (error) {
    console.error('Error cargando comentarios:', error);
    lista.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Error al cargar comentarios</div>';
  }
}


function renderComentario(comentario, respuestas = []) {
  const uname = comentario.usuario?.username || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = comentario.usuario?.foto_perfil;
  const autorPremium = comentario.usuario?.es_premium || false;
  const autorBadge = autorPremium ? '<i data-lucide="crown" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i>' : '';
  const esPropio = currentUser && comentario.usuario?.id === currentUser.id;
  const puedeResponder = currentUser?.es_premium || tienePermiso(currentUser, 'comentarios') || false;
  
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
    <div class="comentario-item" data-id="${comentario.id}">
      <div class="comentario-avatar" style="width: 40px; height: 40px; flex-shrink: 0;">${avatarHTML}</div>
      <div class="comentario-contenido">
        <div class="comentario-header">
          <strong>${escapeHTML(uname)} ${autorBadge}</strong>
          <small>${formatFecha(comentario.fecha)}</small>
        </div>
        <p style="font-style: ${comentario.texto === '🚫 [Comentario eliminado]' ? 'italic' : 'normal'}; color: ${comentario.texto === '🚫 [Comentario eliminado]' ? '#999' : 'inherit'};">${escapeHTML(comentario.texto)}</p>
        <div class="comentario-acciones">
          ${puedeResponder && comentario.texto !== '🚫 [Comentario eliminado]' ? `<button class="btn-responder" onclick="window.abrirResponder(${comentario.id}, '${escapeHTML(uname)}')"><i data-lucide="message-circle"></i> Responder</button>` : ''}
          ${esPropio && comentario.texto !== '🚫 [Comentario eliminado]' ? `<button class="btn-eliminar-comentario" onclick="window.eliminarComentario('${comentario.id}', this)"><i data-lucide="trash-2"></i></button>` : ''}
        </div>
        ${respuestasHTML}
      </div>
    </div>
  `;
}

function renderComentarioRespuesta(respuesta) {
  const uname = respuesta.usuario?.username || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = respuesta.usuario?.foto_perfil;
  const autorPremium = respuesta.usuario?.es_premium || false;
  const autorBadge = autorPremium ? '<i data-lucide="crown" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i>' : '';
  const esPropio = currentUser && respuesta.usuario?.id === currentUser.id;
  
  const avatarHTML = foto
    ? `<img src="${foto}" alt="${escapeHTML(uname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div class="avatar-placeholder">${inicial}</div>`;
  
  return `
    <div class="comentario-item respuesta" data-id="${respuesta.id}" style="margin-top: 10px;">
      <div class="comentario-avatar" style="width: 30px; height: 30px; flex-shrink: 0;">${avatarHTML}</div>
      <div class="comentario-contenido">
        <div class="comentario-header">
          <strong>${escapeHTML(uname)} <span style="font-size:0.7rem">${autorBadge}</span></strong>
          <small>${formatFecha(respuesta.fecha)}</small>
        </div>
        <p style="font-style: ${respuesta.texto === '🚫 [Comentario eliminado]' ? 'italic' : 'normal'}; color: ${respuesta.texto === '🚫 [Comentario eliminado]' ? '#999' : 'inherit'};">${escapeHTML(respuesta.texto)}</p>
        <div class="comentario-acciones">
          ${esPropio && respuesta.texto !== '🚫 [Comentario eliminado]' ? `<button class="btn-eliminar-comentario" onclick="window.eliminarComentario('${respuesta.id}', this)"><i data-lucide="trash-2"></i></button>` : ''}
        </div>
      </div>
    </div>
  `;
}


function abrirResponder(comentarioId, autorNombre) {
  if (!currentUser) {
    showToast('Inicia sesión para responder', true);
    return;
  }
  
  if (!currentUser.es_premium && !tienePermiso(currentUser, 'comentarios')) {
    showToast('⚠️ Solo usuarios Premium o con pase de comentarios pueden responder comentarios. ¡Mejora tu cuenta!', true);
    const restrictionDiv = document.createElement('div');
    restrictionDiv.className = 'restriction-message';
    restrictionDiv.innerHTML = `
      <p><i data-lucide="lock"></i> Solo usuarios Premium o con pase de comentarios pueden participar en conversaciones.</p>
      <a href="perfil.html" class="premium-link"><i data-lucide="sparkles"></i> Obtener pase / Premium</a>
    `;
    modalRespuesta.querySelector('.respuesta-contexto').innerHTML = '';
    modalRespuesta.querySelector('.respuesta-contexto').appendChild(restrictionDiv);
    modalRespuesta.classList.add('active');
    actualizarScrollBody();
    return;
  }
  
  comentarioPadreId = comentarioId;
  const contexto = document.getElementById('respuesta-contexto');
  contexto.innerHTML = `<strong>Respondiendo a @${escapeHTML(autorNombre)}</strong>`;
  document.getElementById('respuesta-texto').value = '';
  modalRespuesta.classList.add('active');
  actualizarScrollBody();
}


async function enviarRespuesta() {
  const texto = document.getElementById('respuesta-texto').value.trim();
  if (!texto) {
    showToast('Escribe una respuesta', true);
    return;
  }
  
  if (!currentUser?.es_premium && !tienePermiso(currentUser, 'comentarios')) {
    showToast('Solo usuarios Premium o con pase de comentarios pueden responder', true);
    modalRespuesta.classList.remove('active');
    actualizarScrollBody();
    return;
  }
  
  const btn = document.getElementById('enviar-respuesta');
  btn.disabled = true;
  btn.textContent = '...';
  
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/recipes/${recetaModalId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ texto, padre_id: comentarioPadreId })
    });
    if (!res.ok) throw new Error('Error');
    showToast('Respuesta publicada');
    modalRespuesta.classList.remove('active');
    actualizarScrollBody();
    await cargarComentarios(recetaModalId);
  } catch (error) {
    console.error('Error al responder:', error);
    showToast('Error al publicar respuesta', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Responder';
  }
}


async function enviarComentario() {
  if (!currentUser) {
    showToast('Inicia sesión para comentar', true);
    return;
  }
  
  const input = document.getElementById('nuevo-comentario');
  const texto = input.value.trim();
  if (!texto) {
    showToast('Escribe un comentario', true);
    return;
  }
  
  const btn = document.getElementById('enviar-comentario');
  btn.disabled = true;
  btn.textContent = '...';
  
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/recipes/${recetaModalId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ texto, padre_id: null })
    });
    if (!res.ok) throw new Error('Error');
    input.value = '';
    showToast('Comentario publicado');
    await cargarComentarios(recetaModalId);
  } catch (error) {
    console.error('Error al publicar:', error);
    showToast('Opción bloqueada. ¡Cámbiate a Premium para participar!', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
}


async function eliminarComentario(commentId, btn) {
  if (!confirm('¿Eliminar este comentario?')) return;
  
  btn.disabled = true;
  
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error');
    showToast('Comentario eliminado');
    await cargarComentarios(recetaModalId);
  } catch (error) {
    console.error('Error al eliminar:', error);
    showToast('Error al eliminar', true);
    btn.disabled = false;
  }
}


function cerrarModal() {
  modalComentarios.classList.remove('active');
  recetaModalId = null;
  actualizarScrollBody();
}

function cerrarModalRespuesta() {
  modalRespuesta.classList.remove('active');
  comentarioPadreId = null;
  actualizarScrollBody();
}


function irAReceta(id, event) {
  if (event?.target?.closest('.acciones-comunidad')) return;
  window.location.href = `receta.html?id=${id}`;
}


function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const tabName = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      if (tabName === 'recetas') {
        document.getElementById('recetas-tab').style.display = 'block';
        if (recetas.length === 0) await cargarRecetasRecientes();
      } else if (tabName === 'populares') {
        document.getElementById('populares-tab').style.display = 'block';
        if (recetasPopulares.length === 0) await cargarRecetasPopulares();
      } else if (tabName === 'comentarios') {
        document.getElementById('comentarios-tab').style.display = 'block';
        if (comentariosRecientes.length === 0) await cargarActividadReciente();
      }
    });
  });
}


async function init() {
  await cargarUsuario();
  await cargarRecetasRecientes();
  await cargarRecetasPopulares();
  await cargarActividadReciente();
  initTabs();
  

  document.querySelector('#modal-comentarios .close-modal')?.addEventListener('click', cerrarModal);
  document.querySelector('#modal-respuesta .close-respuesta-modal')?.addEventListener('click', cerrarModalRespuesta);
  document.getElementById('enviar-comentario')?.addEventListener('click', enviarComentario);
  document.getElementById('enviar-respuesta')?.addEventListener('click', enviarRespuesta);
  document.getElementById('nuevo-comentario')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarComentario();
    }
  });
  document.getElementById('respuesta-texto')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarRespuesta();
    }
  });
  
  window.addEventListener('click', e => {
    if (e.target === modalComentarios) cerrarModal();
    if (e.target === modalRespuesta) cerrarModalRespuesta();
  });
}


function mostrarBloqueoComentarios() {
  showToast('Los comentarios son exclusivos para usuarios Premium', true);
}

// Funciones globales
window.toggleLike = toggleLike;
window.toggleFavorito = toggleFavorito;
window.abrirComentarios = abrirComentarios;
window.eliminarComentario = eliminarComentario;
window.irAReceta = irAReceta;
window.abrirResponder = abrirResponder;
window.mostrarBloqueoComentarios = mostrarBloqueoComentarios;

init();

// Lógica de ocultado automático de la navegación al scroll
(function() {
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
      nav.classList.add('nav-hidden');
    } else {
      nav.classList.remove('nav-hidden');
    }
    lastScrollY = window.scrollY;
  });
})();
