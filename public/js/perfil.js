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
  { id: '1day', name: '1 día Premium', points: 100, icon: '👑', benefit: 'Acceso Premium por 1 día', days: 1 },
  { id: '3days', name: '3 días Premium', points: 300, icon: '👑✨', benefit: 'Acceso Premium por 3 días', days: 3 },
  { id: 'videos', name: 'Desbloquear Videos', points: 500, icon: '🎥', benefit: 'Acceso a videos de recetas', type: 'videos' },
  { id: 'recipes', name: 'Desbloquear Recetas Premium', points: 700, icon: '🔓', benefit: 'Acceso a recetas exclusivas', type: 'recipes' },
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
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  
  if (!userId || !token) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const API_BASE = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
      ? 'http://localhost:3000/api'
      : window.location.origin + '/api';

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.clear();
      window.location.href = 'login.html';
      return;
    }

    currentUser = await res.json();
  } catch (e) {
    console.error('Error cargando perfil:', e);
    showToast('Error al cargar perfil', true);
    return;
  }

  // Mostrar información
  displayUsername.textContent = `@${currentUser.username || currentUser.email?.split('@')[0]}`;
  displayNombre.textContent = `${currentUser.nombre || ''} ${currentUser.apellido || ''}`;
  displayBio.textContent = currentUser.bio || 'Sin biografía aún.';
  
  // Badge de rol
  if (currentUser.es_premium) {
    roleBadge.textContent = '👑 Premium';
    roleBadge.classList.remove('free');
  } else {
    roleBadge.textContent = '🆓 Free';
    roleBadge.classList.add('free');
  }
  
  // Puntos
  puntosBadge.textContent = `⭐ ${currentUser.puntos || 0} pts`;
  
  // Avatar
  if (currentUser.foto_perfil) {
    avatarImg.src = currentUser.foto_perfil;
  } else {
    avatarImg.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234caf50'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='45'%3E${(currentUser.nombre?.charAt(0) || 'U')}%3C/text%3E%3C/svg%3E`;
  }
  
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
  if (!currentUser.es_premium && rewardsSection) {
    rewardsSection.style.display = 'block';
    renderRewards();
  } else if (rewardsSection) {
    rewardsSection.style.display = 'none';
  }
  
  // Mostrar botón de historial solo para Premium
  const historialBtn = document.getElementById('btn-historial');
  if (historialBtn) {
    historialBtn.style.display = currentUser.es_premium ? 'flex' : 'none';
  }
  
  // Cargar estadísticas y recetas
  await cargarMisRecetas();
  await cargarFavoritos();
  if (currentUser.es_premium) {
    await cargarHistorial();
  }
  
  // Actualizar stats (opcional si ya vienen en cargarPerfil)
  if (currentUser.stats) {
    statsRecetas.textContent = currentUser.stats.recetas || 0;
    statsFavoritos.textContent = currentUser.stats.favoritos || 0;
    statsVisitas.textContent = currentUser.stats.historial || 0;
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
  
  rewardsContainer.innerHTML = REWARDS.map(reward => {
    const canAfford = puntosActuales >= reward.points;
    return `
      <div class="reward-card">
        <span class="reward-icon">${reward.icon}</span>
        <div class="reward-title">${reward.name}</div>
        <div class="reward-points">${reward.points} pts</div>
        <div class="reward-benefit">${reward.benefit}</div>
        <button class="reward-btn" data-reward-id="${reward.id}" data-points="${reward.points}" data-days="${reward.days || 0}" data-type="${reward.type || ''}" ${!canAfford ? 'disabled' : ''}>
          ${canAfford ? 'Canjear' : 'Puntos insuficientes'}
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
    
    // Actualizar puntos en Supabase
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ puntos: nuevosPuntos })
      .eq('id', currentUser.id);
    
    if (updateError) throw updateError;
    
    // Si es canje de días Premium
    if (diasPremium > 0) {
      let premiumHasta = new Date();
      if (currentUser.premium_hasta && new Date(currentUser.premium_hasta) > new Date()) {
        premiumHasta = new Date(currentUser.premium_hasta);
      }
      premiumHasta.setDate(premiumHasta.getDate() + diasPremium);
      
      await supabase
        .from('usuarios')
        .update({ 
          es_premium: true, 
          rol: 'premium',
          premium_hasta: premiumHasta.toISOString()
        })
        .eq('id', currentUser.id);
      
      showToast(`🎉 ¡${diasPremium} días Premium activados!`, false);
    } else if (type === 'videos') {
      showToast(`🎥 ¡Videos Premium desbloqueados permanentemente!`, false);
    } else if (type === 'recipes') {
      showToast(`🔓 ¡Recetas Premium desbloqueadas!`, false);
    } else {
      showToast(`✅ Recompensa canjeada: ${rewardId}`, false);
    }
    
    // Actualizar UI
    currentUser.puntos = nuevosPuntos;
    puntosBadge.textContent = `⭐ ${nuevosPuntos} pts`;
    
    // Recargar recompensas
    renderRewards();
    
    // Recargar perfil completo para reflejar cambios
    setTimeout(() => cargarPerfil(), 1000);
    
  } catch (error) {
    console.error('Error al canjear:', error);
    showToast('Error al procesar el canje', true);
  }
}

// Cargar mis recetas
async function cargarMisRecetas() {
  const { data, error } = await supabase
    .from('recetas')
    .select('*')
    .eq('usuario_id', currentUser.id)
    .order('fecha', { ascending: false });
  
  if (error) {
    console.error('Error al cargar recetas:', error);
    renderGrid('mis-recetas-grid', [], true);
    return;
  }
  
  renderGrid('mis-recetas-grid', data || [], true);
  statsRecetas.textContent = data?.length || 0;
}

// Cargar favoritos
async function cargarFavoritos() {
  const token = localStorage.getItem('token');
  const API_BASE = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  try {
    const res = await fetch(`${API_BASE}/users/me/favorites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error');
    const recetas = await res.json();
    renderGrid('favoritos-grid', recetas, false);
    statsFavoritos.textContent = recetas.length;
  } catch (e) {
    console.error('Error al cargar favoritos:', e);
    renderGrid('favoritos-grid', [], false);
  }
}

// Cargar historial (solo Premium)
async function cargarHistorial() {
  if (!currentUser?.es_premium) return;
  
  const { data, error } = await supabase
    .from('historial')
    .select('receta:receta_id(*)')
    .eq('usuario_id', currentUser.id)
    .order('fecha', { ascending: false })
    .limit(30);
  
  if (error) {
    console.error('Error al cargar historial:', error);
    renderGrid('historial-grid', [], false);
    return;
  }
  
  const recetas = (data || []).map(h => h.receta).filter(r => r);
  renderGrid('historial-grid', recetas, false);
  statsVisitas.textContent = recetas.length;
}

// Actualizar estadísticas
async function actualizarStats() {
  const [{ count: recetas }, { count: favoritos }, { count: visitas }] = await Promise.all([
    supabase.from('recetas').select('id', { count: 'exact', head: true }).eq('usuario_id', currentUser.id),
    supabase.from('favoritos').select('id', { count: 'exact', head: true }).eq('usuario_id', currentUser.id),
    supabase.from('historial').select('id', { count: 'exact', head: true }).eq('usuario_id', currentUser.id)
  ]);
  
  statsRecetas.textContent = recetas || 0;
  statsFavoritos.textContent = favoritos || 0;
  statsVisitas.textContent = visitas || 0;
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
  
  // Eliminar receta (solo mis recetas)
  if (misRecetas) {
    container.querySelectorAll('.btn-eliminar-receta-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('¿Eliminar esta receta? Esta acción no se puede deshacer.')) return;
        
        const id = btn.dataset.id;
        const { error } = await supabase
          .from('recetas')
          .delete()
          .eq('id', id)
          .eq('usuario_id', currentUser.id);
        
        if (error) {
          showToast('Error al eliminar', true);
        } else {
          showToast('Receta eliminada');
          await cargarMisRecetas();
          await actualizarStats();
        }
      });
    });
  }
}

