// receta.js
import { supabase } from './supabaseClient.js';

let recetaActual = null;
let currentUser = null;

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23FDFBF7'/%3E%3Cpath d='M30 70 h40 v-5 a20 20 0 0 0 -40 0 z' fill='%23E07A5F'/%3E%3C/svg%3E`;

function escapeHTML(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(m, err = false) {
  let t = document.getElementById('receta-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'receta-toast';
    t.className = 'notification-toast';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.classList.toggle('error', err);
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function tienePermiso(u, p) {
  if (!u) return false;
  const esPrem = u.es_premium === true || u.es_premium === 'true' || u.esPremium === true;
  if (esPrem || u.rol === 'admin' || u.rol === 'premium') return true;
  const prefs = Array.isArray(u.preferencias) ? u.preferencias : [];
  const tagPrefix = `PERMISO_${p.toUpperCase()}:`;
  const tag = prefs.find(pref => typeof pref === 'string' && pref.startsWith(tagPrefix));
  if (tag) {
    const parts = tag.split(':');
    if (parts.length < 2) return false;
    const expiraStr = parts[1];
    if (expiraStr === 'PERMANENT') return false;
    return new Date(expiraStr) > new Date();
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

let diaPlanSeleccionado = null;
let comentarioPadreId = null;

async function cargarUsuario() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  try {
    if (token) {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        currentUser = await res.json();
        return;
      }
    }
    const { data } = await supabase.from('usuarios').select('*').eq('id', userId).maybeSingle();
    if (data) { currentUser = data; return; }
  } catch (e) {
    console.warn('Fallback a localStorage:', e);
  }

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

async function cargarReceta() {
  const id = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('receta-container');
  if (!id) { mostrarError('No se especificó la receta'); return; }

  const cached = localStorage.getItem(`recipe_${id}`);
  if (cached) {
    try {
      recetaActual = JSON.parse(cached);
      renderizarReceta(recetaActual);
      cargarComentarios(id);
    } catch (e) { }
  } else {
    container.innerHTML = `<div class="receta-loading"><div class="loading-spinner"></div><p>Cargando...</p></div>`;
  }

  try {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await fetch(`/api/recipes/${id}`, { headers });

    if (!response.ok) {
      if (response.status === 403) throw new Error('Esta receta es exclusiva para usuarios Premium');
      throw new Error('Error al conectar con el servidor');
    }

    const freshData = await response.json();
    if (!recetaActual || JSON.stringify(freshData) !== JSON.stringify(recetaActual)) {
      recetaActual = freshData;
      try { localStorage.setItem(`recipe_${id}`, JSON.stringify(freshData)); }
      catch (e) { if (e.name !== 'QuotaExceededError') throw e; }
      renderizarReceta(recetaActual);
      cargarComentarios(id);
    }
    registrarVista(id);
  } catch (error) {
    console.error('Error cargando receta:', error);
    if (!recetaActual) mostrarError(error.message || 'Error al cargar la receta');
  }
}

async function toggleLike() {
  const token = localStorage.getItem('token');
  if (!token) { showToast('Inicia sesión para dar like', true); return; }

  const badge   = document.querySelector('.meta-badge.likes');
  const countEl = document.getElementById('like-count-badge');
  if (!badge || !countEl) return;

  const liked   = badge.classList.contains('active');
  const old     = parseInt(countEl.textContent) || 0;
  
  // Optimistic UI
  countEl.textContent = liked ? Math.max(old - 1, 0) : old + 1;
  badge.classList.toggle('active', !liked);

  try {
    const method = liked ? 'DELETE' : 'POST';
    const res = await fetch(`/api/recipes/${recetaActual.id}/like`, {
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error al procesar like');
    
    const data = await res.json();
    if (data.likes !== undefined) countEl.textContent = data.likes;
    showToast(liked ? 'Like eliminado' : '¡Me gusta!');
  } catch (e) {
    countEl.textContent = old;
    badge.classList.toggle('active', liked);
    showToast(e.message || 'Error al conectar con el servidor', true);
  }
}

async function toggleFav() {
  const token = localStorage.getItem('token');
  if (!token) { showToast('Inicia sesión para guardar', true); return; }

  const badge = document.querySelector('.meta-badge.favorite');
  if (!badge) return;

  const fav = badge.classList.contains('active');
  badge.classList.toggle('active', !fav);
  
  // Actualizar texto si existe
  const label = badge.querySelector('span');
  if (label) label.textContent = fav ? 'Guardar' : 'Guardado';

  try {
    const method = fav ? 'DELETE' : 'POST';
    const res = await fetch(`/api/recipes/${recetaActual.id}/favorite`, {
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error del servidor');
    showToast(fav ? 'Eliminado de favoritos' : 'Guardado en favoritos');
  } catch (e) {
    badge.classList.toggle('active', fav);
    if (label) label.textContent = fav ? 'Guardado' : 'Guardar';
    showToast(e.message || 'Error al actualizar favoritos', true);
  }
}

async function registrarVista(id) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch('/api/users/me/history', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: parseInt(id) })
    });
  } catch { }
}

async function cargarComentarios(recipeId) {
  const lista = document.getElementById('comentarios-lista');
  if (!lista) return;
  try {
    const response = await fetch(`/api/recipes/${recipeId}/comments`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (response.status === 403) { lista.innerHTML = ''; return; }
    if (!response.ok) throw new Error('Error en API de comentarios');

    const allComments = await response.json();
    if (!allComments?.length) {
      lista.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">Sin comentarios aún. ¡Sé el primero!</div>';
      return;
    }

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

function renderComentario(comentario, respuestas = []) {
  const uname = comentario.usuario?.username || comentario.usuario?.nombre || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = comentario.usuario?.foto_perfil;
  const autorPremium = comentario.usuario?.es_premium || comentario.usuario?.rol === 'premium' || false;
  const userId = localStorage.getItem('userId');
  const esPropio = userId && String(comentario.usuario_id) === String(userId);
  const puedeResponder = currentUser?.es_premium || currentUser?.rol === 'premium' || false;

  const avatarHTML = foto
    ? `<img src="${foto}" alt="${escapeHTML(uname)}" class="avatar-img">`
    : `<div class="avatar-placeholder" data-char="${inicial}">${inicial}</div>`;

  const respuestasHTML = respuestas.length > 0 ? `
    <div class="comentario-respuestas">
      ${respuestas.map(r => renderComentarioRespuesta(r)).join('')}
    </div>` : '';

  return `
    <div class="comentario-item" data-id="${comentario.id}">
      <div class="comentario-avatar-wrapper">${avatarHTML}</div>
      <div class="comentario-body">
        <div class="comentario-bubble">
          <div class="comentario-header">
            <span class="comentario-user">${escapeHTML(uname)} ${autorPremium ? '<i data-lucide="crown" class="crown-icon"></i>' : ''}</span>
            <span class="comentario-date">${formatFecha(comentario.fecha)}</span>
          </div>
          <p class="comentario-text">${escapeHTML(comentario.texto)}</p>
        </div>
        <div class="comentario-actions">
          ${puedeResponder && comentario.texto !== '🚫 [Comentario eliminado]'
      ? `<button class="action-btn reply" onclick="window.abrirResponder(${comentario.id}, '${escapeHTML(uname)}')"><i data-lucide="message-square"></i> Responder</button>`
      : ''}
          ${esPropio && comentario.texto !== '🚫 [Comentario eliminado]'
      ? `<button class="action-btn delete" onclick="window.eliminarComentario(${comentario.id})"><i data-lucide="trash-2"></i> Eliminar</button>`
      : ''}
        </div>
        ${respuestasHTML}
      </div>
    </div>`;
}

function renderComentarioRespuesta(respuesta) {
  const uname = respuesta.usuario?.username || respuesta.usuario?.nombre || 'Usuario';
  const inicial = uname[0].toUpperCase();
  const foto = respuesta.usuario?.foto_perfil;
  const autorPremium = respuesta.usuario?.es_premium || respuesta.usuario?.rol === 'premium' || false;
  const userId = localStorage.getItem('userId');
  const esPropio = userId && String(respuesta.usuario_id) === String(userId);

  const avatarHTML = foto
    ? `<img src="${foto}" alt="${escapeHTML(uname)}" class="avatar-img-sm">`
    : `<div class="avatar-placeholder-sm" data-char="${inicial}">${inicial}</div>`;

  return `
    <div class="comentario-item respuesta" data-id="${respuesta.id}">
      <div class="comentario-avatar-wrapper">${avatarHTML}</div>
      <div class="comentario-body">
        <div class="comentario-bubble reply-bubble">
          <div class="comentario-header">
            <span class="comentario-user">${escapeHTML(uname)} ${autorPremium ? '<i data-lucide="crown" class="crown-icon-sm"></i>' : ''}</span>
            <span class="comentario-date">${formatFecha(respuesta.fecha)}</span>
          </div>
          <p class="comentario-text">${escapeHTML(respuesta.texto)}</p>
        </div>
        <div class="comentario-actions">
          ${esPropio && respuesta.texto !== '🚫 [Comentario eliminado]'
      ? `<button class="action-btn delete" onclick="window.eliminarComentario(${respuesta.id})"><i data-lucide="trash-2"></i> Eliminar</button>`
      : ''}
        </div>
      </div>
    </div>`;
}

window.abrirResponder = function (comentarioId, autorNombre) {
  if (!currentUser) { showToast('Inicia sesión para responder', true); return; }
  const esPremium = currentUser.es_premium || currentUser.rol === 'premium';
  if (!esPremium) { showToast('Solo usuarios Premium pueden responder comentarios.', true); return; }

  comentarioPadreId = comentarioId;
  const textarea = document.getElementById('nuevo-comentario');
  if (textarea) {
    textarea.placeholder = `Respondiendo a @${autorNombre}...`;
    textarea.focus();
  }
  showToast(`Respondiendo a @${autorNombre}`);
};

window.enviarComentario = async function () {
  const textarea = document.getElementById('nuevo-comentario');
  const texto = textarea?.value.trim();
  if (!texto) return;

  const token = localStorage.getItem('token');
  if (!token) { showToast('Inicia sesión para comentar', true); return; }

  const id = new URLSearchParams(window.location.search).get('id');

  try {
    let res;
    if (comentarioPadreId) {
      res = await fetch(`/api/comments/${comentarioPadreId}/replies`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
      });
    } else {
      res = await fetch(`/api/recipes/${id}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
      });
    }

    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
    textarea.value = '';
    comentarioPadreId = null;
    textarea.placeholder = 'Escribe un comentario...';
    showToast('Comentario enviado');
    cargarComentarios(id);
  } catch (e) {
    showToast(e.message || 'Error al enviar comentario', true);
  }
};

window.eliminarComentario = async function (id) {
  if (!confirm('¿Eliminar comentario?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al eliminar');
    showToast('Comentario eliminado');
    const recetaId = new URLSearchParams(window.location.search).get('id');
    cargarComentarios(recetaId);
  } catch (e) { showToast(e.message, true); }
};

window.eliminarReceta = async function (id) {
  if (!confirm('¿Eliminar esta receta permanentemente?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al eliminar');
    showToast('Receta eliminada');
    setTimeout(() => window.location.href = 'home.html', 1500);
  } catch (e) { showToast(e.message, true); }
};

function renderizarReceta(r) {
  const container = document.getElementById('receta-container');
  if (!container) return;

  const userId = localStorage.getItem('userId');
  const esAutor = userId && r.usuario_id === userId;
  const ings = r.ingredientes ? r.ingredientes.split(/\n|,/).map(i => i.trim()).filter(Boolean) : [];
  const pasos = r.pasos ? r.pasos.split(/\n/).map(p => p.trim()).filter(Boolean) : [];
  const tagsHtml = (r.etiquetas || []).map(t => `<span class="recipe-tag">${escapeHTML(t)}</span>`).join('');

  const checkFav = async () => {
    if (!userId) return false;
    const { data } = await supabase.from('favoritos')
      .select('id').eq('usuario_id', userId).eq('receta_id', r.id).maybeSingle();
    return !!data;
  };

  const esPremiumUser = currentUser && (
    currentUser.es_premium === true ||
    currentUser.es_premium === 'true' ||
    currentUser.rol === 'premium' ||
    currentUser.rol === 'admin'
  );

  const videoHTML = (() => {
    if (!esPremiumUser) {
      if (r.video_youtube || r.video_url) {
        return `<div class="video-container" style="margin:20px 0;background:#FDFBF7;border-radius:16px;padding:30px;text-align:center;border:2px dashed #E07A5F;">
          <div style="font-size:2.5rem;margin-bottom:10px;"><i data-lucide="lock" style="width:48px;height:48px;color:#D95D39;"></i></div>
          <p style="color:#D95D39;font-weight:600;margin:0 0 8px;">Video exclusivo Premium</p>
          <p style="color:#666;font-size:0.9rem;margin:0 0 16px;">Actualiza tu cuenta para ver el video de esta receta.</p>
          <button onclick="window.location.href='perfil.html'" style="padding:10px 24px;background:#E07A5F;color:white;border:none;border-radius:20px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">Mejorar a Premium <i data-lucide="crown" style="width:18px;height:18px;"></i></button>
        </div>`;
      }
      return '';
    }
    if (r.video_youtube) {
      return `<div class="video-container" style="margin:20px 0;">
        <iframe width="100%" height="315" src="https://www.youtube.com/embed/${escapeHTML(r.video_youtube)}"
          frameborder="0" allowfullscreen style="border-radius:16px;"></iframe>
      </div>`;
    }
    if (r.video_url) {
      return `<div class="video-container" style="margin:20px 0;">
        <video controls style="width:100%;border-radius:16px;" src="${escapeHTML(r.video_url)}"></video>
      </div>`;
    }
    return '';
  })();

  container.innerHTML = `
    <div class="receta-detail">
      <div class="receta-header">
        <div class="receta-image-container">
          <img id="receta-img" src="${r.imagen || PLACEHOLDER}" alt="${escapeHTML(r.titulo)}"
               onerror="this.src='${PLACEHOLDER}'" style="width:100%;border-radius:24px;max-height:400px;object-fit:cover;">
          ${r.es_premium ? '<span class="badge-premium" style="position:absolute;top:16px;left:16px;display:flex;align-items:center;gap:6px;"><i data-lucide="crown"></i> Premium</span>' : ''}
        </div>
        ${videoHTML}

        <h1 style="margin:16px 0 8px;">${escapeHTML(r.titulo)}</h1>
        <p class="receta-autor" style="color:#888;margin:0 0 12px;">
          Por <a href="perfil.html?id=${r.usuario_id}" style="color:#E07A5F;font-weight:600;">
            ${escapeHTML(r.autor || 'Chef Foráneo')}
          </a>
        </p>

        <div class="recipe-tags-container">
          ${tagsHtml}
        </div>

        <div class="receta-actions" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
          <div class="meta-badge likes ${r.likedByUser ? 'active' : ''}" onclick="window.toggleLike()">
            <i data-lucide="heart"></i> <span id="like-count-badge">${r.likes || 0}</span>
          </div>
          <div class="meta-badge favorite ${r.favoriteByUser ? 'active' : ''}" onclick="window.toggleFav()">
            <i data-lucide="star"></i> <span>${r.favoriteByUser ? 'Guardado' : 'Guardar'}</span>
          </div>
          ${esAutor ? `
            <button onclick="window.location.href='subir-receta.html?edit=${r.id}'" class="btn-editar"
              style="padding:10px 20px;background:#E07A5F;color:white;border:none;border-radius:30px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              <i data-lucide="edit-3" style="width:18px;height:18px;"></i> Editar
            </button>
            <button onclick="window.eliminarReceta(${r.id})" class="btn-eliminar"
              style="padding:10px 20px;background:#e53935;color:white;border:none;border-radius:30px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              <i data-lucide="trash-2" style="width:18px;height:18px;"></i> Eliminar
            </button>
          ` : ''}
        </div>

        <div class="receta-info-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          <div class="info-card" style="background:#f5f5f5;border-radius:16px;padding:16px;text-align:center;">
            <div class="info-label" style="color:#888;font-size:0.75rem;text-transform:uppercase;">Costo</div>
            <div class="info-value" style="font-weight:700;font-size:1.1rem;">${escapeHTML(r.precio || '$$')}</div>
          </div>
          <div class="info-card" style="background:#f5f5f5;border-radius:16px;padding:16px;text-align:center;">
            <div class="info-label" style="color:#888;font-size:0.75rem;text-transform:uppercase;">Porciones</div>
            <div class="info-value" style="font-weight:700;font-size:1.1rem;">${escapeHTML(r.porciones || '2–4')}</div>
          </div>
          <div class="info-card" style="background:#f5f5f5;border-radius:16px;padding:16px;text-align:center;">
            <div class="info-label" style="color:#888;font-size:0.75rem;text-transform:uppercase;">Tiempo</div>
            <div class="info-value" style="font-weight:700;font-size:1.1rem;">${escapeHTML(r.tiempo || '30 min')}</div>
          </div>
        </div>
      </div>

      <div class="receta-body">
        <div class="seccion">
          <h2><i data-lucide="file-text"></i> Ingredientes</h2>
          <ul class="lista-ingredientes">
            ${ings.map(i => `<li style="display:flex;align-items:center;gap:8px;"><i data-lucide="chevron-right" style="color:#E07A5F;"></i> ${escapeHTML(i)}</li>`).join('')}
          </ul>
        </div>

        <div class="seccion">
          <h2><i data-lucide="chef-hat"></i> Preparación</h2>
          <div class="pasos-lista">
            ${pasos.map((p, idx) => {
              // Limpiar número al inicio del texto si existe (ej: "1. ", "1- ")
              const textoLimpio = p.replace(/^\d+[\s\.)\/-]+/, '');
              return `
                <div class="paso-item">
                  <div class="paso-numero">${idx + 1}</div>
                  <div class="paso-texto">${escapeHTML(textoLimpio)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <button class="btn-plan-semanal" onclick="window.agregarAPlan()" style="margin:20px 0;display:inline-flex;align-items:center;gap:8px;justify-content:center;">
          <i data-lucide="calendar"></i> Agregar al planificador
        </button>

        <div class="seccion">
          <h2>💬 Comentarios</h2>
          ${(userId && esPremiumUser) ? `
            <div id="comentarios-lista" class="comentarios-lista">
              <div class="comentarios-loading">Cargando comentarios...</div>
            </div>
            <div class="nuevo-comentario-wrapper">
              <div class="input-container">
                <textarea id="nuevo-comentario"
                  placeholder="Escribe un comentario..." rows="1"></textarea>
                <button id="enviar-comentario-btn" class="btn-send-comment" onclick="window.enviarComentario()">
                  <i data-lucide="send"></i>
                </button>
              </div>
            </div>` : userId ? `
            <div class="premium-lock-box" style="text-align:center;padding:40px 20px;background:#FDFBF7;border-radius:24px;margin-top:16px;border:2px dashed #E07A5F;">
              <div style="font-size:3rem;margin-bottom:15px;color:#D95D39;"><i data-lucide="lock" style="width:64px;height:64px;"></i></div>
              <h3 style="color:#D95D39;margin-bottom:10px;">¡Únete a la conversación!</h3>
              <p style="margin:0;color:#666;font-size:0.95rem;line-height:1.5;">
                Los comentarios son exclusivos para usuarios <strong>Premium</strong>
              </p>
              <button onclick="window.location.href='perfil.html'"
                style="margin-top:20px;padding:12px 30px;background:#E07A5F;color:white;border:none;border-radius:30px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                Actualizar a Premium <i data-lucide="crown" style="width:18px;height:18px;"></i>
              </button>
            </div>` : `
            <p style="text-align:center;color:#aaa;margin-top:16px;padding:20px;background:#f5f5f5;border-radius:12px;">
              <a href="login.html" style="color:#E07A5F;font-weight:600;">Inicia sesión</a> para participar en los comentarios.
            </p>`}
        </div>
      </div>
    </div>

    <div id="modal-plan" class="modal-overlay">
      <div class="modal-content">
        <div id="plan-paso-1">
          <h3 class="modal-title"><i data-lucide="calendar"></i> ¿Qué día?</h3>
          <div class="modal-grid">
            ${['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].map(d => `
              <button class="btn-dia" data-dia="${d}">
                ${d.charAt(0).toUpperCase()+d.slice(1)}
              </button>`).join('')}
          </div>
          <button class="close-plan-modal btn-cancelar">Cancelar</button>
        </div>
        <div id="plan-paso-2" style="display:none;">
          <h3 class="modal-title"><i data-lucide="utensils"></i> ¿Qué comida?</h3>
          <p id="texto-dia-seleccionado" class="modal-subtitle"></p>
          <div class="modal-grid">
            ${['desayuno','comida','cena','merienda','snack'].map(c => `
              <button class="btn-comida" data-comida="${c}">
                ${c.charAt(0).toUpperCase()+c.slice(1)}
              </button>`).join('')}
          </div>
          <button id="btn-volver-paso-1" class="btn-volver">← Volver</button>
        </div>
      </div>
    </div>`;

  // El estado de favorito ahora se carga directamente desde el objeto r (favoriteByUser)
  // No es necesario llamar a checkFav() aquí ya que lo seteamos arriba en el HTML del botón

  setupPlanEventListeners();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function guardarEnPlan(dia, comida) {
  const token = localStorage.getItem('token');
  if (!token || !recetaActual) { showToast('Error: Datos insuficientes', true); return; }

  const modal = document.getElementById('modal-plan');
  const paso2 = document.getElementById('plan-paso-2');
  const originalContent = paso2.innerHTML;
  paso2.innerHTML = `<div style="text-align:center;padding:20px;"><div class="loading-spinner" style="width:30px;height:30px;"></div><p>Guardando en tu plan...</p></div>`;

  try {
    const resGet = await fetch('/api/users/me/planner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const planData = await resGet.json();
    const plan = planData.plan || {};

    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(d => {
      if (!plan[d]) plan[d] = {};
      ['desayuno', 'comida', 'cena', 'merienda', 'snack'].forEach(c => {
        if (!plan[d][c]) plan[d][c] = [];
      });
    });

    const existe = plan[dia][comida].some(r => r.id === recetaActual.id);
    if (existe) {
      showToast(`Esta receta ya está en tu plan del ${dia}`, true);
      modal.style.display = 'none';
      paso2.innerHTML = originalContent;
      setupPlanEventListeners();
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ plan })
    });

    if (resPost.ok) {
      showToast(`¡Listo! Agregada al ${dia} (${comida})`);
      modal.style.display = 'none';
    } else {
      throw new Error('Error al guardar');
    }
  } catch (error) {
    console.error('Error planificador:', error);
    showToast('Error al actualizar el planificador', true);
  } finally {
    paso2.innerHTML = originalContent;
    setupPlanEventListeners();
  }
}

window.agregarAPlan = function () {
  if (!currentUser) { showToast('Inicia sesión para planificar comidas', true); return; }
  const modal = document.getElementById('modal-plan');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('plan-paso-1').style.display = 'block';
    document.getElementById('plan-paso-2').style.display = 'none';
  }
};

function setupPlanEventListeners() {
  const modal = document.getElementById('modal-plan');
  if (!modal) return;

  modal.onclick = (e) => {
    const btnDia = e.target.closest('.btn-dia');
    const btnComida = e.target.closest('.btn-comida');
    const btnCerrar = e.target.closest('.close-plan-modal');
    const btnVolver = e.target.closest('#btn-volver-paso-1');

    if (btnDia) {
      diaPlanSeleccionado = btnDia.dataset.dia;
      const nombres = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
      document.getElementById('texto-dia-seleccionado').textContent = `Agregando al ${nombres[diaPlanSeleccionado]}`;
      document.getElementById('plan-paso-1').style.display = 'none';
      document.getElementById('plan-paso-2').style.display = 'block';
    }
    if (btnComida) guardarEnPlan(diaPlanSeleccionado, btnComida.dataset.comida);
    if (btnCerrar || e.target === modal) modal.style.display = 'none';
    if (btnVolver) {
      document.getElementById('plan-paso-1').style.display = 'block';
      document.getElementById('plan-paso-2').style.display = 'none';
    }
  };
}

function mostrarError(msg) {
  const c = document.getElementById('receta-container');
  if (c) c.innerHTML = `
    <div class="error-message">
      <i data-lucide="alert-circle" style="width:48px;height:48px;color:#ff5252;"></i>
      <p>${escapeHTML(msg)}</p>
    </div>`;
}

// Exponer funciones al scope global
window.toggleLike = toggleLike;
window.toggleFav = toggleFav;
window.eliminarComentario = window.eliminarComentario; // ya definido arriba
window.eliminarReceta = window.eliminarReceta;     // ya definido arriba

async function init() {
  await cargarUsuario();
  await cargarReceta();
  setupPlanEventListeners();
}
init();

// Lógica de ocultado automático de la navegación al scroll
(function () {
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