const API = 'http://localhost:3000';
let token = localStorage.getItem('token');
let currentUser = null;
let todasLasRecetas = [];

const DOM = {
  userName: document.getElementById('user-name'),
  premiumBadge: document.getElementById('premium-badge'),
  searchInput: document.getElementById('search-input'),
  filterTags: document.querySelectorAll('.tag'),
  recetasContainer: document.getElementById('recetas'),
  cerrarSesionBtn: document.getElementById('cerrar-sesion-btn'),
  chatBoton: document.getElementById('chat-boton'),
  chatWindow: document.getElementById('chat-window'),
  cerrarChatBtn: document.getElementById('cerrar-chat-btn'),
  chatInput: document.getElementById('chat-input'),
  enviarChatBtn: document.getElementById('enviar-chat-btn'),
  chatMessages: document.getElementById('chat-messages')
};

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mostrarNotificacion(mensaje, tipo = 'info') {
  const notificacion = document.createElement('div');
  notificacion.className = `temp-notification ${tipo}`;
  notificacion.textContent = mensaje;
  document.body.appendChild(notificacion);
  setTimeout(() => notificacion.classList.add('show'), 10);
  setTimeout(() => {
    notificacion.classList.remove('show');
    setTimeout(() => notificacion.remove(), 300);
  }, 3000);
}

function obtenerValorNumerico(texto) {
  if (!texto) return 0;
  const numeros = texto.match(/\d+/);
  return numeros ? parseInt(numeros[0]) : 0;
}

function coincideConFiltro(receta, filtro) {
  const precioNumerico = receta.precioNumerico || obtenerValorNumerico(receta.precio);
  const tiempoNumerico = receta.tiempoNumerico || obtenerValorNumerico(receta.tiempo);
  const pasosLower = (receta.pasos || '').toLowerCase();
  const ingredientesLower = (receta.ingredientes || '').toLowerCase();
  const tituloLower = (receta.titulo || '').toLowerCase();
  
  switch(filtro) {
    case 'economicas':
      return precioNumerico > 0 && precioNumerico <= 35;
    case 'rapidas':
      return tiempoNumerico > 0 && tiempoNumerico <= 20;
    case 'microondas':
      return pasosLower.includes('microondas') ||
             ingredientesLower.includes('microondas') ||
             tituloLower.includes('microondas');
    case 'menos30':
      return precioNumerico > 0 && precioNumerico <= 30;
    default:
      return true;
  }
}

function obtenerEtiquetasReceta(receta) {
  const etiquetas = [];
  const precioNumerico = receta.precioNumerico || obtenerValorNumerico(receta.precio);
  const tiempoNumerico = receta.tiempoNumerico || obtenerValorNumerico(receta.tiempo);
  const pasosLower = (receta.pasos || '').toLowerCase();
  
  if (precioNumerico > 0 && precioNumerico <= 35) etiquetas.push('económicas');
  if (tiempoNumerico > 0 && tiempoNumerico <= 20) etiquetas.push('rápidas');
  if (pasosLower.includes('microondas')) etiquetas.push('microondas');
  if (precioNumerico > 0 && precioNumerico <= 30) etiquetas.push('menos de $30');
  
  return etiquetas;
}

function filtrarRecetas() {
  if (!todasLasRecetas.length) return;
  const textoBusqueda = DOM.searchInput ? DOM.searchInput.value.toLowerCase().trim() : '';
  const filtroActivo = document.querySelector('.tag.active-filter');
  const filtroCategoria = filtroActivo ? filtroActivo.dataset.filter : null;
  let recetasFiltradas = [...todasLasRecetas];
  if (textoBusqueda) {
    recetasFiltradas = recetasFiltradas.filter(receta => {
      return receta.titulo.toLowerCase().includes(textoBusqueda) ||
             receta.ingredientes.toLowerCase().includes(textoBusqueda) ||
             receta.pasos.toLowerCase().includes(textoBusqueda) ||
             (receta.autor && receta.autor.toLowerCase().includes(textoBusqueda));
    });
  }
  if (filtroCategoria) {
    recetasFiltradas = recetasFiltradas.filter(receta => coincideConFiltro(receta, filtroCategoria));
  }
  renderizarRecetas(recetasFiltradas);
  if (recetasFiltradas.length === 0) {
    mostrarMensajeSinResultados(textoBusqueda, filtroCategoria);
  }
}

