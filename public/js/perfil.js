// perfil.js - Perfil de usuario con Supabase
import { supabase } from './supabaseClient.js';

// Elementos DOM
const displayUsername = document.getElementById('display-username');
const displayNombre = document.getElementById('display-nombre');
const displayBio = document.getElementById('display-bio');
const roleBadge = document.getElementById('role-badge');
const puntosBadge = document.getElementById('puntos-badge');
const avatarImg = document.getElementById('avatar-img');
const avatarInput = document.getElementById('avatar-input');
const avatarOverlay = document.getElementById('avatar-overlay-btn');
const toggleFormBtn = document.getElementById('toggle-form-btn');
const guardarPerfilBtn = document.getElementById('guardar-perfil-btn');
const cerrarSesionBtn = document.getElementById('cerrar-sesion-btn');
const notifToast = document.getElementById('notif-toast');

// Campos del formulario
const perfilNombre = document.getElementById('perfil-nombre');
const perfilApellido = document.getElementById('perfil-apellido');
const perfilUsername = document.getElementById('perfil-username');
const perfilEmail = document.getElementById('perfil-email');
const perfilBio = document.getElementById('perfil-bio');

// Stats
const statsRecetas = document.getElementById('stats-recetas');
const statsFavoritos = document.getElementById('stats-favoritos');
const statsVisitas = document.getElementById('stats-visitas');

// Recompensas
const rewardsSection = document.getElementById('rewards-section');
const rewardsContainer = document.getElementById('rewards-container');

// Estado
let currentUser = null;
let preferenciasSeleccionadas = [];
let seccionActiva = 'mis-recetas';
let formVisible = false;

// Definición de recompensas
const REWARDS = [
  { id: 'comentarios_1d', name: 'Permiso Comentarios (1 día)', points: 50, icon: '💬', benefit: 'Comenta en cualquier receta por 24h', days: 1, type: 'permiso_comentarios' },
  { id: 'historial_1d', name: 'Ver Historial (1 día)', points: 40, icon: '📜', benefit: 'Acceso a tu historial de vistas por 24h', days: 1, type: 'permiso_historial' },
  { id: '1day', name: '1 día Premium', points: 120, icon: '👑', benefit: 'Acceso Premium TOTAL por 1 día', days: 1 },
  { id: 'videos', name: 'Desbloquear Videos', points: 500, icon: '🎥', benefit: 'Acceso a videos de recetas permanentemente', type: 'videos' },
  { id: '7days', name: '7 días Premium', points: 700, icon: '👑🌟', benefit: 'Acceso Premium por 7 días', days: 7 }
];

