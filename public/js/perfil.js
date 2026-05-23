// perfil.js
import { supabase } from './supabaseClient.js';


const displayUsername  = document.getElementById('display-username');
const displayNombre    = document.getElementById('display-nombre');
const displayBio       = document.getElementById('display-bio');
const displayEmail     = document.getElementById('display-email');
const roleBadge        = document.getElementById('role-badge');
const puntosBadge      = document.getElementById('puntos-badge');
const avatarImg        = document.getElementById('avatar-img');
const avatarInput      = document.getElementById('avatar-input');
const avatarOverlay    = document.getElementById('avatar-overlay-btn');
const toggleFormBtn    = document.getElementById('toggle-form-btn');
const guardarPerfilBtn = document.getElementById('guardar-perfil-btn');
const notifToast       = document.getElementById('notif-toast');

const perfilNombre    = document.getElementById('perfil-nombre');
const perfilApellido  = document.getElementById('perfil-apellido');
const perfilUsername  = document.getElementById('perfil-username');
const perfilEmail     = document.getElementById('perfil-email');
const perfilBio       = document.getElementById('perfil-bio');

const statsRecetas   = document.getElementById('stats-recetas');
const statsFavoritos = document.getElementById('stats-favoritos');
const statsVisitas   = document.getElementById('stats-visitas');

const rewardsSection   = document.getElementById('rewards-section');
const rewardsContainer = document.getElementById('rewards-container');

let currentUser                = null;
let preferenciasSeleccionadas  = [];
let seccionActiva              = 'mis-recetas';
let formVisible                = false;
let tarjetaSeleccionadaId      = null;

const REWARDS = [
  { id: 'comentarios_1d', name: 'Permiso Comentarios (1 día)', points: 50,  icon: 'message-square', benefit: 'Comenta en cualquier receta por 24h', days: 1, type: 'permiso_comentarios' },
  { id: 'videos_3d',      name: 'Pase de Videos (3 días)',      points: 300, icon: 'video',          benefit: 'Acceso a videos por 72h',           days: 3, type: 'videos' },
  { id: 'historial_1d',   name: 'Acceso Historial (1 día)',     points: 200, icon: 'history',        benefit: 'Ver tu historial de recetas por 24h',   days: 1, type: 'permiso_historial' },
  { id: 'comunidad_1d',   name: 'Acceso Comunidad (1 día)',     points: 250, icon: 'users',          benefit: 'Ver actividad de la comunidad por 24h', days: 1, type: 'permiso_comunidad' },
  { id: '1day_premium',   name: '1 día Premium',               points: 120, icon: 'crown',          benefit: 'Acceso Premium TOTAL por 1 día',       days: 1 },
  { id: '5days_premium',  name: '5 días Premium',               points: 500, icon: 'sparkles',       benefit: 'Acceso Premium por 5 días',          days: 5 }
];

const PROFANITY = ['puto', 'puta', 'mierda', 'pendejo', 'pendeja', 'culero', 'cabron', 'chinga', 'verga', 'pito', 'fuck', 'shit', 'asshole', 'idiota', 'estupido'];

const VALIDAR = {
  isInvalidContent: (s) => {
    if (!s) return false;
    const lower = s.toLowerCase();
    const isOffensive = PROFANITY.some(word => lower.includes(word));
    const isGibberish = s.length > 10 && !/[aeiouáéíóúü]/i.test(s);
    const isRepeated = /(.)\1{4,}/.test(s);
    return isOffensive || isGibberish || isRepeated;
  },
  nombre: (s) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(s) && !VALIDAR.isInvalidContent(s),
  tarjeta: (s) => {
    const raw = s.replace(/\D/g, '');
    if (raw.length !== 16) return false;
    if (/(\d)\1{15}/.test(raw)) return false; 
    if ("1234567890123456789".includes(raw)) return false;
    let sum = 0;
    for (let i = 0; i < raw.length; i++) {
      let intVal = parseInt(raw.substr(i, 1));
      if (i % 2 === 0) {
        intVal *= 2;
        if (intVal > 9) intVal = 1 + (intVal % 10);
      }
      sum += intVal;
    }
    return sum % 10 === 0;
  }
};