function mostrarMensajeSinResultados(busqueda, filtro) {
  let mensaje = '';
  const nombresFiltros = {
    'economicas': 'Económicas',
    'rapidas': 'Rápidas',
    'microondas': 'Microondas',
    'menos30': 'Menos de $30'
  };
  const nombreFiltro = filtro ? nombresFiltros[filtro] : null;
  if (busqueda && nombreFiltro) {
    mensaje = `No se encontraron recetas que coincidan con "${busqueda}" y el filtro "${nombreFiltro}".`;
  } else if (busqueda) {
    mensaje = `No se encontraron recetas que coincidan con "${busqueda}".`;
  } else if (nombreFiltro) {
    mensaje = `No se encontraron recetas con el filtro "${nombreFiltro}".\n💰 Económicas: precio ≤ $35\n⏱️ Rápidas: tiempo ≤ 20 min\n💰 Menos de $30: precio ≤ $30\n🍳 Microondas: debe contener la palabra "microondas"`;
  } else {
    mensaje = 'No hay recetas disponibles. ¡Sé el primero en publicar una!';
  }
  DOM.recetasContainer.innerHTML = `
    <div class="no-results">
      <span class="no-results-icon">🍳</span>
      <p>${mensaje}</p>
      <small>Intenta con otros términos o desactiva el filtro</small>
    </div>
  `;
}

function renderizarRecetas(recetas) {
  if (!DOM.recetasContainer) return;
  DOM.recetasContainer.innerHTML = '';
  recetas.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const etiquetas = obtenerEtiquetasReceta(r);
    const precio = r.precio || '$$';
    const tiempo = r.tiempo || '30 min';
    const etiquetasHTML = etiquetas.map(etq => `<span class="recipe-tag">${escapeHTML(etq)}</span>`).join('');
    const imagenURL = r.imagen || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e8f5e9"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%234caf50" font-size="40"%3E🍳%3C/text%3E%3C/svg%3E';
    card.innerHTML = `
      <div class="recipe-image">
        <img src="${escapeHTML(imagenURL)}" alt="${escapeHTML(r.titulo)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23e8f5e9\'/%3E%3Ctext x=\'50\' y=\'55\' text-anchor=\'middle\' fill=\'%234caf50\' font-size=\'40\'%3E🍳%3C/text%3E%3C/svg%3E'">
      </div>
      <div class="recipe-content">
        <h3>${escapeHTML(r.titulo)}</h3>
        <div class="recipe-meta">
          <span class="recipe-price">💰 ${escapeHTML(precio)}</span>
          <span class="recipe-time">⏱️ ${escapeHTML(tiempo)}</span>
        </div>
        <div class="recipe-tags">${etiquetasHTML}</div>
        <button class="btn-ver-mas" data-id="${r.id}">Ver receta completa →</button>
      </div>
    `;
    const verMasBtn = card.querySelector('.btn-ver-mas');
    verMasBtn.addEventListener('click', () => {
      window.location.href = `receta.html?id=${r.id}`;
    });
    DOM.recetasContainer.appendChild(card);
  });
}

async function cargarRecetas() {
  try {
    const res = await fetch(`${API}/api/recipes`);
    todasLasRecetas = await res.json();
    renderizarRecetas(todasLasRecetas);
  } catch (err) {
    console.error('Error cargando recetas', err);
    if (DOM.recetasContainer) {
      DOM.recetasContainer.innerHTML = `
        <div class="error-message">
          <p>❌ Error al cargar las recetas</p>
          <small>Intenta recargar la página</small>
        </div>
      `;
    }
  }
}

async function init() {
  token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error('Token inválido');
    }
    const userData = await res.json();
    currentUser = {
      username: userData.username,
      esPremium: userData.esPremium
    };
    if (DOM.userName) DOM.userName.textContent = currentUser.username || 'Usuario';
    if (currentUser.esPremium) {
      if (DOM.premiumBadge) DOM.premiumBadge.style.display = 'flex';
      if (DOM.chatBoton) DOM.chatBoton.style.display = 'block';
    }
    await cargarRecetas();
    setupEventListeners();
    setupChatbot();
  } catch (err) {
    console.error('Error en init:', err);
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

function setupEventListeners() {
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', () => filtrarRecetas());
  }
  DOM.filterTags.forEach(tag => {
    tag.addEventListener('click', function() {
      const isActive = this.classList.contains('active-filter');
      if (isActive) {
        this.classList.remove('active-filter');
      } else {
        DOM.filterTags.forEach(t => t.classList.remove('active-filter'));
        this.classList.add('active-filter');
      }
      filtrarRecetas();
    });
  });
  if (DOM.cerrarSesionBtn) {
    DOM.cerrarSesionBtn.addEventListener('click', cerrarSesion);
  }
}