// Funciones auxiliares
function showToast(message, isError = false) {
  if (!notifToast) return;
  notifToast.textContent = message;
  notifToast.className = 'notification-toast' + (isError ? ' error' : '');
  notifToast.classList.add('show');
  setTimeout(() => notifToast.classList.remove('show'), 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgPlaceholder() {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;
}

// Cargar perfil usando el endpoint /api/auth/me con el token JWT propio
async function cargarPerfil() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('id');
  const myUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const esPerfilAjeno = targetUserId && targetUserId !== myUserId && targetUserId !== 'null' && targetUserId !== 'undefined';
  
  if (!myUserId && !esPerfilAjeno) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const API_BASE = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
      ? 'http://localhost:3000/api'
      : window.location.origin + '/api';

    let res;
    if (esPerfilAjeno) {
      res = await fetch(`${API_BASE}/users/${targetUserId}/profile`);
      // Ocultar edición
      if (avatarOverlay) avatarOverlay.style.display = 'none';
      if (toggleFormBtn) toggleFormBtn.style.display = 'none';
      if (rewardsSection) rewardsSection.style.display = 'none';
      const headerH1 = document.querySelector('.perfil-header h1');
      if (headerH1) headerH1.textContent = '👤 Perfil de Usuario';
      
      // Ocultar tabs privadas
      const favBtn = document.getElementById('btn-favoritos');
      const histBtn = document.getElementById('btn-historial');
      if (favBtn) favBtn.style.display = 'none';
      if (histBtn) histBtn.style.display = 'none';
    } else {
      if (!token) { window.location.href = 'login.html'; return; }
      res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    if (!res.ok) {
      if (!esPerfilAjeno) {
        localStorage.clear();
        window.location.href = 'login.html';
      } else {
        showToast('Usuario no encontrado', true);
      }
      return;
    }

    currentUser = await res.json();
  } catch (e) {
    console.error('Error cargando perfil:', e);
    showToast('Error al cargar perfil', true);
    return;
  }

  // Mostrar información
  const username = currentUser.username || currentUser.email?.split('@')[0] || 'usuario';
  displayUsername.textContent = `@${username}`;
  
  const nombreCompleto = `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim();
  displayNombre.textContent = nombreCompleto || 'Usuario sin nombre';
  displayBio.textContent = currentUser.bio || 'Sin biografía aún.';
  
  // Badge de rol
  const esPremium = currentUser.es_premium || currentUser.esPremium;
  if (esPremium) {
    roleBadge.textContent = '👑 Premium';
    roleBadge.classList.remove('free');
  } else {
    roleBadge.textContent = '🆓 Free';
    roleBadge.classList.add('free');
  }
  
  // Puntos
  const puntosActuales = currentUser.puntos || 0;
  puntosBadge.textContent = `⭐ ${puntosActuales} pts`;
  localStorage.setItem('userPoints', puntosActuales); // Sincronizar con local por si acaso
  
  // Avatar
  if (currentUser.foto_perfil) {
    avatarImg.src = currentUser.foto_perfil;
  } else {
    avatarImg.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234caf50'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='45'%3E${(currentUser.nombre?.charAt(0) || currentUser.username?.charAt(0) || 'U').toUpperCase()}%3C/text%3E%3C/svg%3E`;
  }
  
  if (!esPerfilAjeno) {
    // Formulario
    perfilNombre.value = currentUser.nombre || '';
    perfilApellido.value = currentUser.apellido || '';
    perfilUsername.value = currentUser.username || currentUser.email?.split('@')[0] || '';
    perfilEmail.value = currentUser.email || '';
    perfilBio.value = currentUser.bio || '';
    
    // Preferencias
    preferenciasSeleccionadas = currentUser.preferencias || [];
    renderPreferencias();
    
    // Mostrar/ocultar sección de recompensas (solo Free)
    if (!esPremium && rewardsSection) {
      rewardsSection.style.display = 'block';
      renderRewards();
    } else if (rewardsSection) {
      rewardsSection.style.display = 'none';
    }
    
    // Mostrar botón de historial solo para Premium
    const historialBtn = document.getElementById('btn-historial');
    if (historialBtn) {
      historialBtn.style.display = esPremium ? 'flex' : 'none';
    }
    
    // Cargar estadísticas y recetas en paralelo
    await Promise.all([
      cargarMisRecetas(),
      cargarFavoritos(),
      cargarHistorial(),
      actualizarStats()
    ]);
  } else {
    // Perfil ajeno
    await cargarMisRecetas(currentUser.id);
    await actualizarStatsAjeno(currentUser.id);
  }
}

// Cargar mis recetas usando la API del backend
async function cargarMisRecetas(targetUserId = null) {
  const token = localStorage.getItem('token');
  try {
    let url;
    if (targetUserId) {
      // Perfil ajeno: usar endpoint público
      url = `/api/users/${targetUserId}/recipes`;
    } else {
      // Mis recetas: usar endpoint autenticado
      url = '/api/users/me/recipes';
    }

    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Error al cargar recetas');
    const data = await res.json();

    renderGrid('mis-recetas-grid', data || [], !targetUserId);
    if (statsRecetas) statsRecetas.textContent = data?.length || 0;
  } catch (error) {
    console.error('Error al cargar recetas:', error);
    renderGrid('mis-recetas-grid', [], !targetUserId);
  }
}

// Render preferencias
function renderPreferencias() {
  document.querySelectorAll('.pref-tag').forEach(tag => {
    const pref = tag.dataset.pref;
    tag.classList.toggle('selected', preferenciasSeleccionadas.includes(pref));
  });
}