function showToast(message, isError = false) {
  if (!notifToast) return;
  notifToast.textContent = message;
  notifToast.className = 'notification-toast' + (isError ? ' error' : '');
  notifToast.classList.add('show');
  setTimeout(() => notifToast.classList.remove('show'), 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function imgPlaceholder() {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23FDFBF7'/%3E%3Ccircle cx='50' cy='38' r='20' fill='%23E07A5F'/%3E%3Cpath d='M20 90 c0-25 15-35 30-35 s30 10 30 35' fill='%23E07A5F'/%3E%3C/svg%3E`;
}

async function cargarPerfil() {
  const urlParams    = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('id');
  const myUserId     = localStorage.getItem('userId');
  const token        = localStorage.getItem('token');
  const esPerfilAjeno = targetUserId && targetUserId !== myUserId
    && targetUserId !== 'null' && targetUserId !== 'undefined';

  if (!myUserId && !esPerfilAjeno) { window.location.href = 'login.html'; return; }

  try {
    const API_BASE = '/api';
    let res;
    if (esPerfilAjeno) {
      res = await fetch(`${API_BASE}/users/${targetUserId}/profile`);
      if (avatarOverlay)  avatarOverlay.style.display  = 'none';
      if (toggleFormBtn)  toggleFormBtn.style.display  = 'none';
      if (rewardsSection) rewardsSection.style.display = 'none';
      const favBtn  = document.getElementById('btn-favoritos');
      const histBtn = document.getElementById('btn-historial');
      const likesBtn = document.getElementById('btn-likes');
      if (favBtn)  favBtn.style.display  = 'none';
      if (histBtn) histBtn.style.display = 'none';
      if (likesBtn) likesBtn.style.display = 'none';
      const feedbackBtn = document.getElementById('feedback-btn');
      const logoutBtn = document.getElementById('cerrar-sesion-main-btn');
      if (feedbackBtn) feedbackBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    } else {
      if (!token) { window.location.href = 'login.html'; return; }
      res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    if (!res.ok) {
      if (!esPerfilAjeno) { localStorage.clear(); window.location.href = 'login.html'; }
      else showToast('Usuario no encontrado', true);
      return;
    }

    currentUser = await res.json();
  } catch (e) {
    console.error('Error cargando perfil:', e);
    showToast('Error al cargar perfil', true);
    return;
  }

  preferenciasSeleccionadas = Array.isArray(currentUser.preferencias)
    ? currentUser.preferencias.filter(p => typeof p === 'string' && !p.startsWith('PERMISO_'))
    : [];

  displayUsername.textContent = `@${currentUser.username || 'usuario'}`;
  displayNombre.textContent   = `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() || 'Usuario sin nombre';
  displayBio.textContent      = currentUser.bio || 'Sin biografía aún.';
  
  if (!esPerfilAjeno) {
    if (displayEmail) displayEmail.innerHTML = `<i data-lucide="mail"></i> ${currentUser.email || ''}`;
  } else {
    if (displayEmail) displayEmail.style.display = 'none';
  }

  const esPremium = currentUser.es_premium || currentUser.esPremium;
  roleBadge.innerHTML = esPremium ? '<i data-lucide="crown"></i> Premium' : 'Free';
  roleBadge.classList.toggle('free', !esPremium);

  if (esPerfilAjeno) {
    if (puntosBadge) puntosBadge.style.display = 'none';
  } else {
    if (puntosBadge) {
      puntosBadge.style.display = '';
      puntosBadge.innerHTML = `<i data-lucide="star"></i> ${currentUser.puntos || 0} pts`;
    }
    localStorage.setItem('userPoints', currentUser.puntos || 0);
  }

  avatarImg.src = currentUser.foto_perfil || imgPlaceholder();

  if (!esPerfilAjeno) {
    if (rewardsSection) rewardsSection.style.display = esPremium ? 'none' : 'block';
    if (!esPremium) renderRewards();

    const premiumManageSection  = document.getElementById('premium-manage-section');
    const premiumActiveInfo     = document.getElementById('premium-active-info');
    const premiumInactiveInfo   = document.getElementById('premium-inactive-info');
    const premiumExpiryText     = document.getElementById('premium-expiry-date');
    const cancelNote            = document.getElementById('cancel-note');
    const btnRenew              = document.getElementById('btn-renew-premium');
    const btnCancel             = document.getElementById('btn-cancel-premium');

    if (premiumManageSection) {
      premiumManageSection.style.display = 'block';

      if (esPremium) {
        premiumActiveInfo.style.display   = 'block';
        premiumInactiveInfo.style.display = 'none';

        if (currentUser.premium_hasta) {
          const d = new Date(currentUser.premium_hasta);
          premiumExpiryText.textContent = !isNaN(d.getTime())
            ? d.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' })
            : 'Indefinido';
        } else {
          premiumExpiryText.textContent = 'Fecha no disponible';
        }

        const estadoElemento = premiumActiveInfo.querySelector('strong');

        if (currentUser.premium_cancelado) {
          if (estadoElemento) {
            estadoElemento.textContent = 'Activa (cancelada al final del periodo)';
            estadoElemento.style.color = '#E07A5F';
          }
          if (cancelNote) cancelNote.style.display = 'block';
          if (btnCancel)  btnCancel.style.display  = 'none';
          if (btnRenew)   btnRenew.innerHTML      = '<i data-lucide="refresh-cw"></i> Reactivar membresía';
          if (btnRenew)   btnRenew.disabled          = false;
        } else {
          if (estadoElemento) {
            estadoElemento.textContent = 'Activo';
            estadoElemento.style.color = '#E07A5F';
          }
          if (cancelNote) cancelNote.style.display = 'none';
          if (btnCancel)  btnCancel.style.display  = 'inline-block';

          // Bloquear renovación si quedan más de 7 días
          if (btnRenew) {
            const diasRestantes = currentUser.premium_hasta
              ? Math.floor((new Date(currentUser.premium_hasta) - new Date()) / (1000 * 60 * 60 * 24))
              : 0;

            if (diasRestantes > 7) {
              btnRenew.disabled   = true;
              btnRenew.title      = `Podrás renovar cuando queden 7 días o menos (te quedan ${diasRestantes} días)`;
              btnRenew.innerHTML = `<i data-lucide="lock"></i> Renovar (disponible en ${diasRestantes - 7} días)`;
            } else {
              btnRenew.disabled    = false;
              btnRenew.title       = '';
              btnRenew.innerHTML = '<i data-lucide="refresh-cw"></i> Renovar ahora';
            }
          }
        }
      } else {
        premiumActiveInfo.style.display   = 'none';
        premiumInactiveInfo.style.display = 'block';
      }
    }

    await Promise.all([
      cargarMisRecetas(),
      cargarFavoritos(),
      cargarLikes(),
      cargarHistorial(),
      actualizarStats()
    ]);
  } else {
    const premiumManageSection = document.getElementById('premium-manage-section');
    if (premiumManageSection) premiumManageSection.style.display = 'none';
    if (rewardsSection) rewardsSection.style.display = 'none';
    
    await Promise.all([
      cargarMisRecetas(currentUser.id),
      actualizarStatsAjeno(currentUser.id)
    ]);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function cargarMisRecetas(targetUserId = null) {
  const token = localStorage.getItem('token');
  try {
    const url = targetUserId ? `/api/users/${targetUserId}/recipes` : '/api/users/me/recipes';
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

function renderPreferencias() {
  document.querySelectorAll('.pref-tag').forEach(tag => {
    const pref = tag.dataset.pref;
    tag.classList.toggle('selected', preferenciasSeleccionadas.includes(pref));
  });
}

// One-time delegated listener — set up once, survives re-renders
function initRewardsDelegation() {
  if (!rewardsContainer) return;
  rewardsContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.reward-btn');
    if (!btn || btn.disabled || btn.dataset.loading === 'true') return;

    const rewardId     = btn.dataset.rewardId;
    const points       = parseInt(btn.dataset.points)  || 0;
    const days         = parseInt(btn.dataset.days)    || 0;
    const type         = btn.dataset.type              || '';

    await canjearRecompensa(rewardId, points, days, type);
  });
}

function renderRewards() {
  if (!rewardsContainer) return;
  const puntosActuales = currentUser?.puntos || 0;
  const esPremium = currentUser?.es_premium || currentUser?.rol === 'premium';
  const prefs = currentUser?.preferencias || [];

  rewardsContainer.innerHTML = REWARDS.map(reward => {
    const canAfford = puntosActuales >= reward.points;
    let isActive = false;
    if (reward.id === '1day_premium' || reward.id === '5days_premium') {
      isActive = esPremium;
    } else if (reward.type === 'videos') {
      const tagPrefix = 'PERMISO_VIDEOS:';
      const matchingPref = prefs.find(p => typeof p === 'string' && p.startsWith(tagPrefix));
      if (matchingPref) {
        const expStr = matchingPref.substring(matchingPref.indexOf(':') + 1);
        isActive = expStr !== 'PERMANENT' && new Date(expStr) > new Date();
      }
    } else if (reward.type && reward.type.startsWith('permiso_')) {
      const tagKey = reward.type.replace('permiso_', '').toUpperCase();
      const tagPrefix = `PERMISO_${tagKey}:`;
      const matchingPref = prefs.find(p => typeof p === 'string' && p.startsWith(tagPrefix));
      if (matchingPref) {
        const expStr = matchingPref.substring(matchingPref.indexOf(':') + 1);
        isActive = expStr !== 'PERMANENT' && new Date(expStr) > new Date();
      }
    }
    return `
      <div class="reward-card ${isActive ? 'active' : ''}">
        <span class="reward-icon"><i data-lucide="${reward.icon}"></i></span>
        <div class="reward-title">${reward.name}</div>
        <div class="reward-points">${reward.points} pts</div>
        <div class="reward-benefit">${reward.benefit}</div>
        <button class="reward-btn ${isActive ? 'active' : ''}"
          data-reward-id="${reward.id}"
          data-points="${reward.points}"
          data-days="${reward.days || 0}"
          data-type="${reward.type || ''}"
          ${!canAfford || isActive ? 'disabled' : ''}>
          ${isActive ? '<i data-lucide="check"></i> Activo' : canAfford ? 'Canjear' : 'Puntos insuficientes'}
        </button>
      </div>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function canjearRecompensa(rewardId, puntosRequeridos, diasPremium, type) {
  if (!currentUser) return;

  const puntosActuales = currentUser.puntos || 0;
  if (puntosActuales < puntosRequeridos) {
    showToast(`Necesitas ${puntosRequeridos} pts. Tienes ${puntosActuales}`, true);
    return;
  }

  // Lock the button immediately — no confirm() dialog
  const btnEl = rewardsContainer?.querySelector(`[data-reward-id="${rewardId}"]`);
  if (btnEl) {
    btnEl.dataset.loading = 'true';
    btnEl.disabled = true;
    btnEl.textContent = 'Canjeando...';
  }

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/me/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ rewardId, points: puntosRequeridos, days: diasPremium, type })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const data = await res.json();

    // Patch currentUser in-memory — no full page reload
    currentUser.puntos = data.points;
    if (data.es_premium !== undefined) {
      currentUser.es_premium = data.es_premium;
      currentUser.esPremium  = data.es_premium;
    }
    if (data.rol         !== undefined) currentUser.rol          = data.rol;
    if (data.preferencias !== undefined) currentUser.preferencias = data.preferencias;

    // Update the points badge
    if (puntosBadge) {
      puntosBadge.innerHTML = `<i data-lucide="star"></i> ${data.points} pts`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    localStorage.setItem('userPuntos', data.points);
    if (data.es_premium !== undefined)   localStorage.setItem('userPremium', data.es_premium);
    if (data.rol !== undefined)          localStorage.setItem('userRol', data.rol);
    if (data.preferencias !== undefined) localStorage.setItem('userPrefs', JSON.stringify(data.preferencias));

    showToast('✅ ' + (data.message || 'Canje exitoso'));

    // Hide rewards section if premium just activated; otherwise refresh cards
    const esPremiumNow = currentUser.es_premium || currentUser.rol === 'premium';
    if (esPremiumNow && (rewardId === '1day_premium' || rewardId === '5days_premium')) {
      if (rewardsSection) rewardsSection.style.display = 'none';
    } else {
      renderRewards();
    }

  } catch (err) {
    showToast(err.message || 'Error al procesar el canje', true);
    // Restore the button so user can retry
    if (btnEl) {
      btnEl.dataset.loading = 'false';
      btnEl.disabled = false;
      btnEl.textContent = 'Canjear';
    }
  }
}

async function actualizarStatsAjeno(userId) {
  try {
    const res = await fetch(`/api/users/${userId}/recipes`);
    const recetas = res.ok ? await res.json() : [];
    if (statsRecetas)   statsRecetas.textContent   = recetas.length || 0;
    if (statsFavoritos) statsFavoritos.textContent = '-';
    if (statsVisitas)   statsVisitas.textContent   = '-';
  } catch (e) { console.error(e); }
}

async function actualizarStats() {
  if (!currentUser) return;
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };
  try {
    const [recetasRes, favRes, histRes] = await Promise.all([
      fetch('/api/users/me/recipes',  { headers }),
      fetch('/api/users/me/favorites',{ headers }),
      fetch('/api/users/me/history',  { headers }).catch(() => ({ ok: false }))
    ]);
    const recetas   = recetasRes.ok  ? await recetasRes.json()  : [];
    const favoritos = favRes.ok      ? await favRes.json()      : [];
    const historial = histRes.ok     ? await histRes.json()     : [];
    if (statsRecetas)   statsRecetas.textContent   = recetas.length   || 0;
    if (statsFavoritos) statsFavoritos.textContent = favoritos.length || 0;
    if (statsVisitas)   statsVisitas.textContent   = historial.length || 0;
  } catch (error) {
    console.error('Error al actualizar stats:', error);
  }
}

async function cargarFavoritos() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/users/me/favorites', {
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

async function cargarLikes() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch('/api/users/me/likes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al cargar likes');
    const recetas = await res.json();
    renderGrid('likes-grid', recetas || [], false);
  } catch (e) {
    console.error('Error al cargar likes:', e);
    renderGrid('likes-grid', [], false);
  }
}

