// ================================================
// perfil.js – ForaneoKitchen
// ================================================
(function () {
  const API = 'http://localhost:3000';
  let token = localStorage.getItem('token');
  let usuario = null;
  let preferenciasSeleccionadas = [];
  let seccionActiva = 'mis-recetas';
  let formVisible = false;

  // ── UTILIDADES ──────────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, isError = false) {
    const el = document.getElementById('notif-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'notification-toast' + (isError ? ' error' : '');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
  }

  function imgPlaceholder(titulo) {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;
  }

  function avatarDefault() {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234caf50'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='45'%3E👤%3C/text%3E%3C/svg%3E`;
  }

  // ── CARGAR PERFIL ─────────────────────────────────────────────────────────
  async function cargarPerfil() {
    if (!token) { window.location.href = 'login.html'; return; }
    try {
      const res = await fetch(API + '/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('No autorizado');
      usuario = await res.json();
      renderPerfil();
      await Promise.all([cargarMisRecetas(), cargarFavoritos(), cargarHistorial()]);
    } catch {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    }
  }

  function renderPerfil() {
    // Display info
    setTxt('display-username', '@' + (usuario.username || ''));
    setTxt('display-nombre', (usuario.nombre || '') + ' ' + (usuario.apellido || ''));
    setTxt('display-bio', usuario.bio || 'Sin biografía aún.');

    const badge = document.getElementById('premium-badge');
    if (badge) badge.style.display = usuario.esPremium ? 'inline-flex' : 'none';

    // Avatar
    const img = document.getElementById('avatar-img');
    if (img) img.src = usuario.fotoPerfil || avatarDefault();

    // Campos del formulario
    setVal('perfil-nombre', usuario.nombre || '');
    setVal('perfil-apellido', usuario.apellido || '');
    setVal('perfil-username', usuario.username || '');
    setVal('perfil-email', usuario.email || '');
    setVal('perfil-bio', usuario.bio || '');

    // Preferencias
    preferenciasSeleccionadas = Array.isArray(usuario.preferencias) ? [...usuario.preferencias] : [];
    renderPreferencias();
  }

  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ── STATS ─────────────────────────────────────────────────────────────────
  function actualizarStats(nRecetas, nFavs, nVisitas) {
    setTxt('stats-recetas', nRecetas);
    setTxt('stats-favoritos', nFavs);
    setTxt('stats-visitas', nVisitas);
  }

  // ── PREFERENCIAS ──────────────────────────────────────────────────────────
  function renderPreferencias() {
    document.querySelectorAll('.pref-tag').forEach(tag => {
      const pref = tag.dataset.pref;
      tag.classList.toggle('selected', preferenciasSeleccionadas.includes(pref));
    });
  }

  // ── MIS RECETAS ───────────────────────────────────────────────────────────
  async function cargarMisRecetas() {
    try {
      const res = await fetch(API + '/api/users/me/recipes', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const recetas = res.ok ? await res.json() : [];
      renderGrid('mis-recetas-grid', recetas, true);
      actualizarStatRecetas(recetas.length);
    } catch { renderGrid('mis-recetas-grid', [], true); }
  }

  let _totalFavs = 0, _totalVisitas = 0, _totalRecetas = 0;

  function actualizarStatRecetas(n) { _totalRecetas = n; updateStats(); }
  function actualizarStatFavs(n)    { _totalFavs = n;    updateStats(); }
  function actualizarStatVisitas(n) { _totalVisitas = n; updateStats(); }
  function updateStats() { actualizarStats(_totalRecetas, _totalFavs, _totalVisitas); }

  // ── FAVORITOS ─────────────────────────────────────────────────────────────
  async function cargarFavoritos() {
    try {
      const res = await fetch(API + '/api/users/me/favorites', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const recetas = res.ok ? await res.json() : [];
      renderGrid('favoritos-grid', recetas, false);
      actualizarStatFavs(recetas.length);
    } catch { renderGrid('favoritos-grid', [], false); }
  }

  // ── HISTORIAL ─────────────────────────────────────────────────────────────
  async function cargarHistorial() {
    try {
      const res = await fetch(API + '/api/users/me/history', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const recetas = res.ok ? await res.json() : [];
      renderGrid('historial-grid', recetas, false);
      actualizarStatVisitas(recetas.length);
    } catch { renderGrid('historial-grid', [], false); }
  }

  // ── RENDER GRID ───────────────────────────────────────────────────────────
  function renderGrid(containerId, recetas, mias) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!recetas.length) {
      const mensajes = {
        'mis-recetas-grid': { icon: '📝', text: 'No has subido recetas aún' },
        'favoritos-grid':   { icon: '⭐', text: 'No tienes recetas favoritas' },
        'historial-grid':   { icon: '👁️', text: 'No has visto recetas aún' }
      };
      const m = mensajes[containerId] || { icon: '🍳', text: 'Sin recetas' };
      container.innerHTML = `<div class="vacio-mensaje"><span>${m.icon}</span><p>${m.text}</p></div>`;
      return;
    }

    container.innerHTML = recetas.map(r => {
      const img = r.imagen || imgPlaceholder(r.titulo);
      const btnEliminar = mias
        ? `<button class="btn-eliminar-receta-overlay" data-id="${r.id}" title="Eliminar receta">✖</button>`
        : '';
      return `
        <div class="receta-grid-item" data-id="${r.id}">
          <img src="${esc(img)}" alt="${esc(r.titulo)}" loading="lazy"
               onerror="this.src='${imgPlaceholder()}'">
          <div class="receta-overlay">
            <span>❤️ ${r.likes || 0}</span>
          </div>
          <div class="receta-titulo">${esc(r.titulo)}</div>
          ${btnEliminar}
        </div>`;
    }).join('');

    // Click en tarjeta → ver receta
    container.querySelectorAll('.receta-grid-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('btn-eliminar-receta-overlay')) return;
        window.location.href = 'receta.html?id=' + el.dataset.id;
      });
    });

    // Botones eliminar (solo mis recetas)
    if (mias) {
      container.querySelectorAll('.btn-eliminar-receta-overlay').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          if (!confirm('¿Eliminar esta receta? Esta acción no se puede deshacer.')) return;
          const id = btn.dataset.id;
          try {
            const res = await fetch(API + '/api/recipes/' + id, {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + token }
            });
            if (res.ok) { toast('Receta eliminada'); cargarMisRecetas(); }
            else toast('Error al eliminar', true);
          } catch { toast('Error de conexión', true); }
        });
      });
    }
  }

  // ── GUARDAR PERFIL ────────────────────────────────────────────────────────
  async function guardarPerfil() {
    const nombre = document.getElementById('perfil-nombre')?.value.trim();
    const apellido = document.getElementById('perfil-apellido')?.value.trim();
    const bio = document.getElementById('perfil-bio')?.value.trim();

    if (!nombre || !apellido) {
      toast('Nombre y apellido son obligatorios', true); return;
    }

    const btn = document.getElementById('guardar-perfil-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      const res = await fetch(API + '/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ nombre, apellido, bio, preferencias: preferenciasSeleccionadas })
      });

      if (res.ok) {
        toast('✅ Perfil actualizado');
        // Actualizar vista inmediatamente
        setTxt('display-nombre', nombre + ' ' + apellido);
        setTxt('display-bio', bio || 'Sin biografía aún.');
        usuario.nombre = nombre;
        usuario.apellido = apellido;
        usuario.bio = bio;
        usuario.preferencias = preferenciasSeleccionadas;
        // Ocultar formulario
        ocultarForm();
      } else {
        const err = await res.json();
        toast(err.error || 'Error al guardar', true);
      }
    } catch { toast('Error de conexión', true); }
    finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
    }
  }

  // ── AVATAR ────────────────────────────────────────────────────────────────
  async function cambiarAvatar(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Imagen máx. 2MB', true); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      const b64 = e.target.result;
      try {
        const res = await fetch(API + '/api/auth/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ avatarBase64: b64 })
        });
        if (res.ok) {
          const data = await res.json();
          const img = document.getElementById('avatar-img');
          if (img) img.src = data.avatarUrl;
          toast('📷 Foto de perfil actualizada');
        } else toast('Error al subir foto', true);
      } catch { toast('Error de conexión', true); }
    };
    reader.readAsDataURL(file);
  }

  // ── FORMULARIO TOGGLE ─────────────────────────────────────────────────────
  function mostrarForm() {
    const section = document.getElementById('perfil-form-section');
    const btn = document.getElementById('toggle-form-btn');
    if (section) section.classList.add('visible');
    if (btn) btn.textContent = '✕ Cancelar edición';
    formVisible = true;
  }

  function ocultarForm() {
    const section = document.getElementById('perfil-form-section');
    const btn = document.getElementById('toggle-form-btn');
    if (section) section.classList.remove('visible');
    if (btn) btn.textContent = '✏️ Editar perfil';
    formVisible = false;
  }

  // ── TABS ──────────────────────────────────────────────────────────────────
  function cambiarSeccion(sec) {
    seccionActiva = sec;
    ['mis-recetas', 'favoritos', 'historial'].forEach(s => {
      const btn = document.getElementById('btn-' + s);
      const grid = document.getElementById(s + '-grid');
      const isActive = s === sec;
      if (btn) btn.classList.toggle('active', isActive);
      if (grid) grid.style.display = isActive ? 'grid' : 'none';
    });
  }

  // ── CERRAR SESIÓN ─────────────────────────────────────────────────────────
  function cerrarSesion() {
    if (!confirm('¿Cerrar sesión?')) return;
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    // Toggle formulario
    document.getElementById('toggle-form-btn')?.addEventListener('click', () => {
      formVisible ? ocultarForm() : mostrarForm();
    });

    // Guardar
    document.getElementById('guardar-perfil-btn')?.addEventListener('click', guardarPerfil);

    // Cerrar sesión
    document.getElementById('cerrar-sesion-btn')?.addEventListener('click', cerrarSesion);

    // Avatar
    const avatarOverlay = document.getElementById('avatar-overlay-btn');
    const avatarInput = document.getElementById('avatar-input');
    avatarOverlay?.addEventListener('click', () => avatarInput?.click());
    avatarInput?.addEventListener('change', e => cambiarAvatar(e.target.files[0]));

    // Tabs
    document.getElementById('btn-mis-recetas')?.addEventListener('click', () => cambiarSeccion('mis-recetas'));
    document.getElementById('btn-favoritos')?.addEventListener('click', () => cambiarSeccion('favoritos'));
    document.getElementById('btn-historial')?.addEventListener('click', () => cambiarSeccion('historial'));

    // Preferencias
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

    // Cargar perfil
    cargarPerfil();

    // Mostrar sección inicial
    cambiarSeccion('mis-recetas');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();