function agregarMensaje(tipo, texto, esOpcion = false, recetaId = null) {
  if (!DOM.chatMessages) return;
  const div = document.createElement('div');
  div.className = `msg msg-${tipo}`;
  
  if (esOpcion && recetaId) {
    div.innerHTML = `<button class="chat-receta-btn" data-id="${recetaId}">📖 ${escapeHTML(texto)}</button>`;
    const btn = div.querySelector('.chat-receta-btn');
    btn.addEventListener('click', () => {
      mostrarRecetaCompleta(recetaId);
    });
  } else {
    div.textContent = texto;
  }
  
  DOM.chatMessages.appendChild(div);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function mostrarRecetaCompleta(recetaId) {
  const receta = todasLasRecetas.find(r => r.id === recetaId);
  if (!receta) return;
  
  const ingredientesLista = receta.ingredientes.split(',').map(i => i.trim()).slice(0, 5);
  const ingredientesTexto = ingredientesLista.join('\n   • ');
  const precioNumerico = receta.precioNumerico || obtenerValorNumerico(receta.precio);
  const tiempoNumerico = receta.tiempoNumerico || obtenerValorNumerico(receta.tiempo);
  
  const mensaje = `📖 ${receta.titulo}\n\n💰 ${receta.precio || '$$'} ${precioNumerico > 0 ? `($${precioNumerico})` : ''}\n⏱️ ${receta.tiempo || '30 min'} ${tiempoNumerico > 0 ? `(${tiempoNumerico} min)` : ''}\n👨‍🍳 Autor: ${receta.autor}\n\n🥘 Ingredientes:\n   • ${ingredientesTexto}${receta.ingredientes.split(',').length > 5 ? '\n   • ...' : ''}\n\n📝 Para ver la receta completa, haz clic en el botón de abajo.`;
  
  agregarMensaje('bot', mensaje);
  
  const divBotones = document.createElement('div');
  divBotones.className = 'msg msg-bot';
  divBotones.innerHTML = `
    <div style="display: flex; gap: 10px; margin-top: 8px;">
      <button class="chat-ver-completa-btn" data-id="${receta.id}" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">🔍 Ver receta completa</button>
    </div>
  `;
  DOM.chatMessages.appendChild(divBotones);
  const verBtn = divBotones.querySelector('.chat-ver-completa-btn');
  verBtn.addEventListener('click', () => {
    window.location.href = `receta.html?id=${receta.id}`;
  });
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function buscarRecetasEnChat(busqueda) {
  const busquedaLower = busqueda.toLowerCase();
  const resultados = todasLasRecetas.filter(r => 
    r.titulo.toLowerCase().includes(busquedaLower) ||
    r.ingredientes.toLowerCase().includes(busquedaLower) ||
    r.pasos.toLowerCase().includes(busquedaLower)
  );
  
  if (resultados.length === 0) {
    agregarMensaje('bot', `No encontré recetas relacionadas con "${busqueda}".\n\n💡 Tips:\n- Busca por nombre: "pasta", "arroz", "pollo"\n- Busca por ingrediente: "huevo", "queso", "tomate"\n- Usa los filtros en la página principal`);
    return;
  }
  
  agregarMensaje('bot', `Encontré ${resultados.length} receta${resultados.length > 1 ? 's' : ''} relacionada${resultados.length > 1 ? 's' : ''} con "${busqueda}":`);
  
  resultados.forEach(r => {
    const precioNumerico = r.precioNumerico || obtenerValorNumerico(r.precio);
    const tiempoNumerico = r.tiempoNumerico || obtenerValorNumerico(r.tiempo);
    const textoOpcion = `${r.titulo} | 💰 ${r.precio || '$$'} | ⏱️ ${r.tiempo || '30 min'}`;
    agregarMensaje('bot', textoOpcion, true, r.id);
  });
  
  agregarMensaje('bot', '💡 Haz clic en cualquiera de las recetas arriba para ver más detalles.');
}

async function preguntar() {
  if (!DOM.chatInput) return;
  const pregunta = DOM.chatInput.value.trim();
  if (!pregunta) return;
  
  agregarMensaje('user', pregunta);
  DOM.chatInput.value = '';
  
  if (pregunta.toLowerCase() === 'menu' || pregunta.toLowerCase() === 'inicio' || pregunta.toLowerCase() === 'hola') {
    agregarMensaje('bot', '¡Hola! Soy ChefBot. ¿Qué receta te gustaría ver?\n\n🍳 Puedes buscarme por:\n• Nombre de la receta\n• Ingrediente principal\n• Tiempo de preparación\n• Precio aproximado\n\nEjemplos: "pasta", "huevo", "rápido", "menos de 30"');
    return;
  }
  
  buscarRecetasEnChat(pregunta);
}

function setupChatbot() {
  if (DOM.chatBoton) {
    DOM.chatBoton.addEventListener('click', () => {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'flex';
      agregarMensaje('bot', '¡Hola! Soy ChefBot. ¿Qué receta te gustaría ver?\n\n🍳 Puedes buscarme por:\n• Nombre de la receta\n• Ingrediente principal\n• Tiempo de preparación\n• Precio aproximado\n\nEjemplos: "pasta", "huevo", "rápido", "menos de 30"');
    });
  }
  if (DOM.cerrarChatBtn) {
    DOM.cerrarChatBtn.addEventListener('click', () => {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'none';
    });
  }
  if (DOM.enviarChatBtn) {
    DOM.enviarChatBtn.addEventListener('click', preguntar);
  }
  if (DOM.chatInput) {
    DOM.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') preguntar();
    });
  }
}

init();