async function cargarHistorial() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/users/me/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 403) {
      renderGrid('historial-grid', [], false, true);
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

function renderGrid(containerId, recetas, misRecetas, isLocked = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (isLocked) {
    container.innerHTML = `
      <div class="premium-lock-box">
        <div class="lock-icon-wrapper"><i data-lucide="lock" style="width: 48px; height: 48px;"></i></div>
        <h3>Contenido Premium</h3>
        <p>
          Esta sección es exclusiva para usuarios <strong>Premium</strong> <i data-lucide="crown" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></i>
        </p>
        <button id="btn-upgrade-from-grid" class="btn-premium-upgrade" onclick="abrirModalPago()">
          Mejorar Cuenta <i data-lucide="arrow-right" style="width:16px;"></i>
        </button>
      </div>`;
    if (window.lucide) {
      window.lucide.createIcons();
    }
    return;
  }

  if (!recetas.length) {
    const messages = {
      'mis-recetas-grid': { icon: 'file-text', text: 'No has subido recetas aún' },
      'favoritos-grid':   { icon: 'star', text: 'No tienes recetas guardadas' },
      'likes-grid':       { icon: 'heart', text: 'Aún no has dado like a ninguna receta' },
      'historial-grid':   { icon: 'history', text: 'No has visto recetas aún' }
    };
    const msg = messages[containerId] || { icon: 'chef-hat', text: 'Sin recetas' };
    container.innerHTML = `<div class="vacio-mensaje"><i data-lucide="${msg.icon}" style="width:48px;height:48px;color:#ccc;margin-bottom:10px;"></i><p>${msg.text}</p></div>`;
    return;
  }

  container.innerHTML = recetas.map(r => {
    const img = r.imagen || imgPlaceholder();
    let btnEliminar = '';
    if (misRecetas) {
      btnEliminar = `<button class="btn-eliminar-receta-overlay" data-id="${r.id}" title="Eliminar receta"><i data-lucide="trash-2"></i></button>`;
    } else if (containerId === 'historial-grid') {
      btnEliminar = `<button class="btn-eliminar-historial-overlay" data-id="${r.id}" title="Quitar de historial"><i data-lucide="x"></i></button>`;
    } else if (containerId === 'favoritos-grid') {
      btnEliminar = `<button class="btn-eliminar-favorito-overlay" data-id="${r.id}" title="Quitar de favoritos"><i data-lucide="trash-2"></i></button>`;
    } else if (containerId === 'likes-grid') {
      btnEliminar = `<button class="btn-eliminar-like-overlay" data-id="${r.id}" title="Quitar like"><i data-lucide="trash-2"></i></button>`;
    }
    return `
      <div class="receta-grid-item" data-id="${r.id}">
        <img src="${escapeHTML(img)}" alt="${escapeHTML(r.titulo)}" loading="lazy"
             onerror="this.src='${imgPlaceholder()}'">
          <div class="receta-overlay">
            <span>Ver detalles</span>
          </div>
          <div class="receta-info-pie">
            <div class="receta-titulo">${escapeHTML(r.titulo)}</div>
            <div class="receta-meta-pie">
              <span class="receta-likes-pie"><i data-lucide="heart" style="${r.likedByUser ? 'fill:#E07A5F;color:#E07A5F;' : ''}"></i> ${r.likes || 0}</span>
              ${r.favoriteByUser || containerId === 'favoritos-grid' ? '<i data-lucide="star" class="receta-star-pie"></i>' : ''}
            </div>
          </div>
          ${btnEliminar}
        </div>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  container.querySelectorAll('.receta-grid-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-eliminar-receta-overlay')) return;
      if (e.target.closest('.btn-eliminar-historial-overlay')) return;
      if (e.target.closest('.btn-eliminar-favorito-overlay')) return;
      if (e.target.closest('.btn-eliminar-like-overlay')) return;
      window.location.href = `receta.html?id=${el.dataset.id}`;
    });
  });

  if (misRecetas) {
    container.querySelectorAll('.btn-eliminar-receta-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm('¿Seguro que quieres eliminar esta receta?')) return;
        const res = await fetch(`/api/recipes/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) { showToast('Receta eliminada'); cargarMisRecetas(); }
        else showToast('Error al eliminar', true);
      });
    });
  }

  if (containerId === 'historial-grid') {
    container.querySelectorAll('.btn-eliminar-historial-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          const res = await fetch(`/api/users/me/history/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) { showToast('Eliminado del historial'); cargarHistorial(); actualizarStats(); }
          else showToast('Error al eliminar', true);
        } catch (error) { showToast('Error al eliminar', true); }
      });
    });
  }

  if (containerId === 'favoritos-grid') {
    container.querySelectorAll('.btn-eliminar-favorito-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          const res = await fetch(`/api/recipes/${id}/favorite`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) { showToast('Eliminado de favoritos'); cargarFavoritos(); actualizarStats(); }
          else showToast('Error al eliminar', true);
        } catch (error) { showToast('Error al eliminar', true); }
      });
    });
  }

  if (containerId === 'likes-grid') {
    container.querySelectorAll('.btn-eliminar-like-overlay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          const res = await fetch(`/api/recipes/${id}/like`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) { showToast('Eliminado de likes'); cargarLikes(); actualizarStats(); }
          else showToast('Error al eliminar', true);
        } catch (error) { showToast('Error al eliminar', true); }
      });
    });
  }
}

