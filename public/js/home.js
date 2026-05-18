// home.js
import { supabase } from './supabaseClient.js';

let currentUser = null;
const pts = document.getElementById('puntos-display');

function showToast(m, err = false) {
  let t = document.getElementById('home-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'home-toast';
    t.className = 'notification-toast';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.style.background = err ? '#e53935' : '#E07A5F';
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
      if (pts) pts.innerHTML = `<i data-lucide="star" style="width:14px;height:14px;"></i> ${currentUser.puntos || 0} pts`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { }
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
      if (pts) pts.innerHTML = `<i data-lucide="star" style="width:14px;height:14px;"></i> ${currentUser.puntos || 0} pts`;
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Mostrar chatbot y badge si tiene acceso
      const hasChat = currentUser.es_premium || currentUser.esPremium ||
        (currentUser.preferencias || []).some(p => String(p).startsWith('PERMISO_CHAT:'));
      if (hasChat) {
        const b = document.getElementById('premium-badge');
        if (b) b.style.display = 'flex';
        const c = document.getElementById('chat-boton');
        if (c) c.classList.add('premium-visible');
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
      else container.innerHTML = '<p class="error-msg"><i data-lucide="alert-triangle"></i> No se pudieron cargar las recetas. Revisa tu conexión.</p>';
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
    container.innerHTML = '<div class="no-results" style="opacity:0; animation: fadeIn 0.5s forwards;"><i data-lucide="chef-hat" style="width:48px;height:48px;margin-bottom:10px;"></i><p>No hay recetas disponibles por ahora</p></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23FDFBF7'/%3E%3Ccircle cx='50' cy='38' r='20' fill='%23E07A5F'/%3E%3Cpath d='M20 90 c0-25 15-35 30-35 s30 10 30 35' fill='%23E07A5F'/%3E%3C/svg%3E`;

  container.innerHTML = recetas.map((r, i) => {
    const tagsHtml = (r.etiquetas || []).slice(0, 3).map(t => `<span class="recipe-tag">${t}</span>`).join('');
    return `
      <div class="recipe-card" style="opacity:0; animation: fadeInUp 0.4s ease-out forwards; animation-delay: ${i * 0.05}s;" data-id="${r.id}">
        <div class="recipe-image clickable-recipe" style="cursor: pointer;">
          ${r.es_premium ? '<span class="badge-premium"><i data-lucide="crown"></i> Premium</span>' : ''}
          <img src="${r.imagen || placeholder}" alt="${r.titulo}" onerror="this.src='${placeholder}'" loading="lazy">
        </div>
        <div class="recipe-content">
          <h3 class="clickable-recipe" style="cursor: pointer;">${r.titulo}</h3>
          <p class="recipe-autor">Por ${r.autor || 'Chef Foráneo'}</p>
          <div class="recipe-meta">
            <span class="recipe-time"><i data-lucide="clock"></i> ${r.tiempo || '30 min'}</span>
            <span class="recipe-price"><i data-lucide="banknote"></i> ${r.precio || '$$'}</span>
            <span class="recipe-likes ${r.likedByUser ? 'active' : ''}" data-id="${r.id}" data-likes="${r.likes || 0}" data-liked="${r.likedByUser ? '1' : '0'}">
              <i data-lucide="heart"></i> <span class="like-count">${r.likes || 0}</span>
            </span>
            <span class="recipe-favorite ${r.favoriteByUser ? 'active' : ''}" data-id="${r.id}" data-fav="${r.favoriteByUser ? '1' : '0'}">
              <i data-lucide="star"></i>
            </span>
          </div>
          <div class="recipe-tags">${tagsHtml}</div>
          <button class="btn-ver-mas clickable-recipe">Ver detalles</button>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Escuchadores de eventos dinámicos para evitar redirecciones involuntarias
  container.querySelectorAll('.recipe-card').forEach(card => {
    const id = card.dataset.id;

    // Navegación exclusiva al dar clic en imagen, título o el botón de Ver detalles
    card.querySelectorAll('.clickable-recipe').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `receta.html?id=${id}`;
      });
    });

    // Botón de Like interactivo
    const likeBtn = card.querySelector('.recipe-likes');
    if (likeBtn) {
      likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHomeLike(id, likeBtn);
      });
    }

    // Botón de Favorito interactivo
    const favBtn = card.querySelector('.recipe-favorite');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHomeFav(id, favBtn);
      });
    }
  });
}

async function toggleHomeLike(recipeId, btn) {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Inicia sesión para dar like', true);
    return;
  }

  const liked = btn.dataset.liked === '1';
  const countEl = btn.querySelector('.like-count');
  const oldCount = parseInt(btn.dataset.likes) || 0;

  // Optimistic UI
  const newCount = liked ? Math.max(oldCount - 1, 0) : oldCount + 1;
  countEl.textContent = newCount;
  btn.classList.toggle('active', !liked);
  btn.dataset.liked = liked ? '0' : '1';
  btn.dataset.likes = newCount;

  try {
    const res = await fetch(`/api/recipes/${recipeId}/like`, {
      method: liked ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error al procesar me gusta');

    const data = await res.json();
    if (data.likes !== undefined) {
      countEl.textContent = data.likes;
      btn.dataset.likes = data.likes;
    }
    showToast(liked ? 'Like eliminado' : '¡Me gusta!');
  } catch (e) {
    // Revert optimistic UI
    countEl.textContent = oldCount;
    btn.classList.toggle('active', liked);
    btn.dataset.liked = liked ? '1' : '0';
    btn.dataset.likes = oldCount;
    showToast(e.message || 'Error al conectar con el servidor', true);
  }
}

async function toggleHomeFav(recipeId, btn) {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Inicia sesión para guardar', true);
    return;
  }

  const fav = btn.dataset.fav === '1';

  // Optimistic UI
  btn.classList.toggle('active', !fav);
  btn.dataset.fav = fav ? '0' : '1';

  try {
    const res = await fetch(`/api/recipes/${recipeId}/favorite`, {
      method: fav ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error al actualizar favoritos');
    showToast(fav ? 'Eliminado de favoritos' : 'Guardado en favoritos');
  } catch (e) {
    // Revert optimistic UI
    btn.classList.toggle('active', fav);
    btn.dataset.fav = fav ? '1' : '0';
    showToast(e.message || 'Error al conectar con el servidor', true);
  }
}

async function setupFilters() {
  const container = document.querySelector('.filter-tags');
  if (!container) return;

  const fijos = [
    { id: 'todas', icon: 'utensils', label: 'Todas' },
    { id: 'populares', icon: 'flame', label: 'Populares' },
    { id: 'economicas', icon: 'banknote', label: 'Económicas' },
    { id: 'rapidas', icon: 'zap', label: 'Rápidas' }
  ];

  container.innerHTML = fijos.map(f => `
    <button class="tag ${f.id === 'todas' ? 'active-filter' : ''}" data-filter="${f.id}"><i data-lucide="${f.icon}"></i> ${f.label}</button>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

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

// Lógica de ocultado automático de la navegación
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