// Registrar vista en historial
async function registrarVista(recetaId) {
  if (!currentUser?.es_premium) return;
  
  const { error } = await supabase
    .from('historial')
    .insert({
      receta_id: parseInt(recetaId),
      usuario_id: currentUser.id,
      fecha: new Date().toISOString()
    });
  
  if (error) {
    // Si ya existe, actualizar fecha
    await supabase
      .from('historial')
      .update({ fecha: new Date().toISOString() })
      .eq('receta_id', parseInt(recetaId))
      .eq('usuario_id', currentUser.id);
  }
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
  const API_BASE = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ nombre, apellido, bio, preferencias: preferenciasSeleccionadas })
  }).catch(() => null);

  if (!res || !res.ok) {
    // Fallback: intentar con Supabase directamente
    const { error } = await supabase.from('usuarios').update({ nombre, apellido, bio, preferencias: preferenciasSeleccionadas }).eq('id', currentUser.id);
    if (error) {
      showToast('Error al guardar', true);
      guardarPerfilBtn.disabled = false;
      guardarPerfilBtn.textContent = '💾 Guardar cambios';
      return;
    }
  }

  if (true) {
    showToast('✅ Perfil actualizado');
    displayNombre.textContent = `${nombre} ${apellido}`;
    displayBio.textContent = bio || 'Sin biografía aún.';
    currentUser.nombre = nombre;
    currentUser.apellido = apellido;
    currentUser.bio = bio;
    currentUser.preferencias = preferenciasSeleccionadas;
    ocultarForm();
  }
  
  guardarPerfilBtn.disabled = false;
  guardarPerfilBtn.textContent = '💾 Guardar cambios';
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
  cerrarSesionBtn?.addEventListener('click', cerrarSesion);
  
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