async function registrarVista(recetaId) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch('/api/users/me/history', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: parseInt(recetaId) })
    });
  } catch { }
}

async function guardarPerfil() {
  const nombre   = perfilNombre.value.trim();
  const apellido = perfilApellido.value.trim();
  const username = perfilUsername.value.trim();
  const bio      = perfilBio.value.trim();

  if (!username) { showToast('El nombre de usuario es obligatorio', true); return; }
  if (!VALIDAR.nombre(nombre)) return showToast('Escribe un nombre válido (solo letras)', true);
  if (!VALIDAR.nombre(apellido)) return showToast('Escribe un apellido válido (solo letras)', true);
  if (VALIDAR.isInvalidContent(username) || VALIDAR.isInvalidContent(bio)) {
    return showToast('El contenido del perfil (usuario o bio) tiene palabras no permitidas o es incoherente', true);
  }

  guardarPerfilBtn.disabled   = true;
  guardarPerfilBtn.textContent = 'Guardando...';

  const token = localStorage.getItem('token');
  try {
    // Preserve active PERMISO_ tags — these are earned via point redemption and must not be wiped on profile save
    const permisosActivos = (Array.isArray(currentUser.preferencias) ? currentUser.preferencias : [])
      .filter(p => typeof p === 'string' && p.startsWith('PERMISO_'));
    const prefsFinales = [...preferenciasSeleccionadas, ...permisosActivos];

    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        nombre, apellido, username, bio,
        preferencias: prefsFinales,
        foto_perfil: currentUser.foto_perfil
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en API');

    showToast('Perfil actualizado');
    currentUser.nombre   = nombre;
    currentUser.apellido = apellido;
    currentUser.username = data.username || username;
    currentUser.bio      = bio;
    currentUser.preferencias = prefsFinales;
    
    displayUsername.textContent = `@${currentUser.username}`;
    displayNombre.textContent = `${nombre} ${apellido}`.trim();
    displayBio.textContent = bio || 'Sin biografía aún.';
    // Sincronizar caché local
    localStorage.setItem('userName', currentUser.username);
    localStorage.setItem('userData', JSON.stringify(currentUser));

    ocultarForm();
  } catch (err) {
    console.error('Error al guardar perfil:', err);
    showToast(err.message || 'Error al guardar perfil', true);
  } finally {
    guardarPerfilBtn.disabled   = false;
    guardarPerfilBtn.innerHTML = '<i data-lucide="save"></i> Guardar cambios';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

async function cambiarAvatar(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Imagen máx. 2MB', true); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ foto_perfil: base64 })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar foto');
      }

      avatarImg.src = base64;
      showToast('Foto de perfil actualizada');
      currentUser.foto_perfil = base64;
      // Guardar también en el header para que se vea reflejado sin recargar
      const headerAvatar = document.getElementById('avatar-img');
      if (headerAvatar) headerAvatar.src = base64;
      localStorage.setItem('userData', JSON.stringify(currentUser));
    } catch (err) {
      console.error('Error al subir foto:', err);
      showToast(err.message || 'Error al subir foto', true);
    }
  };
  reader.readAsDataURL(file);
}

