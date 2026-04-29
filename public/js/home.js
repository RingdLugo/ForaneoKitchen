// home.js - Versión CORREGIDA

let currentUser = null;
let todasRecetas = [];
let searchTimeout = null;

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;

function escapeHTML(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function showToast(m, err = false) {
  let t = document.getElementById('home-toast');
  if (!t) { t = document.createElement('div'); t.id = 'home-toast'; t.className = 'notification-toast'; document.body.appendChild(t); }
  t.textContent = m;
  if (err) t.style.background = '#e53935';
  else t.style.background = '#4caf50';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

async function cargarUsuario() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  
  console.log('🔍 home.js - Token:', token ? '✅' : '❌');
  console.log('🔍 home.js - UserId:', userId);
  
  // Si no hay token, mostrar como invitado
  if (!token) {
    console.log('⚠️ No hay token, modo invitado');
    document.getElementById('user-name').textContent = 'Invitado';
    const puntos = document.getElementById('puntos-display');
    if (puntos) puntos.textContent = '⭐ 0 pts';
    return false;
  }
  
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('📡 /api/auth/me response:', response.status);
    
    if (!response.ok) {
      console.log('❌ Token inválido');
      localStorage.clear();
      document.getElementById('user-name').textContent = 'Invitado';
      return false;
    }
    
    currentUser = await response.json();
    console.log('✅ Usuario cargado:', currentUser.username);
    
    document.getElementById('user-name').textContent = currentUser.nombre || currentUser.username;
    
    const puntos = document.getElementById('puntos-display');
    if (puntos) puntos.textContent = `⭐ ${currentUser.puntos || 0} pts`;

    // Avatar
    const avatarImg = document.getElementById('user-avatar');
    if (avatarImg) {
      if (currentUser.foto_perfil) {
        avatarImg.src = currentUser.foto_perfil;
      } else {
        avatarImg.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234caf50'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='45'%3E${(currentUser.nombre?.charAt(0) || currentUser.username?.charAt(0) || 'U').toUpperCase()}%3C/text%3E%3C/svg%3E`;
      }
    }

    // Mostrar botón cerrar sesión solo si está logueado
    const cerrarBtn = document.getElementById('cerrar-sesion-btn');
    if (cerrarBtn) cerrarBtn.style.display = 'block';
    
    if (currentUser.esPremium) {
      const badge = document.getElementById('premium-badge');
      if (badge) badge.style.display = 'flex';
      const chatBtn = document.getElementById('chat-boton');
      if (chatBtn) chatBtn.style.display = 'block';
    }

    // Notificaciones
    await verificarNotificaciones();
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

async function verificarNotificaciones() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/users/me/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const notifs = await res.json();
      if (notifs.length > 0) {
        notifs.forEach((n, index) => {
          setTimeout(() => {
            showToast(`🔔 ${n.mensaje}`);
          }, index * 3200);
        });
        fetch('/api/users/me/notifications/read', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    }
  } catch (e) { console.warn('Notif check error:', e); }
}

async function toggleLike(id, btn) {
  const token = localStorage.getItem('token');
  if (!token) { showToast('Inicia sesión para dar like', true); return; }
  
  const liked = btn.dataset.liked === '1';
  const countEl = btn.querySelector('span');
  btn.disabled = true;
  const old = parseInt(countEl.textContent) || 0;
  countEl.textContent = liked ? Math.max(old - 1, 0) : old + 1;
  btn.classList.toggle('liked', !liked);
  btn.dataset.liked = liked ? '0' : '1';
  
  try {
    const method = liked ? 'DELETE' : 'POST';
    const res = await fetch(`/api/recipes/${id}/like`, {
      method: method,
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Error');
    
    const data = await res.json();
    countEl.textContent = data.likes;
    showToast(liked ? 'Like eliminado' : '❤️ ¡Like!');
  } catch {
    countEl.textContent = old;
    btn.classList.toggle('liked', liked);
    btn.dataset.liked = liked ? '1' : '0';
  }
  finally { btn.disabled = false; }
}

async function toggleFav(id, btn) {
  const token = localStorage.getItem('token');
  if (!token) { showToast('Inicia sesión para guardar', true); return; }
  
  const fav = btn.dataset.fav === '1';
  btn.disabled = true;
  btn.textContent = fav ? '☆' : '⭐';
  btn.dataset.fav = fav ? '0' : '1';
  btn.classList.toggle('favorited', !fav);
  
  try {
    const method = fav ? 'DELETE' : 'POST';
    await fetch(`/api/users/me/favorites/${id}`, {
      method: method,
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showToast(fav ? 'Eliminado de favoritos' : '⭐ Guardado');
  } catch {
    btn.textContent = fav ? '⭐' : '☆';
    btn.classList.toggle('favorited', fav);
    btn.dataset.fav = fav ? '1' : '0';
  }
  finally { btn.disabled = false; }
}

async function cargarRecetas(params = {}) {
  const container = document.getElementById('recetas');
  const token = localStorage.getItem('token');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    let url = '/api/recipes?';
    if (params.q) url += `q=${encodeURIComponent(params.q)}&`;
    if (params.maxPrecio) url += `maxPrecio=${params.maxPrecio}&`;
    if (params.maxTiempo) url += `maxTiempo=${params.maxTiempo}&`;
    
    // Algoritmo: Si hay usuario logueado, pasar sus preferencias
    if (currentUser && currentUser.preferencias && currentUser.preferencias.length > 0) {
      const prefs = currentUser.preferencias.filter(p => !p.startsWith('PERMISO_'));
      if (prefs.length > 0) {
        url += `preferencias=${encodeURIComponent(prefs.join(','))}&`;
      }
    }
    
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(url, { headers });
    const recetas = await response.json();
    
    renderizarRecetas(recetas);
  } catch (error) {
    console.error('Error cargando recetas:', error);
    container.innerHTML = '<div class="error-message"><p>❌ Error al cargar recetas</p></div>';
  }
}

function renderizarRecetas(recetas) {
  const container = document.getElementById('recetas');
  if (!container) return;
  
  if (recetas.length === 0) {
    const hasPrefs = currentUser && currentUser.preferencias && currentUser.preferencias.length > 0;
    container.innerHTML = `
      <div class="vacio-mensaje" style="text-align:center; padding: 40px 20px; background: var(--card-bg, #fff); border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin: 20px auto; max-width: 500px; display: flex; flex-direction: column; align-items: center; gap: 15px;">
        <span style="font-size: 60px; line-height: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">🥗</span>
        <h3 style="margin: 0; font-size: 1.5rem; color: var(--text-color, #333);">No hay recetas disponibles</h3>
        <p style="margin: 0; color: #666; font-size: 1rem; line-height: 1.5;">${hasPrefs ? 'No encontramos recetas que coincidan con tus preferencias alimenticias. Prueba cambiando tus preferencias en el perfil.' : 'Vuelve más tarde para descubrir nuevas delicias.'}</p>
        ${hasPrefs ? '<a href="perfil.html" class="btn-primary" style="margin-top: 10px; text-decoration: none; display: inline-block;">Editar Preferencias</a>' : ''}
      </div>
    `;
    return;
  }
  
  container.innerHTML = recetas.map(r => {
    const likedCls = r.usuarioLike ? 'liked' : '';
    const favCls = r.esFavorito ? 'favorited' : '';
    const premiumBadge = r.es_premium ? '<span class="badge-premium">👑 Premium</span>' : '';
    return `
      <div class="recipe-card" data-id="${r.id}" onclick="window.location.href='receta.html?id=${r.id}'">
        <div class="recipe-image"><img src="${r.imagen || PLACEHOLDER}" alt="${escapeHTML(r.titulo)}" loading="lazy">${premiumBadge}</div>
        <div class="recipe-content">
          <h3>${escapeHTML(r.titulo)}</h3>
          <div class="recipe-autor" ${r.usuario_id ? `onclick="event.stopPropagation(); window.location.href='perfil.html?id=${r.usuario_id}'"` : ''} style="${r.usuario_id ? 'cursor:pointer; color:#4caf50;' : 'color:#999;'}">👨‍🍳 ${escapeHTML(r.usuario?.username || r.autor || 'Anónimo')} ${r.autorRol === 'free' ? '<span style="font-size:0.7rem;color:#999">(Free)</span>' : ''}</div>
          ${r.autorRol === 'free' && !r.video_url && !r.video_youtube ? '<div style="font-size:0.65rem;color:#4caf50;margin-top:2px">ℹ️ Sin video - Usuario Free</div>' : ''}
          <div class="recipe-meta"><span class="recipe-price">💰 ${escapeHTML(r.precio || '$$')}</span><span class="recipe-time">⏱️ ${escapeHTML(r.tiempo || '30 min')}</span></div>
          <div class="recipe-social">
            <button class="btn-like-mini ${likedCls}" data-id="${r.id}" data-liked="${r.usuarioLike ? 1 : 0}" onclick="event.stopPropagation();window.toggleLike(${r.id}, this)">
              ❤️ <span>${r.likes || 0}</span>
            </button>
            <button class="btn-fav-mini ${favCls}" data-id="${r.id}" data-fav="${r.esFavorito ? 1 : 0}" onclick="event.stopPropagation();window.toggleFav(${r.id}, this)">
              ${r.esFavorito ? '⭐' : '☆'}
            </button>
          </div>
          <button class="btn-ver-mas" onclick="event.stopPropagation(); window.location.href='receta.html?id=${r.id}'">Ver receta →</button>
        </div>
      </div>`;
  }).join('');
  
  // No es necesario el listener por el onclick inline

}

function obtenerFiltros() {
  const q = document.getElementById('search-input')?.value.trim();
  const filtroActivo = document.querySelector('.tag.active-filter')?.dataset.filter;
  const params = {};
  if (q) params.q = q;
  if (filtroActivo === 'economicas') params.maxPrecio = 35;
  if (filtroActivo === 'rapidas') params.maxTiempo = 20;
  if (filtroActivo === 'populares') params.orden = 'likes';
  return params;
}

async function init() {
  console.log('🏠 home.js iniciado');
  
  // Cargar usuario (no redirige)
  await cargarUsuario();
  
  // Cargar recetas
  await cargarRecetas();
  
  // Event listeners
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => cargarRecetas(obtenerFiltros()), 400);
    });
  }
  
  document.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', function() {
      document.querySelectorAll('.tag').forEach(t => t.classList.remove('active-filter'));
      this.classList.add('active-filter');
      cargarRecetas(obtenerFiltros());
    });
  });
  
  const cerrarSesion = document.getElementById('cerrar-sesion-btn');
  if (cerrarSesion) {
    cerrarSesion.addEventListener('click', async () => {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  }
  
  // Chat
  const chatBtn = document.getElementById('chat-boton');
  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      const w = document.getElementById('chat-window');
      if (w) w.style.display = 'flex';
    });
  }
  
  const cerrarChat = document.getElementById('cerrar-chat-btn');
  if (cerrarChat) {
    cerrarChat.addEventListener('click', () => {
      document.getElementById('chat-window').style.display = 'none';
    });
  }
}

// Exponer funciones globales
window.toggleLike = toggleLike;
window.toggleFav = toggleFav;

// Iniciar
init();