// Render recompensas
function renderRewards() {
  if (!rewardsContainer) return;
  
  const puntosActuales = currentUser?.puntos || 0;
  const esPremium = currentUser?.es_premium || currentUser?.rol === 'premium';
  const prefs = currentUser?.preferencias || [];
  
  rewardsContainer.innerHTML = REWARDS.map(reward => {
    const canAfford = puntosActuales >= reward.points;
    let isActive = false;
    
    if (reward.id === '1day' || reward.id === '7days') {
      isActive = esPremium;
    } else if (reward.type && reward.type.startsWith('permiso_')) {
      const tagPrefix = `${reward.type.toUpperCase()}:`;
      isActive = prefs.some(p => typeof p === 'string' && p.startsWith(tagPrefix));
    }
    
    return `
      <div class="reward-card ${isActive ? 'active' : ''}">
        <span class="reward-icon">${reward.icon}</span>
        <div class="reward-title">${reward.name}</div>
        <div class="reward-points">${reward.points} pts</div>
        <div class="reward-benefit">${reward.benefit}</div>
        <button class="reward-btn ${isActive ? 'active' : ''}" 
          data-reward-id="${reward.id}" 
          data-points="${reward.points}" 
          data-days="${reward.days || 0}" 
          data-type="${reward.type || ''}" 
          ${!canAfford || isActive ? 'disabled' : ''}>
          ${isActive ? '✅ Activo' : canAfford ? 'Canjear' : 'Puntos insuficientes'}
        </button>
      </div>
    `;
  }).join('');
  
  // Event listeners para botones de canje
  document.querySelectorAll('.reward-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rewardId = btn.dataset.rewardId;
      const points = parseInt(btn.dataset.points);
      const days = parseInt(btn.dataset.days) || 0;
      const type = btn.dataset.type;
      await canjearRecompensa(rewardId, points, days, type);
    });
  });
}

// Canjear recompensa
async function canjearRecompensa(rewardId, puntosRequeridos, diasPremium, type) {
  if (!currentUser) return;
  
  const puntosActuales = currentUser.puntos || 0;
  
  if (puntosActuales < puntosRequeridos) {
    showToast(`Necesitas ${puntosRequeridos} puntos. Tienes ${puntosActuales}`, true);
    return;
  }
  
  if (!confirm(`¿Canjear ${rewardId} por ${puntosRequeridos} puntos?`)) return;
  
  try {
    const nuevosPuntos = puntosActuales - puntosRequeridos;
    
    // Actualización optimista de la UI
    currentUser.puntos = nuevosPuntos;
    puntosBadge.textContent = `⭐ ${nuevosPuntos} pts`;
    renderRewards(); 

    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/me/redeem', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rewardId, points: puntosRequeridos, days: diasPremium, type })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al canjear');
    }

    const data = await res.json();
    showToast(`✅ ${data.message || 'Canje exitoso'}`);
    
    // Sincronizar localmente con los datos finales del servidor
    currentUser.puntos = data.points;
    puntosBadge.textContent = `⭐ ${data.points} pts`;
    localStorage.setItem('userPoints', data.points);
    
    // Recargar perfil completo para reflejar cambios de rol/permisos
    await cargarPerfil();
    
  } catch (error) {
    console.error('Error al canjear:', error);
    showToast(error.message || 'Error al procesar el canje', true);
    
    // Revertir UI en caso de error
    currentUser.puntos = puntosActuales;
    puntosBadge.textContent = `⭐ ${puntosActuales} pts`;
    renderRewards();
  }
}

// Actualizar estadísticas ajenas
async function actualizarStatsAjeno(userId) {
  try {
    const [recetasRes] = await Promise.all([
      fetch(`/api/users/${userId}/recipes`)
    ]);
    const recetas = recetasRes.ok ? await recetasRes.json() : [];
    if (statsRecetas) statsRecetas.textContent = recetas.length || 0;
    // Favoritos y visitas son privados
    if (statsFavoritos) statsFavoritos.textContent = '-';
    if (statsVisitas) statsVisitas.textContent = '-';
  } catch (e) { console.error(e); }
}

// Actualizar estadísticas usando la API del backend
async function actualizarStats() {
  if (!currentUser) return;
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    const [recetasRes, favRes, histRes] = await Promise.all([
      fetch('/api/users/me/recipes', { headers }),
      fetch('/api/users/me/favorites', { headers }),
      fetch('/api/users/me/history', { headers }).catch(() => ({ ok: false }))
    ]);

    const recetas = recetasRes.ok ? await recetasRes.json() : [];
    const favoritos = favRes.ok ? await favRes.json() : [];
    const historial = histRes.ok ? await histRes.json() : [];

    if (statsRecetas) statsRecetas.textContent = recetas.length || 0;
    if (statsFavoritos) statsFavoritos.textContent = favoritos.length || 0;
    if (statsVisitas) statsVisitas.textContent = historial.length || 0;
  } catch (error) {
    console.error('Error al actualizar stats:', error);
  }
}