function mostrarForm() {
  const section = document.getElementById('perfil-form-section');
  if (section) section.classList.add('visible');
  if (toggleFormBtn) toggleFormBtn.innerHTML = '<i data-lucide="x"></i> Cancelar edición';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  formVisible = true;

  if (perfilNombre)   perfilNombre.value   = currentUser.nombre   || '';
  if (perfilApellido) perfilApellido.value = currentUser.apellido || '';
  if (perfilBio)      perfilBio.value      = currentUser.bio      || '';
  if (perfilUsername) perfilUsername.value = currentUser.username || '';
  if (perfilEmail)    perfilEmail.value    = currentUser.email    || '';

  preferenciasSeleccionadas = Array.isArray(currentUser.preferencias)
    ? currentUser.preferencias.filter(p => typeof p === 'string' && !p.startsWith('PERMISO_'))
    : [];
  renderPreferencias();
}

function ocultarForm() {
  const section = document.getElementById('perfil-form-section');
  if (section) section.classList.remove('visible');
  if (toggleFormBtn) toggleFormBtn.innerHTML = '<i data-lucide="edit-3"></i> Editar perfil';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  formVisible = false;
  if (perfilNombre)   perfilNombre.value   = currentUser.nombre   || '';
  if (perfilApellido) perfilApellido.value = currentUser.apellido || '';
  if (perfilBio)      perfilBio.value      = currentUser.bio      || '';
  preferenciasSeleccionadas = Array.isArray(currentUser.preferencias)
    ? currentUser.preferencias.filter(p => typeof p === 'string' && !p.startsWith('PERMISO_'))
    : [];
  renderPreferencias();
}

