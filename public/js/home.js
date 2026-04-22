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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function obtenerValorNumerico(texto) {
  if (!texto) return 0;
  const numeros = texto.match(/\d+/);
  return numeros ? parseInt(numeros[0]) : 0;
}

function coincideConFiltro(receta, filtro) {
  const precioNumerico = receta.precio_numerico || obtenerValorNumerico(receta.precio);
  const tiempoNumerico = receta.tiempo_numerico || obtenerValorNumerico(receta.tiempo);
  const pasosLower = (receta.pasos || '').toLowerCase();
  const ingredientesLower = (receta.ingredientes || '').toLowerCase();
  const tituloLower = (receta.titulo || '').toLowerCase();
  
  switch(filtro) {
    case 'economicas':
      return precioNumerico > 0 && precioNumerico <= 35;
    case 'rapidas':
      return tiempoNumerico > 0 && tiempoNumerico <= 20;
    case 'microondas':
      return pasosLower.includes('microondas') || ingredientesLower.includes('microondas') || tituloLower.includes('microondas');
    case 'menos30':
      return precioNumerico > 0 && precioNumerico <= 30;
    default:
      return true;
  }
}

function obtenerEtiquetasReceta(receta) {
  const etiquetas = [];
  const precioNumerico = receta.precio_numerico || obtenerValorNumerico(receta.precio);
  const tiempoNumerico = receta.tiempo_numerico || obtenerValorNumerico(receta.tiempo);
  const pasosLower = (receta.pasos || '').toLowerCase();
  
  if (precioNumerico > 0 && precioNumerico <= 35) etiquetas.push('economicas');
  if (tiempoNumerico > 0 && tiempoNumerico <= 20) etiquetas.push('rapidas');
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
}

function renderizarRecetas(recetas) {
  if (!DOM.recetasContainer) return;
  DOM.recetasContainer.innerHTML = '';
  
  if (recetas.length === 0) {
    DOM.recetasContainer.innerHTML = '<div class="no-results"><span>🍳</span><p>No hay recetas disponibles</p></div>';
    return;
  }
  
  recetas.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const etiquetas = obtenerEtiquetasReceta(r);
    const precio = r.precio || '$$';
    const tiempo = r.tiempo || '30 min';
    const etiquetasHTML = etiquetas.map(etq => `<span class="recipe-tag">${escapeHTML(etq)}</span>`).join('');
    const imagenURL = r.imagen || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e8f5e9"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%234caf50" font-size="40"%3E🍳%3C/text%3E%3C/svg%3E';
    
    card.innerHTML = `
      <div class="recipe-image"><img src="${imagenURL}" alt="${escapeHTML(r.titulo)}"></div>
      <div class="recipe-content">
        <h3>${escapeHTML(r.titulo)}</h3>
        <div class="recipe-meta"><span class="recipe-price">💰 ${escapeHTML(precio)}</span><span class="recipe-time">⏱️ ${escapeHTML(tiempo)}</span></div>
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
    if (!res.ok) throw new Error('Error al cargar recetas');
    todasLasRecetas = await res.json();
    renderizarRecetas(todasLasRecetas);
  } catch (err) {
    console.error('Error cargando recetas', err);
    if (DOM.recetasContainer) {
      DOM.recetasContainer.innerHTML = '<div class="error-message"><p>Error al cargar las recetas</p></div>';
    }
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
      window.location.href = `receta.html?id=${recetaId}`;
    });
  } else {
    div.textContent = texto;
  }
  
  DOM.chatMessages.appendChild(div);
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
    agregarMensaje('bot', `No encontré recetas relacionadas con "${busqueda}"`);
    return;
  }
  
  agregarMensaje('bot', `Encontré ${resultados.length} receta${resultados.length > 1 ? 's' : ''}:`);
  
  resultados.forEach(r => {
    const textoOpcion = `${r.titulo} | 💰 ${r.precio || '$$'} | ⏱️ ${r.tiempo || '30 min'}`;
    agregarMensaje('bot', textoOpcion, true, r.id);
  });
}

async function preguntar() {
  if (!DOM.chatInput) return;
  const pregunta = DOM.chatInput.value.trim();
  if (!pregunta) return;
  
  agregarMensaje('user', pregunta);
  DOM.chatInput.value = '';
  
  if (pregunta.toLowerCase() === 'menu' || pregunta.toLowerCase() === 'inicio' || pregunta.toLowerCase() === 'hola') {
    agregarMensaje('bot', 'Hola. Soy ChefBot. Busca recetas por nombre o ingrediente.');
    return;
  }
  
  buscarRecetasEnChat(pregunta);
}

function setupChatbot() {
  if (DOM.chatBoton) {
    DOM.chatBoton.addEventListener('click', () => {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'flex';
      agregarMensaje('bot', 'Hola. Busca recetas por nombre o ingrediente.');
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
    if (!res.ok) throw new Error('Token invalido');
    const userData = await res.json();
    currentUser = { username: userData.username, esPremium: userData.esPremium };
    if (DOM.userName) DOM.userName.textContent = currentUser.username || 'Usuario';
    if (currentUser.esPremium && DOM.premiumBadge) DOM.premiumBadge.style.display = 'flex';
    if (currentUser.esPremium && DOM.chatBoton) DOM.chatBoton.style.display = 'block';
    await cargarRecetas();
    setupEventListeners();
    setupChatbot();
  } catch (err) {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

function setupEventListeners() {
  if (DOM.searchInput) DOM.searchInput.addEventListener('input', () => filtrarRecetas());
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
  if (DOM.cerrarSesionBtn) DOM.cerrarSesionBtn.addEventListener('click', cerrarSesion);
}

init();