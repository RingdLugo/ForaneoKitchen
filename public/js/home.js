// home.js - Inicio de ForaneoKitchen
import { supabase } from './supabaseClient.js';

let currentUser = null;

// ── Notificaciones Toast ─────────────────────────────────────────────────────
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

// ── Cargar usuario ──────────────────────────────────────────────────────────
async function cargarUsuario() {
  const token = localStorage.getItem('token');
  
  // Cache rápido
  const cached = localStorage.getItem('userData');
  if (cached) {
    try {
      currentUser = JSON.parse(cached);
      document.getElementById('user-name').textContent = currentUser.nombre || currentUser.username;
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
      document.getElementById('user-name').textContent = currentUser.nombre || currentUser.username;
      const pts = document.getElementById('puntos-display');
      if (pts) pts.textContent = `⭐ ${currentUser.puntos || 0} pts`;
      
      if (currentUser.es_premium || currentUser.esPremium) {
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

// ── Cargar Recetas ────────────────────────────────────────────────────────────
async function cargarRecetas(params = {}) {
  const container = document.getElementById('recetas');
  if (!container) return;

  try {
    let url = '/api/recipes?';
    if (params.q) url += `q=${encodeURIComponent(params.q)}&`;
    if (params.filter === 'populares') url += `orden=likes&`;
    if (params.filter === 'economicas') url += `maxPrecio=35&`;
    if (params.filter === 'rapidas') url += `maxTiempo=20&`;
    
    // Ignorar preferencias en filtros rápidos para no limitar de más
    if (params.filter && params.filter !== 'todas') url += `ignorePrefs=true&`;

    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Error servidor');
    
    const recetas = await response.json();
    renderizarRecetas(recetas);
    
    // Guardar en cache con manejo de cuota
    try {
      localStorage.setItem('recetas_cache', JSON.stringify(recetas));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Caché llena, limpiando solo recetas...');
        // SOLO eliminar caches grandes, NO el token ni datos de usuario
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

function renderizarRecetas(recetas) {
  const container = document.getElementById('recetas');
  if (!container) return;
  
  if (!recetas || recetas.length === 0) {
    container.innerHTML = '<div class="no-results"><span>🍳</span><p>No hay recetas disponibles por ahora</p></div>';
    return;
  }

  const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f5f5f5'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;
  
  container.innerHTML = recetas.map(r => {
    // Generar etiquetas si existen
    const tagsHtml = (r.etiquetas || []).slice(0, 3).map(t => `<span class="recipe-tag">${t}</span>`).join('');
    
    return `
      <div class="recipe-card" onclick="window.location.href='receta.html?id=${r.id}'">
        <div class="recipe-image">
          ${r.es_premium ? '<span class="badge-premium">👑 Premium</span>' : ''}
          <img src="${r.imagen || placeholder}" alt="${r.titulo}" onerror="this.src='${placeholder}'">
        </div>
        <div class="recipe-content">
          <h3>${r.titulo}</h3>
          <p class="recipe-autor">Por ${r.autor || 'Chef Foráneo'}</p>
          <div class="recipe-meta">
            <span class="recipe-time">⏱️ ${r.tiempo || '30 min'}</span>
            <span class="recipe-price">💰 ${r.precio || '$$'}</span>
          </div>
          <div class="recipe-tags">
            ${tagsHtml}
          </div>
          <div class="recipe-likes">
            ❤️ ${r.likes || 0} likes
          </div>
          <button class="btn-ver-mas">Ver detalles</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Filtros ──────────────────────────────────────────────────────────────────
function setupFilters() {
  const tags = document.querySelectorAll('.tag');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active-filter'));
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

// ── Iniciar ──────────────────────────────────────────────────────────────────
async function init() {
  await cargarUsuario();
  cargarRecetas(); // No await para no bloquear
  setupFilters();
}

document.addEventListener('DOMContentLoaded', init);