function cambiarSeccion(seccion) {
  seccionActiva = seccion;
  ['mis-recetas','favoritos','likes','historial'].forEach(s => {
    const btn  = document.getElementById(`btn-${s}`);
    const grid = document.getElementById(`${s}-grid`);
    const isActive = s === seccion;
    if (btn)  btn.classList.toggle('active', isActive);
    if (grid) grid.style.display = isActive ? 'grid' : 'none';
  });

  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('id');
  const myUserId = localStorage.getItem('userId');
  const esPerfilAjeno = targetUserId && targetUserId !== myUserId && targetUserId !== 'null' && targetUserId !== 'undefined';

  // Refrescar datos al cambiar de sección para asegurar que están actualizados
  if (seccion === 'favoritos') cargarFavoritos();
  if (seccion === 'likes') cargarLikes();
  if (seccion === 'historial') cargarHistorial();
  if (seccion === 'mis-recetas') cargarMisRecetas(esPerfilAjeno ? targetUserId : null);
}

async function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.clear();
  window.location.href = 'login.html';
}

async function abrirModalPago(esRenovacion = false) {
  const modal = document.getElementById('modal-pago');
  if (!modal) return;
  modal.style.display    = 'flex';
  modal.dataset.renovar  = esRenovacion;

  document.body.classList.add('no-scroll');
  const themeToggle = document.getElementById('dark-mode-toggle');
  if (themeToggle) themeToggle.style.setProperty('display', 'none', 'important');

  const numEl = document.getElementById('pago-numero');
  const expEl = document.getElementById('pago-exp');
  const cvvEl = document.getElementById('pago-cvv');
  const titEl = document.getElementById('pago-titular');
  if (numEl) numEl.value = '';
  if (expEl) expEl.value = '';
  if (cvvEl) cvvEl.value = '';
  if (titEl) titEl.value = '';
  tarjetaSeleccionadaId = null;
  await cargarMetodosPago();
}
window.abrirModalPago = abrirModalPago;

function cerrarModalPago() {
  const modal = document.getElementById('modal-pago');
  if (modal) modal.style.display = 'none';
  
  document.body.classList.remove('no-scroll');
  const themeToggle = document.getElementById('dark-mode-toggle');
  if (themeToggle) themeToggle.style.removeProperty('display');
}
window.cerrarModalPago = cerrarModalPago;

