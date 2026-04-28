// ================================================
// receta.js – ForaneoKitchen
// Visualización de receta con video, likes, favoritos, comentarios y puntos
// ================================================

(function () {
  const API = (() => {
    if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
      return 'http://localhost:3000';
    }
    return window.location.origin;
  })();
  
  let token = localStorage.getItem('token');
  let recetaActual = null;

  // ================================================
  // UTILIDADES
  // ================================================

  function getId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const now = new Date();
    const diff = now - d;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    
    if (minutos < 1) return 'Ahora mismo';
    if (minutos < 60) return `${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    if (horas < 24) return `${horas} hora${horas !== 1 ? 's' : ''}`;
    if (dias < 7) return `${dias} día${dias !== 1 ? 's' : ''}`;
    return d.toLocaleDateString('es-MX');
  }

  function toast(msg, isError = false) {
    let el = document.getElementById('receta-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'receta-toast';
      el.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%) translateY(20px);
        padding:12px 24px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:2000;
        opacity:0;pointer-events:none;transition:all .3s;box-shadow:0 4px 16px rgba(0,0,0,.2);
        color:white;white-space:nowrap;font-family:'Inter',sans-serif;`;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = isError ? '#f44336' : '#4caf50';
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
  }

  function formatIngredientes(raw) {
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  function formatPasos(raw) {
    if (!raw) return [];
    if (/\d+\./.test(raw)) {
      return raw.split(/\d+\./).map(s => s.trim()).filter(Boolean);
    }
    if (raw.includes('\n')) {
      return raw.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [raw.trim()];
  }

  function extraerYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // ================================================
  // LOCALSTORAGE PARA INGREDIENTES
  // ================================================

  function getEstadoIngredientes(id) {
    try {
      return JSON.parse(localStorage.getItem('ing_' + id) || '{}');
    } catch {
      return {};
    }
  }

  function setEstadoIngredientes(id, estado) {
    localStorage.setItem('ing_' + id, JSON.stringify(estado));
  }

  // ================================================
  // REGISTRAR VISTA EN HISTORIAL
  // ================================================

  async function registrarVista(id) {
    if (!token) return;
    try {
      await fetch(`${API}/api/users/me/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ recipeId: id })
      });
    } catch (err) {
      console.error('Error registrando vista:', err);
    }
  }

  // ================================================
  // OBTENER ESTADO LIKE/FAV
  // ================================================

  async function getEstadoSocial(id) {
    if (!token) return { liked: false, favorito: false };
    try {
      const [lRes, fRes] = await Promise.all([
        fetch(`${API}/api/recipes/${id}/like`, {
          headers: { 'Authorization': 'Bearer ' + token }
        }),
        fetch(`${API}/api/users/me/favorites/${id}`, {
          headers: { 'Authorization': 'Bearer ' + token }
        })
      ]);
      const l = lRes.ok ? await lRes.json() : { liked: false };
      const f = fRes.ok ? await fRes.json() : { favorito: false };
      return { liked: l.liked, favorito: f.favorito };
    } catch {
      return { liked: false, favorito: false };
    }
  }

  // ================================================
  // RENDER RECETA
  // ================================================

  async function renderReceta(r) {
    const container = document.getElementById('receta-container');
    if (!container) return;

    const ings = formatIngredientes(r.ingredientes);
    const pasos = formatPasos(r.pasos);
    const precio = r.precio || '$$';
    const tiempo = r.tiempo || '30 min';
    const img = r.imagen || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E`;
    
    const estadoIngredientes = getEstadoIngredientes(r.id);
    const social = await getEstadoSocial(r.id);

    // HTML de ingredientes con checkboxes
    const ingsHTML = ings.map((ing, i) => {
      const seleccionado = estadoIngredientes[i] || false;
      return `
        <li class="${seleccionado ? 'seleccionado' : ''}" data-ing-index="${i}">
          <input type="checkbox" class="checkbox-ingrediente" data-ing-index="${i}" ${seleccionado ? 'checked' : ''}>
          <span>🥄 ${esc(ing)}</span>
        </li>
      `;
    }).join('');

    // HTML de pasos
    const pasosHTML = pasos.map((p, i) => `
      <div class="paso-item">
        <div class="paso-numero">${i + 1}</div>
        <div class="paso-texto">${esc(p)}</div>
      </div>
    `).join('');

    // Video solo si puede verlo (Premium o receta normal)
    const videoId = extraerYouTubeId(r.video_url);
    const puedeVerVideo = r.puedeVerVideo !== undefined ? r.puedeVerVideo : true;
    
    let videoHTML = '';
    if (videoId) {
      if (puedeVerVideo) {
        videoHTML = `
          <div class="video-container" style="margin-bottom: 24px;">
            <h2 style="font-family:'Poppins',sans-serif; font-size:1.2rem; margin-bottom:12px;">🎬 Video de preparación</h2>
            <iframe 
              width="100%" 
              height="315" 
              src="https://www.youtube.com/embed/${videoId}" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen
              style="border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            </iframe>
          </div>
        `;
      } else if (r.video_url) {
        videoHTML = `
          <div class="video-premium-bloqueado" style="margin-bottom: 24px; padding: 30px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); border-radius: 20px; text-align: center; border: 2px dashed #ff9800;">
            <span style="font-size: 3rem;">🔒</span>
            <h3 style="color: #e65100; margin: 10px 0;">Contenido Premium</h3>
            <p style="margin-bottom: 15px;">Este video es exclusivo para usuarios <strong>Premium</strong></p>
            <button onclick="window.location.href='perfil.html'" class="btn-premium" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; border: none; padding: 10px 24px; border-radius: 30px; cursor: pointer; font-weight: 600;">👑 Actualizar a Premium</button>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="receta-imagen">
        <img src="${esc(img)}" alt="${esc(r.titulo)}" onerror="this.src='${img}'">
      </div>
      <div class="receta-content">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <h1>${esc(r.titulo)}</h1>
          ${r.es_premium_receta ? '<span class="premium-badge" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; padding: 5px 12px; border-radius: 30px; font-size: 0.8rem; font-weight: bold;">👑 Premium</span>' : ''}
        </div>
        <div class="receta-autor">
          <span>👨‍🍳</span> ${esc(r.autor || 'Anónimo')}
          <span style="margin-left: 15px;">📅 ${formatFecha(r.fecha)}</span>
        </div>

        <div class="info-cards">
          <div class="info-card">
            <span class="info-icon">💰</span>
            <div class="info-label">TOTAL</div>
            <div class="info-value total">${esc(precio)}</div>
          </div>
          <div class="info-card">
            <span class="info-icon">⏱️</span>
            <div class="info-label">TIEMPO</div>
            <div class="info-value">${esc(tiempo)}</div>
          </div>
        </div>

        ${videoHTML}

        <div class="receta-acciones-sociales" style="display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;">
          <button id="like-btn" class="like-btn ${social.liked ? 'liked' : ''}"
            style="padding: 10px 20px; border-radius: 40px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;
                   background: ${social.liked ? '#f44336' : '#ffebee'}; color: ${social.liked ? 'white' : '#e53935'}; transition: all 0.2s;">
            ❤️ <span id="likes-count">${r.likes || 0}</span> Likes
          </button>
          <button id="fav-btn" class="favorito-btn ${social.favorito ? 'favorited' : ''}"
            style="padding: 10px 20px; border-radius: 40px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;
                   background: ${social.favorito ? '#ff9800' : '#fff3e0'}; color: ${social.favorito ? 'white' : '#e65100'}; transition: all 0.2s;">
            ${social.favorito ? '⭐ Guardada' : '☆ Guardar'}
          </button>
          <button id="comentar-btn"
            style="padding: 10px 20px; border-radius: 40px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;
                   background: #e8f5e9; color: #2e7d32; transition: all 0.2s;">
            💬 Comentarios
          </button>
        </div>

        <div id="comentarios-section" style="display: none; margin-bottom: 28px;">
          <h2 style="font-family: 'Poppins', sans-serif; font-size: 1.2rem; margin-bottom: 16px;">💬 Comentarios</h2>
          <div id="comentarios-lista" style="max-height: 350px; overflow-y: auto; margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 20px; padding: 16px; background: #fafafa;"></div>
          <div style="display: flex; gap: 12px;">
            <textarea id="nuevo-comentario" rows="2" placeholder="Escribe un comentario..." maxlength="500"
              style="flex: 1; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 20px; font-family: inherit; font-size: 0.9rem; resize: none; outline: none; transition: all 0.2s;"></textarea>
            <button id="enviar-comentario"
              style="padding: 0 24px; background: linear-gradient(135deg, #4caf50, #2e7d32); color: white; border: none; border-radius: 20px; cursor: pointer; font-weight: 600; font-family: inherit;">
              Enviar
            </button>
          </div>
        </div>

        <div class="seccion">
          <h2>📝 Ingredientes</h2>
          <ul class="lista-ingredientes">${ingsHTML}</ul>
        </div>

        <div class="seccion">
          <h2>👨‍🍳 Preparación</h2>
          <div class="pasos-lista">${pasosHTML}</div>
        </div>
      </div>
    `;

    setupIngredientes(r.id, container);
    setupSocial(r);
  }

  // ================================================
  // INGREDIENTES INTERACTIVOS
  // ================================================

  function setupIngredientes(recetaId, container) {
    const items = container.querySelectorAll('.lista-ingredientes li');
    items.forEach(li => {
      const cb = li.querySelector('.checkbox-ingrediente');
      const index = parseInt(li.dataset.ingIndex);
      
      const toggle = () => {
        cb.checked = !cb.checked;
        li.classList.toggle('seleccionado', cb.checked);
        const estado = getEstadoIngredientes(recetaId);
        estado[index] = cb.checked;
        setEstadoIngredientes(recetaId, estado);
      };
      
      li.addEventListener('click', e => {
        if (e.target !== cb) toggle();
      });
      
      cb.addEventListener('change', () => {
        li.classList.toggle('seleccionado', cb.checked);
        const estado = getEstadoIngredientes(recetaId);
        estado[index] = cb.checked;
        setEstadoIngredientes(recetaId, estado);
      });
    });
  }

  // ================================================
  // LIKES, FAVORITOS, COMENTARIOS
  // ================================================

  function setupSocial(r) {
    // --- LIKE ---
    const likeBtn = document.getElementById('like-btn');
    likeBtn?.addEventListener('click', async () => {
      if (!token) {
        toast('Inicia sesión para dar like', true);
        return;
      }
      
      const isLiked = likeBtn.classList.contains('liked');
      const method = isLiked ? 'DELETE' : 'POST';
      const countEl = document.getElementById('likes-count');
      const currentLikes = r.likes || 0;
      
      // Optimistic update
      likeBtn.classList.toggle('liked', !isLiked);
      likeBtn.style.background = !isLiked ? '#f44336' : '#ffebee';
      likeBtn.style.color = !isLiked ? 'white' : '#e53935';
      if (countEl) {
        countEl.textContent = !isLiked ? currentLikes + 1 : Math.max(currentLikes - 1, 0);
      }
      
      try {
        const res = await fetch(`${API}/api/recipes/${r.id}/like`, {
          method,
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        
        if (!res.ok) {
          // Revertir
          likeBtn.classList.toggle('liked', isLiked);
          likeBtn.style.background = isLiked ? '#f44336' : '#ffebee';
          likeBtn.style.color = isLiked ? 'white' : '#e53935';
          if (countEl) countEl.textContent = currentLikes;
          toast(data.error || 'Error', true);
          return;
        }
        
        r.likes = data.likes;
        if (countEl) countEl.textContent = data.likes;
        toast(isLiked ? 'Like eliminado' : '❤️ ¡Te gusta esta receta!');
      } catch {
        toast('Error de conexión', true);
      }
    });

    // --- FAVORITO ---
    const favBtn = document.getElementById('fav-btn');
    favBtn?.addEventListener('click', async () => {
      if (!token) {
        toast('Inicia sesión para guardar favoritos', true);
        return;
      }
      
      const isFav = favBtn.classList.contains('favorited');
      const method = isFav ? 'DELETE' : 'POST';
      
      favBtn.classList.toggle('favorited', !isFav);
      favBtn.textContent = !isFav ? '⭐ Guardada' : '☆ Guardar';
      favBtn.style.background = !isFav ? '#ff9800' : '#fff3e0';
      favBtn.style.color = !isFav ? 'white' : '#e65100';
      
      try {
        const res = await fetch(`${API}/api/users/me/favorites/${r.id}`, {
          method,
          headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!res.ok) {
          favBtn.classList.toggle('favorited', isFav);
          favBtn.textContent = isFav ? '⭐ Guardada' : '☆ Guardar';
          favBtn.style.background = isFav ? '#ff9800' : '#fff3e0';
          favBtn.style.color = isFav ? 'white' : '#e65100';
          const data = await res.json();
          toast(data.error || 'Error', true);
          return;
        }
        
        toast(isFav ? 'Eliminada de favoritos' : '⭐ Guardada en favoritos');
      } catch {
        toast('Error de conexión', true);
      }
    });

    // --- COMENTARIOS ---
    const comentarBtn = document.getElementById('comentar-btn');
    const comentariosSection = document.getElementById('comentarios-section');
    const nuevoComentario = document.getElementById('nuevo-comentario');
    const enviarComentario = document.getElementById('enviar-comentario');
    
    comentarBtn?.addEventListener('click', () => {
      const visible = comentariosSection.style.display !== 'none';
      comentariosSection.style.display = visible ? 'none' : 'block';
      if (!visible) cargarComentarios(r.id);
    });
    
    enviarComentario?.addEventListener('click', () => enviarNuevoComentario(r.id));
    nuevoComentario?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarNuevoComentario(r.id);
      }
    });
    nuevoComentario?.addEventListener('focus', () => {
      nuevoComentario.style.borderColor = '#4caf50';
    });
    nuevoComentario?.addEventListener('blur', () => {
      nuevoComentario.style.borderColor = '#e0e0e0';
    });
  }

  // ================================================
  // COMENTARIOS
  // ================================================

  async function cargarComentarios(recipeId) {
    const lista = document.getElementById('comentarios-lista');
    if (!lista) return;
    
    lista.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Cargando comentarios...</div>';
    
    let usuarioActual = null;
    if (token) {
      try {
        const meRes = await fetch(`${API}/api/auth/me`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (meRes.ok) usuarioActual = await meRes.json();
      } catch {}
    }
    
    try {
      const res = await fetch(`${API}/api/recipes/${recipeId}/comments`);
      const comments = res.ok ? await res.json() : [];
      
      if (!comments.length) {
        lista.innerHTML = '<div style="text-align: center; padding: 30px; color: #aaa;">No hay comentarios aún. ¡Sé el primero en comentar!</div>';
        return;
      }
      
      lista.innerHTML = comments.map(c => {
        const usuario = c.usuario || {};
        const puedeEliminar = usuarioActual && usuarioActual.id === usuario.id;
        const avatar = usuario.foto_perfil
          ? `<img src="${usuario.foto_perfil}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" alt="">`
          : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #4caf50; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(usuario.username || 'U').charAt(0).toUpperCase()}</div>`;
        
        return `
          <div class="comentario-item" data-id="${c.id}" style="display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            ${avatar}
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #2e7d32;">${esc(usuario.username || 'Usuario')}</strong>
                <small style="color: #aaa;">${formatFecha(c.fecha)}</small>
              </div>
              <p style="color: #555; line-height: 1.4;">${esc(c.texto)}</p>
            </div>
            ${puedeEliminar ? `<button class="eliminar-comentario" data-id="${c.id}" style="background: none; border: none; color: #ccc; cursor: pointer; font-size: 1rem;">🗑️</button>` : ''}
          </div>
        `;
      }).join('');
      
      // Eventos para eliminar comentarios
      document.querySelectorAll('.eliminar-comentario').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este comentario?')) return;
          const commentId = btn.dataset.id;
          try {
            const res = await fetch(`${API}/api/comments/${commentId}`, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
              toast('Comentario eliminado');
              cargarComentarios(recipeId);
            } else {
              toast('Error al eliminar', true);
            }
          } catch {
            toast('Error de conexión', true);
          }
        });
      });
      
    } catch {
      lista.innerHTML = '<div style="color: #f44336; padding: 20px; text-align: center;">Error al cargar comentarios</div>';
    }
  }
  
  async function enviarNuevoComentario(recipeId) {
    if (!token) {
      toast('Inicia sesión para comentar', true);
      return;
    }
    
    const input = document.getElementById('nuevo-comentario');
    const texto = input?.value.trim();
    if (!texto) {
      toast('Escribe un comentario', true);
      return;
    }
    if (texto.length > 500) {
      toast('Máximo 500 caracteres', true);
      return;
    }
    
    try {
      const res = await fetch(`${API}/api/recipes/${recipeId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ texto })
      });
      
      if (res.ok) {
        input.value = '';
        await cargarComentarios(recipeId);
        toast('💬 Comentario publicado (+3 puntos)');
      } else {
        const data = await res.json();
        toast(data.error || 'Error al comentar', true);
      }
    } catch {
      toast('Error de conexión', true);
    }
  }

  // ================================================
  // MOSTRAR ERROR
  // ================================================

  function mostrarError(mensaje, esPremium = false) {
    const container = document.getElementById('receta-container');
    if (!container) return;
    
    if (esPremium) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 32px;">
          <div style="font-size: 4rem; margin-bottom: 16px;">👑</div>
          <h2 style="color: #e65100; margin-bottom: 12px;">Contenido Premium</h2>
          <p style="color: #666; margin-bottom: 24px;">${mensaje || 'Esta receta es exclusiva para usuarios Premium'}</p>
          <button onclick="window.location.href='perfil.html'" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; border: none; padding: 12px 28px; border-radius: 30px; cursor: pointer; font-size: 1rem; font-weight: 600;">👑 Actualizar a Premium</button>
          <br><br>
          <button onclick="window.location.href='home.html'" style="background: transparent; color: #4caf50; border: 2px solid #4caf50; padding: 10px 24px; border-radius: 30px; cursor: pointer; font-size: 0.9rem; font-weight: 600;">← Volver a recetas</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 32px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">😢</div>
          <p style="color: #c62828; font-size: 1.1rem; margin-bottom: 20px;">${esc(mensaje)}</p>
          <button onclick="history.back()" style="background: #4caf50; color: white; border: none; padding: 12px 24px; border-radius: 30px; cursor: pointer; font-size: 1rem; font-weight: 600;">← Volver</button>
        </div>
      `;
    }
  }

  // ================================================
  // INICIALIZACIÓN
  // ================================================

  async function init() {
    const id = getId();
    if (!id) {
      mostrarError('No se especificó qué receta ver');
      return;
    }
    
    try {
      const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      const res = await fetch(`${API}/api/recipes/${id}`, { headers });
      
      if (res.status === 403) {
        const error = await res.json();
        mostrarError(error.mensaje || 'Esta receta es Premium. Actualiza tu cuenta para verla.', true);
        return;
      }
      
      if (res.status === 401) {
        mostrarError('Inicia sesión para ver esta receta');
        return;
      }
      
      if (!res.ok) {
        mostrarError(res.status === 404 ? 'Receta no encontrada' : 'Error al cargar la receta');
        return;
      }
      
      recetaActual = await res.json();
      await renderReceta(recetaActual);
      
      // Registrar vista en historial (solo si el usuario está logueado)
      if (token && recetaActual.id) {
        await registrarVista(recetaActual.id);
      }
      
    } catch (err) {
      console.error('Error:', err);
      mostrarError('No se pudo conectar con el servidor');
    }
  }
  
  // Iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();