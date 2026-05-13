// home.js
import { supabase } from './supabaseClient.js';

let currentUser = null;

function showToast(m, err = false) {
  let t = document.getElementById('home-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'home-toast';
    t.className = 'notification-toast';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.style.background = err ? '#e53935' : '#333';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

async function cargarUsuario() {
  const token = localStorage.getItem('token');

  // Mostrar datos cacheados mientras carga
  const cached = localStorage.getItem('userData');
  if (cached) {
    try {
      currentUser = JSON.parse(cached);
      document.getElementById('user-name').textContent = currentUser.username || currentUser.nombre || 'Usuario';
      const avatar = document.getElementById('user-avatar');
      if (avatar && currentUser.foto_perfil) avatar.src = currentUser.foto_perfil;
      const pts = document.getElementById('puntos-display');
      if (pts) pts.textContent = `⭐ ${currentUser.puntos || 0} pts`;
    } catch(e) {}
  }

  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      currentUser = await res.json();
      localStorage.setItem('userData', JSON.stringify(currentUser));
      document.getElementById('user-name').textContent = currentUser.username || currentUser.nombre || 'Usuario';
      const avatar = document.getElementById('user-avatar');
      if (avatar && currentUser.foto_perfil) avatar.src = currentUser.foto_perfil;
      const pts = document.getElementById('puntos-display');
      if (pts) pts.textContent = `⭐ ${currentUser.puntos || 0} pts`;

      // Mostrar chatbot y badge si tiene acceso
      const hasChat = currentUser.es_premium || currentUser.esPremium ||
                      (currentUser.preferencias || []).some(p => String(p).startsWith('PERMISO_CHAT:'));
      if (hasChat) {
        const b = document.getElementById('premium-badge');
        if (b) b.style.display = 'flex';
        const c = document.getElementById('chat-boton');
        if (c) c.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('Error cargando usuario fresh');
  }
}

async function cargarRecetas(params = {}) {
  mostrarSkeleton();
  const container = document.getElementById('recetas');
  if (!container) return;

  try {
    let url = '/api/recipes?';
    if (params.q) url += `q=${encodeURIComponent(params.q)}&`;
    if (params.filter === 'populares') url += `orden=likes&`;
    if (params.filter === 'economicas') url += `maxPrecio=35&`;
    if (params.filter === 'rapidas') url += `maxTiempo=20&`;

    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Error servidor');

    const recetas = await response.json();
    renderizarRecetas(recetas);

    // Guardar en caché
    try {
      localStorage.setItem('recetas_cache', JSON.stringify(recetas));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Caché llena, limpiando...');
        // Solo eliminar cachés grandes, conservar token y datos de usuario
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('cache') || key.startsWith('recipe_') || key.startsWith('recetas_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    }
  } catch (error) {
    console.error('Error:', error);
    try {
      const cached = localStorage.getItem('recetas_cache');
      if (cached) renderizarRecetas(JSON.parse(cached));
      else container.innerHTML = '<p class="error-msg">⚠️ No se pudieron cargar las recetas. Revisa tu conexión.</p>';
    } catch (e) {
      container.innerHTML = '<p class="error-msg">⚠️ Error de almacenamiento. Revisa tu conexión.</p>';
    }
  }
}

function mostrarSkeleton() {
  const container = document.getElementById('recetas');
  if (!container) return;
  container.innerHTML = Array(6).fill(0).map(() => `
    <div class="recipe-card skeleton">
      <div class="skeleton-img"></div>
      <div class="recipe-content">
        <div class="skeleton-text title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    </div>
  `).join('');
}

function renderizarRecetas(recetas) {
  const container = document.getElementById('recetas');
  if (!container) return;

  if (!recetas || recetas.length === 0) {
    container.innerHTML = '<div class="no-results" style="opacity:0; animation: fadeIn 0.5s forwards;"><span>🍳</span><p>No hay recetas disponibles por ahora</p></div>';
    return;
  }

  const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f5f5f5'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;

  container.innerHTML = recetas.map((r, i) => {
    const tagsHtml = (r.etiquetas || []).slice(0, 3).map(t => `<span class="recipe-tag">${t}</span>`).join('');
    return `
      <div class="recipe-card" style="opacity:0; animation: fadeInUp 0.4s ease-out forwards; animation-delay: ${i * 0.05}s;" onclick="window.location.href='receta.html?id=${r.id}'">
        <div class="recipe-image">
          ${r.es_premium ? '<span class="badge-premium">👑 Premium</span>' : ''}
          <img src="${r.imagen || placeholder}" alt="${r.titulo}" onerror="this.src='${placeholder}'" loading="lazy">
        </div>
        <div class="recipe-content">
          <h3>${r.titulo}</h3>
          <p class="recipe-autor">Por ${r.autor || 'Chef Foráneo'}</p>
          <div class="recipe-meta">
            <span class="recipe-time">⏱️ ${r.tiempo || '30 min'}</span>
            <span class="recipe-price">💰 ${r.precio || '$$'}</span>
          </div>
          <div class="recipe-tags">${tagsHtml}</div>
          <div class="recipe-footer-stats" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <span class="recipe-likes" style="font-size:0.85rem; color:#666;">
              ${r.likedByUser ? '❤️' : '🤍'} ${r.likes || 0}
            </span>
            ${r.favoriteByUser ? '<span class="recipe-saved-indicator" title="Guardada" style="color:#4caf50; font-size:1.1rem;">⭐</span>' : ''}
          </div>
          <button class="btn-ver-mas">Ver detalles</button>
        </div>
      </div>
    `;
  }).join('');
}

async function setupFilters() {
  const container = document.querySelector('.filter-tags');
  if (!container) return;

  const fijos = [
    { id: 'todas',      icon: '🍽️', label: 'Todas' },
    { id: 'populares',  icon: '🔥', label: 'Populares' },
    { id: 'economicas', icon: '💰', label: 'Económicas' },
    { id: 'rapidas',    icon: '⚡', label: 'Rápidas' }
  ];

  container.innerHTML = fijos.map(f => `
    <button class="tag ${f.id === 'todas' ? 'active-filter' : ''}" data-filter="${f.id}">${f.icon} ${f.label}</button>
  `).join('');

  container.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', () => {
      container.querySelectorAll('.tag').forEach(t => t.classList.remove('active-filter'));
      tag.classList.add('active-filter');
      cargarRecetas({ filter: tag.dataset.filter });
    });
  });

  const searchInput = document.getElementById('search-input');
  let timeout = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      cargarRecetas({ q: e.target.value });
    }, 500);
  });
}

async function init() {
  await cargarUsuario();
  await setupFilters();
  cargarRecetas();
}

document.addEventListener('DOMContentLoaded', init);