async function cargarMetodosPago() {
  const seccion  = document.getElementById('metodos-guardados-seccion');
  const lista    = document.getElementById('lista-tarjetas');
  const formPago = document.getElementById('form-pago');
  if (!lista) return;

  try {
    const res = await fetch('/api/users/me/payment-methods', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const tarjetas = await res.json();

    if (tarjetas.length > 0) {
      seccion.style.display   = 'block';
      formPago.style.display  = 'none';
      lista.innerHTML = tarjetas.map(t => `
        <div class="tarjeta-item" data-id="${t.id}" onclick="window.seleccionarTarjeta(${t.id})">
          <div class="tarjeta-info">
            <span class="tarjeta-icon"><i data-lucide="credit-card"></i></span>
            <span>${escapeHTML(t.tarjeta_mask)}</span>
          </div>
          <span class="check"><i data-lucide="check"></i></span>
        </div>`).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      window.seleccionarTarjeta(tarjetas[0].id);
    } else {
      if (seccion)   seccion.style.display  = 'none';
      if (formPago)  formPago.style.display = 'block';
    }
  } catch (e) { console.error(e); }
}

window.seleccionarTarjeta = (id) => {
  tarjetaSeleccionadaId = id;
  document.querySelectorAll('.tarjeta-item').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.id) === id);
  });
};

async function finalizarPago() {
  const btn = document.getElementById('btn-finalizar-pago');
  const btnText = document.getElementById('pay-btn-text');
  const btnSpinner = document.getElementById('pay-btn-spinner');
  const btnGuardada = document.getElementById('btn-usar-guardada');

  const modal = document.getElementById('modal-pago');
  const esRenovacion = modal ? (modal.dataset.renovar === 'true') : false;

  if (btn) btn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (btnSpinner) btnSpinner.style.display = 'inline';
  if (btnGuardada) {
    btnGuardada.disabled = true;
    btnGuardada.textContent = 'Procesando...';
  }

  try {
    if (!tarjetaSeleccionadaId) {
      const numero  = document.getElementById('pago-numero')?.value.replace(/\s/g,'') || '';
      const exp     = document.getElementById('pago-exp')?.value || '';
      const cvv     = document.getElementById('pago-cvv')?.value || '';
      const titular = document.getElementById('pago-titular')?.value || '';
      const guardar = document.getElementById('guardar-tarjeta')?.checked;

      if (!VALIDAR.tarjeta(numero)) {
        showToast('El número de tarjeta no es válido o es muy simple (ej: 1234...). Verifica los 16 dígitos.', true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnGuardada) {
          btnGuardada.disabled = false;
          btnGuardada.textContent = 'Usar esta tarjeta';
        }
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(exp)) {
        showToast('Escribe la expiración correcta en formato MM/AA (ej: 12/26)', true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnGuardada) {
          btnGuardada.disabled = false;
          btnGuardada.textContent = 'Usar esta tarjeta';
        }
        return;
      }

      // Validar que la fecha sea futura
      const [m, a] = exp.split('/').map(n => parseInt(n));
      const ahora = new Date();
      const mesActual = ahora.getMonth() + 1;
      const anioActual = parseInt(ahora.getFullYear().toString().slice(-2));

      if (a < anioActual || (a === anioActual && m < mesActual) || m > 12 || m < 1) {
        showToast('La tarjeta ha expirado o el mes es inválido.', true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnGuardada) {
          btnGuardada.disabled = false;
          btnGuardada.textContent = 'Usar esta tarjeta';
        }
        return;
      }
      if (cvv.length < 3) {
        showToast('El código CVV debe tener al menos 3 dígitos', true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnGuardada) {
          btnGuardada.disabled = false;
          btnGuardada.textContent = 'Usar esta tarjeta';
        }
        return;
      }
      if (!titular || !VALIDAR.nombre(titular)) {
        showToast('Escribe el nombre completo del titular (solo letras)', true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnGuardada) {
          btnGuardada.disabled = false;
          btnGuardada.textContent = 'Usar esta tarjeta';
        }
        return;
      }

      if (guardar) {
        await fetch('/api/users/me/payment-methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ numero, exp, cvv, titular })
        });
      }
    }

    // SIMULACIÓN DE PAGO SEGURO (Delay de 2 segundos para realismo)
    await new Promise(r => setTimeout(r, 2000));

    const res = await fetch('/api/auth/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ renovar: esRenovacion })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Error en el pago', true);
      if (btn) btn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (btnSpinner) btnSpinner.style.display = 'none';
      if (btnGuardada) {
        btnGuardada.disabled = false;
        btnGuardada.textContent = 'Usar esta tarjeta';
      }
      return;
    }

    let fechaTxt = '';
    if (data.premiumHasta) {
      const fd = new Date(data.premiumHasta);
      fechaTxt = fd.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
    }
    showToast(`👑 ¡Membresía activada! Vencimiento: ${fechaTxt}`);
    cerrarModalPago();
    setTimeout(() => window.location.reload(), 2000);

  } catch (err) {
    showToast('Error al procesar el pago. Intenta de nuevo.', true);
    if (btn) btn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnSpinner) btnSpinner.style.display = 'none';
    if (btnGuardada) { 
      btnGuardada.disabled = false; 
      btnGuardada.textContent = 'Usar esta tarjeta'; 
    }
  }
}

