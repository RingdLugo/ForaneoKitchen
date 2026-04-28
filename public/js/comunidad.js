/* ================================================================
   ForaneoKitchen — comunidad.js
   Likes, favoritos y comentarios funcionales + sin duplicados
   ================================================================ */
'use strict';

const API = (() => {
  const o = window.location.origin;
  return (o.includes('localhost') || o.includes('127.0.0.1')) ? 'http://localhost:3000' : o;
})();

const token = localStorage.getItem('token');
let recetas = [];
let usuarioActual = null;
let recetaModalId = null;

// ── Helpers ──────────────────────────────────────────────────
function escapeHTML(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
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
  t.style.background = isError ? '#e53935' : '#4caf50';
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 3000);
}
function formatFecha(f) {
  const d = new Date(f), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h`;
  if (diff < 604800) return `${Math.floor(diff/86400)} d`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
const PLACEHOLDER_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;

// ── Cargar usuario actual ─────────────────────────────────────
async function obtenerUsuario() {
  if (!token) return;
  try {
    const res = await fetch(`${API}/api/auth/me`, { headers: authHeaders() });
    if (res.ok) usuarioActual = await res.json();
  } catch {}
}

// ── Cargar recetas ─────────────────────────────────────────────
async function cargarRecetas() {
  const container = document.getElementById('recetas-comunidad');
  if (!container) return;

  // Skeleton
  container.innerHTML = Array(3).fill(`
    <div class="receta-comunidad-card" style="cursor:default">
      <div class="receta-imagen-mini"><div class="skeleton" style="width:100%;height:100%;border-radius:12px"></div></div>
      <div class="receta-info-comunidad" style="flex:1">
        <div class="skeleton" style="height:18px;width:70%;margin-bottom:8px;border-radius:4px"></div>
        <div class="skeleton" style="height:13px;width:40%;margin-bottom:12px;border-radius:4px"></div>
        <div class="skeleton" style="height:13px;width:55%;border-radius:4px"></div>
      </div>
    </div>`).join('');

  try {
    const headers = token ? authHeaders() : {};
    const res = await fetch(`${API}/api/recipes`, { headers });
    if (!res.ok) throw new Error();
    recetas = await res.json();
    renderizarRecetas();
  } catch {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999">No se pudieron cargar las recetas. ¿Está el servidor corriendo?</div>';
  }
}

// ── Render recetas ─────────────────────────────────────────────
function renderizarRecetas() {
  const container = document.getElementById('recetas-comunidad');
  if (!container || !recetas.length) {
    if (container) container.innerHTML = '<div style="text-align:center;padding:60px;color:#999">No hay recetas aún.</div>';
    return;
  }

  container.innerHTML = recetas.map(r => {
    const img = r.imagen || PLACEHOLDER_IMG;
    const likedClass = r.usuarioLike ? 'liked' : '';
    const favClass = r.esFavorito ? 'favorited' : '';
    const estrellas = r.rating ? `⭐ ${parseFloat(r.rating).toFixed(1)}` : '';

    return `
    <div class="receta-comunidad-card" data-id="${r.id}" onclick="irAReceta(${r.id}, event)">
      <div class="receta-imagen-mini">
        <img src="${img}" alt="${escapeHTML(r.titulo)}" loading="lazy"
             onerror="this.src='${PLACEHOLDER_IMG}'">
      </div>
      <div class="receta-info-comunidad">
        <h3>${escapeHTML(r.titulo)}</h3>
        <p class="receta-autor">👨‍🍳 ${escapeHTML(r.autor || 'Anónimo')}</p>
        <div class="receta-stats">
          <span class="receta-precio">💰 ${escapeHTML(r.precio || '$$')}</span>
          <span class="receta-tiempo">⏱️ ${escapeHTML(r.tiempo || '30 min')}</span>
          ${estrellas ? `<span style="color:#f0883e;font-size:.8rem">${estrellas}</span>` : ''}
        </div>
        <div class="acciones-comunidad" onclick="event.stopPropagation()">
          <button class="like-btn ${likedClass}"
            data-id="${r.id}" data-liked="${r.usuarioLike ? '1':'0'}"
            onclick="toggleLike(${r.id}, this)">
            ❤️ <span class="like-count">${r.likes || 0}</span>
          </button>
          <button class="favorito-btn ${favClass}"
            data-id="${r.id}" data-fav="${r.esFavorito ? '1':'0'}"
            onclick="toggleFavorito(${r.id}, this)">
            ⭐ ${r.esFavorito ? 'Guardado' : 'Guardar'}
          </button>
          <button class="comentar-btn" onclick="abrirComentarios(${r.id}, '${escapeHTML(r.titulo)}')">
            💬 Comentar
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function irAReceta(id, e) {
  if (e.target.closest('.acciones-comunidad')) return;
  window.location.href = `receta.html?id=${id}`;
}

// ── LIKE ──────────────────────────────────────────────────────
async function toggleLike(recipeId, btn) {
  if (!token) { showToast('Inicia sesión para dar like', true); return; }

  const liked = btn.dataset.liked === '1';
  const method = liked ? 'DELETE' : 'POST';
  const countEl = btn.querySelector('.like-count');

  // Optimistic UI
  btn.disabled = true;
  const oldCount = parseInt(countEl.textContent) || 0;
  countEl.textContent = liked ? Math.max(oldCount - 1, 0) : oldCount + 1;
  btn.classList.toggle('liked', !liked);
  btn.dataset.liked = liked ? '0' : '1';

  try {
    const res = await fetch(`${API}/api/recipes/${recipeId}/like`, { method, headers: authHeaders() });
    if (res.status === 400 && !liked) {
      // Ya existe el like — sincronizar UI
      showToast('Ya le diste like a esta receta');
      btn.classList.add('liked'); btn.dataset.liked = '1';
      return;
    }
    if (!res.ok) throw new Error();
    const data = await res.json();
    countEl.textContent = data.likes;
    showToast(liked ? 'Like eliminado' : '❤️ ¡Like!');
  } catch {
    // Revertir
    countEl.textContent = oldCount;
    btn.classList.toggle('liked', liked);
    btn.dataset.liked = liked ? '1' : '0';
    showToast('Error al procesar like', true);
  } finally {
    btn.disabled = false;
  }
}

// ── FAVORITO ──────────────────────────────────────────────────
async function toggleFavorito(recipeId, btn) {
  if (!token) { showToast('Inicia sesión para guardar favoritos', true); return; }

  const fav = btn.dataset.fav === '1';
  const method = fav ? 'DELETE' : 'POST';

  btn.disabled = true;
  btn.classList.toggle('favorited', !fav);
  btn.textContent = `⭐ ${!fav ? 'Guardado' : 'Guardar'}`;
  btn.dataset.fav = fav ? '0' : '1';

  try {
    const res = await fetch(`${API}/api/users/me/favorites/${recipeId}`, { method, headers: authHeaders() });
    if (res.status === 400 && !fav) {
      showToast('Ya está en favoritos');
      btn.classList.add('favorited'); btn.dataset.fav = '1'; btn.textContent = '⭐ Guardado';
      return;
    }
    if (!res.ok) throw new Error();
    showToast(fav ? '⭐ Eliminado de favoritos' : '⭐ Guardado en favoritos');
  } catch {
    btn.classList.toggle('favorited', fav);
    btn.textContent = `⭐ ${fav ? 'Guardado' : 'Guardar'}`;
    btn.dataset.fav = fav ? '1' : '0';
    showToast('Error al procesar favorito', true);
  } finally {
    btn.disabled = false;
  }
}

// ── COMENTARIOS ───────────────────────────────────────────────
async function abrirComentarios(recipeId, titulo) {
  recetaModalId = recipeId;
  const modal = document.getElementById('modal-comentarios');
  document.getElementById('modal-comentarios-titulo').textContent = `💬 ${titulo}`;
  modal.classList.add('active');
  document.getElementById('nuevo-comentario').value = '';
  await cargarComentarios(recipeId);
}

async function cargarComentarios(recipeId) {
  const lista = document.getElementById('comentarios-lista');
  lista.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Cargando…</div>';

  try {
    const res = await fetch(`${API}/api/recipes/${recipeId}/comments`);
    const comentarios = res.ok ? await res.json() : [];

    if (!comentarios.length) {
      lista.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa">Sin comentarios. ¡Sé el primero! 🍳</div>';
      return;
    }

    lista.innerHTML = comentarios.map(c => {
      const uname = c.usuario?.username || 'Usuario';
      const inicial = uname[0].toUpperCase();
      const foto = c.usuario?.foto_perfil;
      const avatarHTML = foto
        ? `<img src="${foto}" alt="${escapeHTML(uname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `<div class="avatar-placeholder">${inicial}</div>`;
      const esPropio = usuarioActual && c.usuario?.id === usuarioActual.id;

      return `
      <div class="comentario-item" data-id="${c.id}">
        <div class="comentario-avatar">${avatarHTML}</div>
        <div class="comentario-contenido">
          <div class="comentario-header">
            <strong>${escapeHTML(uname)}</strong>
            <small>${formatFecha(c.fecha)}</small>
          </div>
          <p>${escapeHTML(c.texto)}</p>
        </div>
        ${esPropio ? `<button class="btn-eliminar-comentario" onclick="eliminarComentario('${c.id}', this)" title="Eliminar">🗑️</button>` : ''}
      </div>`;
    }).join('');
  } catch {
    lista.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Error al cargar comentarios</div>';
  }
}

async function enviarComentario() {
  if (!token) { showToast('Inicia sesión para comentar', true); return; }
  const input = document.getElementById('nuevo-comentario');
  const texto = input.value.trim();
  if (!texto) { showToast('Escribe un comentario', true); return; }
  if (texto.length > 500) { showToast('Máximo 500 caracteres', true); return; }

  const btn = document.getElementById('enviar-comentario');
  btn.disabled = true; btn.textContent = '…';

  try {
    const res = await fetch(`${API}/api/recipes/${recetaModalId}/comments`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ texto })
    });
    if (!res.ok) throw new Error();
    input.value = '';
    showToast('💬 Comentario publicado');
    await cargarComentarios(recetaModalId);
  } catch {
    showToast('Error al publicar', true);
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar';
  }
}

async function eliminarComentario(commentId, btn) {
  if (!confirm('¿Eliminar este comentario?')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/comments/${commentId}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error();
    btn.closest('.comentario-item').remove();
    showToast('Comentario eliminado');
  } catch {
    showToast('Error al eliminar', true);
    btn.disabled = false;
  }
}

function cerrarModal() {
  document.getElementById('modal-comentarios').classList.remove('active');
  recetaModalId = null;
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  await obtenerUsuario();
  await cargarRecetas();

  // Modal
  document.querySelector('#modal-comentarios .close-modal')?.addEventListener('click', cerrarModal);
  document.getElementById('enviar-comentario')?.addEventListener('click', enviarComentario);
  document.getElementById('nuevo-comentario')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario(); }
  });
  window.addEventListener('click', e => {
    const modal = document.getElementById('modal-comentarios');
    if (e.target === modal) cerrarModal();
  });
}

// Exponer globalmente
window.toggleLike = toggleLike;
window.toggleFavorito = toggleFavorito;
window.abrirComentarios = abrirComentarios;
window.eliminarComentario = eliminarComentario;
window.irAReceta = irAReceta;

init();