// Cargar favoritos
async function cargarFavoritos() {
  const token = localStorage.getItem('token');
  const API_BASE = '/api';

  try {
    const res = await fetch(`${API_BASE}/users/me/favorites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al cargar favoritos');
    const recetas = await res.json();
    renderGrid('favoritos-grid', recetas || [], false);
    if (statsFavoritos) statsFavoritos.textContent = recetas.length || 0;
  } catch (e) {
    console.error('Error al cargar favoritos:', e);
    renderGrid('favoritos-grid', [], false);
  }
}

// Cargar historial (solo Premium)
async function cargarHistorial() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/users/me/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 403) {
      // Usuario no es Premium, no es un error real para nosotros
      renderGrid('historial-grid', [], false);
      if (statsVisitas) statsVisitas.textContent = '0';
      return;
    }

    if (!res.ok) throw new Error('Error en API');
    const history = await res.json();
    renderGrid('historial-grid', history || [], false);
    if (statsVisitas) statsVisitas.textContent = history.length || 0;
  } catch (e) {
    console.error('Error al cargar historial:', e);
    renderGrid('historial-grid', [], false);
  }
}

// Render grid de recetas
function renderGrid(containerId, recetas, misRecetas) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!recetas.length) {
    const messages = {
      'mis-recetas-grid': { icon: '📝', text: 'No has subido recetas aún' },
      'favoritos-grid': { icon: '⭐', text: 'No tienes recetas favoritas' },
      'historial-grid': { icon: '👁️', text: 'No has visto recetas aún' }
    };
    const msg = messages[containerId] || { icon: '🍳', text: 'Sin recetas' };
    container.innerHTML = `<div class="vacio-mensaje"><span>${msg.icon}</span><p>${msg.text}</p></div>`;
    return;
  }
  
  container.innerHTML = recetas.map(r => {
    const img = r.imagen || imgPlaceholder();
    const btnEliminar = misRecetas 
      ? `<button class="btn-eliminar-receta-overlay" data-id="${r.id}" title="Eliminar receta">✖</button>`
      : '';
    
    return `
      <div class="receta-grid-item" data-id="${r.id}">
        <img src="${escapeHTML(img)}" alt="${escapeHTML(r.titulo)}" loading="lazy"
             onerror="this.src='${imgPlaceholder()}'">
        <div class="receta-overlay">
          <span>❤️ ${r.likes || 0}</span>
        </div>
        <div class="receta-titulo">${escapeHTML(r.titulo)}</div>
        ${btnEliminar}
      </div>
    `;
  }).join('');
  
  // Click para ver receta
  container.querySelectorAll('.receta-grid-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-eliminar-receta-overlay')) return;
      // Registrar vista en historial (solo Premium)
      if (currentUser?.es_premium) {
        await registrarVista(el.dataset.id);
      }
      window.location.href = `receta.html?id=${el.dataset.id}`;
    });
  });
  
  // Eliminar receta usando la API del backend (solo mis recetas)
  if (misRecetas) {
    container.querySelectorAll('.btn-eliminar-receta-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('¿Eliminar esta receta? Esta acción no se puede deshacer.')) return;
        
        const id = btn.dataset.id;
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
          showToast('Receta eliminada');
          await cargarMisRecetas();
          await actualizarStats();
        } catch (error) {
          console.error(error);
          showToast(error.message || 'Error al eliminar', true);
        }
      });
    });
  }
}

// Registrar vista en historial usando la API
async function registrarVista(recetaId) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch('/api/users/me/history', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipeId: parseInt(recetaId) })
    });
  } catch { /* silencioso */ }
}

// Guardar perfil
async function guardarPerfil() {
  const nombre = perfilNombre.value.trim();
  const apellido = perfilApellido.value.trim();
  const bio = perfilBio.value.trim();
  
  if (!nombre || !apellido) {
    showToast('Nombre y apellido son obligatorios', true);
    return;
  }
  
  guardarPerfilBtn.disabled = true;
  guardarPerfilBtn.textContent = 'Guardando...';
  
  const token = localStorage.getItem('token');
  const API_BASE = '/api';

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        nombre, 
        apellido, 
        bio, 
        preferencias: preferenciasSeleccionadas 
      })
    });

    if (!res.ok) throw new Error('Error en API');

    showToast('✅ Perfil actualizado');
    displayNombre.textContent = `${nombre} ${apellido}`;
    displayBio.textContent = bio || 'Sin biografía aún.';
    currentUser.nombre = nombre;
    currentUser.apellido = apellido;
    currentUser.bio = bio;
    currentUser.preferencias = preferenciasSeleccionadas;
    ocultarForm();
  } catch (err) {
    console.error('Error al guardar perfil:', err);
    showToast('Error al guardar perfil', true);
  } finally {
    guardarPerfilBtn.disabled = false;
    guardarPerfilBtn.textContent = '💾 Guardar cambios';
  }
}

// Cambiar avatar
async function cambiarAvatar(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Imagen máx. 2MB', true);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    
    const { error } = await supabase
      .from('usuarios')
      .update({ foto_perfil: base64 })
      .eq('id', currentUser.id);
    
    if (error) {
      showToast('Error al subir foto', true);
    } else {
      avatarImg.src = base64;
      showToast('📷 Foto de perfil actualizada');
      currentUser.foto_perfil = base64;
    }
  };
  reader.readAsDataURL(file);
}

// Mostrar/ocultar formulario
function mostrarForm() {
  const section = document.getElementById('perfil-form-section');
  if (section) section.classList.add('visible');
  toggleFormBtn.textContent = '✕ Cancelar edición';
  formVisible = true;
}

function ocultarForm() {
  const section = document.getElementById('perfil-form-section');
  if (section) section.classList.remove('visible');
  toggleFormBtn.textContent = '✏️ Editar perfil';
  formVisible = false;
  
  // Resetear formulario
  perfilNombre.value = currentUser.nombre || '';
  perfilApellido.value = currentUser.apellido || '';
  perfilBio.value = currentUser.bio || '';
  preferenciasSeleccionadas = currentUser.preferencias || [];
  renderPreferencias();
}

// Cambiar sección
function cambiarSeccion(seccion) {
  seccionActiva = seccion;
  
  const secciones = ['mis-recetas', 'favoritos', 'historial'];
  secciones.forEach(s => {
    const btn = document.getElementById(`btn-${s}`);
    const grid = document.getElementById(`${s}-grid`);
    const isActive = s === seccion;
    
    if (btn) btn.classList.toggle('active', isActive);
    if (grid) grid.style.display = isActive ? 'grid' : 'none';
  });
}

// Cerrar sesión
async function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  
  localStorage.clear();
  window.location.href = 'login.html';
}

// Event listeners
function initEventListeners() {
  toggleFormBtn?.addEventListener('click', () => {
    formVisible ? ocultarForm() : mostrarForm();
  });
  
  guardarPerfilBtn?.addEventListener('click', guardarPerfil);
  
  const btnLogoutMain = document.getElementById('cerrar-sesion-main-btn');
  btnLogoutMain?.addEventListener('click', cerrarSesion);
  
  avatarOverlay?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', e => cambiarAvatar(e.target.files[0]));
  
  document.getElementById('btn-mis-recetas')?.addEventListener('click', () => cambiarSeccion('mis-recetas'));
  document.getElementById('btn-favoritos')?.addEventListener('click', () => cambiarSeccion('favoritos'));
  document.getElementById('btn-historial')?.addEventListener('click', () => cambiarSeccion('historial'));
  
  document.querySelectorAll('.pref-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const pref = tag.dataset.pref;
      if (preferenciasSeleccionadas.includes(pref)) {
        preferenciasSeleccionadas = preferenciasSeleccionadas.filter(p => p !== pref);
        tag.classList.remove('selected');
      } else {
        preferenciasSeleccionadas.push(pref);
        tag.classList.add('selected');
      }
    });
  });
}

// Inicializar
async function init() {
  await cargarPerfil();
  initEventListeners();
  cambiarSeccion('mis-recetas');
}

init();