async function cancelPremium() {
  if (!confirm('¿Estás seguro de que deseas cancelar tu membresía Premium?')) return;

  const btnCancel = document.getElementById('btn-cancel-premium');
  if (btnCancel) {
    btnCancel.disabled = true;
    btnCancel.textContent = 'Cancelando...';
  }

  try {
    const res = await fetch('/api/auth/cancel-premium', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || 'Error al cancelar membresía', true);
      if (btnCancel) {
        btnCancel.disabled = false;
        btnCancel.innerHTML = '<i data-lucide="x-circle"></i> Cancelar membresía';
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    showToast('✅ ' + (data.mensaje || 'Cancelación exitosa'));
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    showToast('Error de conexión al cancelar', true);
    if (btnCancel) {
      btnCancel.disabled = false;
      btnCancel.innerHTML = '<i data-lucide="x-circle"></i> Cancelar membresía';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function cargarEtiquetas() {
  const container = document.getElementById('preferencias-tags');
  if (!container) return;

  try {
    const res = await fetch('/api/tags');
    if (!res.ok) throw new Error('Error al cargar etiquetas');
    const tags = await res.json();

    container.innerHTML = tags.map(tag => {
      const selected = preferenciasSeleccionadas.includes(tag) ? 'selected' : '';
      return `<span class="pref-tag ${selected}" data-pref="${tag}">${tag}</span>`;
    }).join('');

    container.querySelectorAll('.pref-tag').forEach(tag => {
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
  } catch (error) {
    console.error('Error cargando etiquetas:', error);
  }
}

function initEventListeners() {
  toggleFormBtn?.addEventListener('click', () => formVisible ? ocultarForm() : mostrarForm());
  guardarPerfilBtn?.addEventListener('click', guardarPerfil);
  avatarOverlay?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', e => cambiarAvatar(e.target.files[0]));
  document.getElementById('btn-cambiar-pass')?.addEventListener('click', cambiarPassword);

  document.getElementById('btn-mis-recetas')?.addEventListener('click', () => cambiarSeccion('mis-recetas'));
  document.getElementById('btn-favoritos')?.addEventListener('click',   () => cambiarSeccion('favoritos'));
  document.getElementById('btn-likes')?.addEventListener('click',       () => cambiarSeccion('likes'));
  document.getElementById('btn-historial')?.addEventListener('click',   () => cambiarSeccion('historial'));

  document.getElementById('btn-upgrade-premium-profile')?.addEventListener('click', () => abrirModalPago(false));

  document.getElementById('cerrar-sesion-main-btn')?.addEventListener('click', cerrarSesion);
  document.getElementById('cerrar-sesion-btn')?.addEventListener('click',      cerrarSesion);

  document.getElementById('btn-cerrar-pago')?.addEventListener('click', cerrarModalPago);
  document.getElementById('btn-finalizar-pago')?.addEventListener('click', finalizarPago);

  document.getElementById('btn-usar-guardada')?.addEventListener('click', function() {
    this.disabled   = true;
    this.textContent = 'Procesando...';
    finalizarPago();
  });

  document.getElementById('btn-usar-otra')?.addEventListener('click', () => {
    const seccionGuardados = document.getElementById('metodos-guardados-seccion');
    const formPago         = document.getElementById('form-pago');
    if (seccionGuardados) seccionGuardados.style.display = 'none';
    if (formPago)         formPago.style.display         = 'block';
    tarjetaSeleccionadaId = null;
  });

  // Lógica de Ocultar/Ver Contraseña
  document.querySelectorAll('.eye-toggle').forEach(eye => {
    eye.addEventListener('click', () => {
      const targetId = eye.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      
      if (input.type === 'password') {
        input.type = 'text';
        eye.innerHTML = '<i data-lucide="eye-off"></i>';
      } else {
        input.type = 'password';
        eye.innerHTML = '<i data-lucide="eye"></i>';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  });

  // Delegación de eventos para botones premium dinámicos
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-upgrade-premium-profile' || e.target.closest('#btn-upgrade-premium-profile')) {
      abrirModalPago(false);
    }
    if (e.target.id === 'btn-renew-premium' || e.target.closest('#btn-renew-premium')) {
      if (!e.target.disabled) abrirModalPago(true);
    }
    if (e.target.id === 'btn-cancel-premium' || e.target.closest('#btn-cancel-premium')) {
      cancelPremium();
    }
  });
}

async function cambiarPassword() {
  const currentPassword = document.getElementById('pass-actual')?.value;
  const newPassword     = document.getElementById('pass-nueva')?.value;
  const confirmPassword = document.getElementById('pass-confirmar')?.value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Ingresa la contraseña actual, la nueva y su confirmación', true);
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('La confirmación no coincide con la nueva contraseña', true);
    return;
  }

  if (currentPassword === newPassword) {
    showToast('La nueva contraseña debe ser diferente a la actual', true);
    return;
  }
  
  if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    showToast('La nueva contraseña debe tener mínimo 8 caracteres, letras y números', true);
    return;
  }
  
  const btn = document.getElementById('btn-cambiar-pass');
  btn.disabled = true;
  btn.textContent = 'Actualizando...';
  
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/auth/me/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');
    
    showToast('Contraseña actualizada correctamente');
    document.getElementById('pass-actual').value = '';
    document.getElementById('pass-nueva').value = '';
    document.getElementById('pass-confirmar').value = '';
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar contraseña';
  }
}

async function init() {
  initEventListeners();
  initRewardsDelegation();   // single permanent listener for all reward buttons
  await cargarPerfil();
  await cargarEtiquetas();
  cambiarSeccion('mis-recetas');
}

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
