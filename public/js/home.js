var API = 'http://localhost:3000';

var token = localStorage.getItem('token');
var currentUser = null;
var todasLasRecetas = [];

var DOM = {
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
  var numeros = texto.match(/\d+/);
  return numeros ? parseInt(numeros[0]) : 0;
}

function coincideConFiltro(receta, filtro) {
  var precioNumerico = receta.precio_numerico || obtenerValorNumerico(receta.precio);
  var tiempoNumerico = receta.tiempo_numerico || obtenerValorNumerico(receta.tiempo);
  var pasosLower = (receta.pasos || '').toLowerCase();
  var ingredientesLower = (receta.ingredientes || '').toLowerCase();
  var tituloLower = (receta.titulo || '').toLowerCase();
  
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
  var etiquetas = [];
  var precioNumerico = receta.precio_numerico || obtenerValorNumerico(receta.precio);
  var tiempoNumerico = receta.tiempo_numerico || obtenerValorNumerico(receta.tiempo);
  var pasosLower = (receta.pasos || '').toLowerCase();
  
  if (precioNumerico > 0 && precioNumerico <= 35) etiquetas.push('economicas');
  if (tiempoNumerico > 0 && tiempoNumerico <= 20) etiquetas.push('rapidas');
  if (pasosLower.includes('microondas')) etiquetas.push('microondas');
  if (precioNumerico > 0 && precioNumerico <= 30) etiquetas.push('menos de $30');
  
  return etiquetas;
}

function filtrarRecetas() {
  if (!todasLasRecetas.length) return;
  var textoBusqueda = DOM.searchInput ? DOM.searchInput.value.toLowerCase().trim() : '';
  var filtroActivo = document.querySelector('.tag.active-filter');
  var filtroCategoria = filtroActivo ? filtroActivo.dataset.filter : null;
  var recetasFiltradas = todasLasRecetas.slice();
  
  if (textoBusqueda) {
    recetasFiltradas = recetasFiltradas.filter(function(receta) {
      return receta.titulo.toLowerCase().includes(textoBusqueda) ||
             receta.ingredientes.toLowerCase().includes(textoBusqueda) ||
             receta.pasos.toLowerCase().includes(textoBusqueda) ||
             (receta.autor && receta.autor.toLowerCase().includes(textoBusqueda));
    });
  }
  if (filtroCategoria) {
    recetasFiltradas = recetasFiltradas.filter(function(receta) {
      return coincideConFiltro(receta, filtroCategoria);
    });
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
  
  for (var i = 0; i < recetas.length; i++) {
    var r = recetas[i];
    var card = document.createElement('div');
    card.className = 'recipe-card';
    var etiquetas = obtenerEtiquetasReceta(r);
    var precio = r.precio || '$$';
    var tiempo = r.tiempo || '30 min';
    var etiquetasHTML = '';
    for (var e = 0; e < etiquetas.length; e++) {
      etiquetasHTML += '<span class="recipe-tag">' + escapeHTML(etiquetas[e]) + '</span>';
    }
    var imagenURL = r.imagen || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e8f5e9"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%234caf50" font-size="40"%3E🍳%3C/text%3E%3C/svg%3E';
    
    card.innerHTML = `
      <div class="recipe-image"><img src="${imagenURL}" alt="${escapeHTML(r.titulo)}"></div>
      <div class="recipe-content">
        <h3>${escapeHTML(r.titulo)}</h3>
        <div class="recipe-meta"><span class="recipe-price">💰 ${escapeHTML(precio)}</span><span class="recipe-time">⏱️ ${escapeHTML(tiempo)}</span></div>
        <div class="recipe-tags">${etiquetasHTML}</div>
        <button class="btn-ver-mas" data-id="${r.id}">Ver receta completa →</button>
      </div>
    `;
    
    var verMasBtn = card.querySelector('.btn-ver-mas');
    verMasBtn.addEventListener('click', function(id) {
      return function() {
        registrarVistaReceta(id);
        window.location.href = 'receta.html?id=' + id;
      };
    }(r.id));
    DOM.recetasContainer.appendChild(card);
  }
}

async function registrarVistaReceta(recipeId) {
  if (!token) return;
  try {
    await fetch(API + '/api/users/me/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ recipeId: recipeId })
    });
  } catch (err) {
    console.error('Error al registrar vista:', err);
  }
}

async function cargarRecetas() {
  try {
    var res = await fetch(API + '/api/recipes');
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

function agregarMensaje(tipo, texto, esOpcion, recetaId) {
  if (esOpcion === undefined) esOpcion = false;
  if (!DOM.chatMessages) return;
  var div = document.createElement('div');
  div.className = 'msg msg-' + tipo;
  
  if (esOpcion && recetaId) {
    div.innerHTML = '<button class="chat-receta-btn" data-id="' + recetaId + '">📖 ' + escapeHTML(texto) + '</button>';
    var btn = div.querySelector('.chat-receta-btn');
    btn.addEventListener('click', function() {
      window.location.href = 'receta.html?id=' + recetaId;
    });
  } else {
    div.textContent = texto;
  }
  
  DOM.chatMessages.appendChild(div);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function mostrarResultadosChat(resultados, busqueda) {
  if (resultados.length === 0) {
    agregarMensaje('bot', 'No encontré recetas relacionadas con "' + busqueda + '"');
    return;
  }
  agregarMensaje('bot', 'Encontré ' + resultados.length + ' receta' + (resultados.length > 1 ? 's' : '') + ':');
  var limite = Math.min(resultados.length, 5);
  for (var i = 0; i < limite; i++) {
    var r = resultados[i];
    var textoOpcion = r.titulo + ' | 💰 ' + (r.precio || '$$') + ' | ⏱️ ' + (r.tiempo || '30 min');
    agregarMensaje('bot', textoOpcion, true, r.id);
  }
  if (resultados.length > 5) {
    agregarMensaje('bot', '...y ' + (resultados.length - 5) + ' más. Usa el buscador para ver todas.');
  }
}

function buscarPorIngrediente(ingrediente) {
  var busquedaLower = ingrediente.toLowerCase();
  var resultados = todasLasRecetas.filter(function(r) {
    return r.ingredientes.toLowerCase().includes(busquedaLower);
  });
  mostrarResultadosChat(resultados, ingrediente);
}

function buscarRapidas() {
  var resultados = todasLasRecetas.filter(function(r) {
    return (r.tiempo_numerico || obtenerValorNumerico(r.tiempo)) <= 20;
  });
  mostrarResultadosChat(resultados, 'rápidas');
}

function buscarEconomicas() {
  var resultados = todasLasRecetas.filter(function(r) {
    return (r.precio_numerico || obtenerValorNumerico(r.precio)) <= 30;
  });
  mostrarResultadosChat(resultados, 'económicas');
}

function procesarMensajeNatural(texto) {
  var lower = texto.toLowerCase().trim();
  
  if (lower.includes('pollo')) return buscarPorIngrediente('pollo');
  if (lower.includes('carne')) return buscarPorIngrediente('carne');
  if (lower.includes('pescado')) return buscarPorIngrediente('pescado');
  if (lower.includes('huevo')) return buscarPorIngrediente('huevo');
  if (lower.includes('pasta')) return buscarPorIngrediente('pasta');
  if (lower.includes('arroz')) return buscarPorIngrediente('arroz');
  if (lower.includes('rápida') || lower.includes('rapida')) return buscarRapidas();
  if (lower.includes('económica') || lower.includes('economica')) return buscarEconomicas();
  if (lower === 'menu' || lower === 'inicio' || lower === 'hola') {
    agregarMensaje('bot', '🍳 Hola, soy ChefBot. Puedo ayudarte a encontrar recetas. Ejemplos:\n- "¿Qué puedo cocinar con pollo?"\n- "Recetas rápidas"\n- "Comida económica"');
    return;
  }
  buscarRecetasEnChat(texto);
}

function buscarRecetasEnChat(busqueda) {
  var busquedaLower = busqueda.toLowerCase();
  var resultados = todasLasRecetas.filter(function(r) {
    return r.titulo.toLowerCase().includes(busquedaLower) ||
           r.ingredientes.toLowerCase().includes(busquedaLower) ||
           r.pasos.toLowerCase().includes(busquedaLower);
  });
  mostrarResultadosChat(resultados, busqueda);
}

async function preguntar() {
  if (!DOM.chatInput) return;
  var pregunta = DOM.chatInput.value.trim();
  if (!pregunta) return;
  
  agregarMensaje('user', pregunta);
  DOM.chatInput.value = '';
  procesarMensajeNatural(pregunta);
}

function setupChatbot() {
  if (DOM.chatBoton) {
    DOM.chatBoton.addEventListener('click', function() {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'flex';
      agregarMensaje('bot', '🍳 ¡Hola! Soy ChefBot. ¿Qué quieres cocinar hoy?\nPuedes preguntarme:\n• "Qué puedo cocinar con pollo"\n• "Recetas rápidas"\n• "Comida económica"');
    });
  }
  if (DOM.cerrarChatBtn) {
    DOM.cerrarChatBtn.addEventListener('click', function() {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'none';
    });
  }
  if (DOM.enviarChatBtn) {
    DOM.enviarChatBtn.addEventListener('click', preguntar);
  }
  if (DOM.chatInput) {
    DOM.chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') preguntar();
    });
  }
}

function initDarkMode() {
  var savedDark = localStorage.getItem('darkMode') === 'true';
  if (savedDark) {
    document.body.classList.add('dark-mode');
    var darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) darkToggle.textContent = '☀️';
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  var isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
  var btn = document.getElementById('dark-mode-toggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

async function init() {
  initDarkMode();
  var darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) darkToggle.addEventListener('click', toggleDarkMode);
  
  token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  try {
    var res = await fetch(API + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Token invalido');
    var userData = await res.json();
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
  if (DOM.searchInput) DOM.searchInput.addEventListener('input', function() { filtrarRecetas(); });
  for (var i = 0; i < DOM.filterTags.length; i++) {
    var tag = DOM.filterTags[i];
    tag.addEventListener('click', function() {
      var isActive = this.classList.contains('active-filter');
      if (isActive) {
        this.classList.remove('active-filter');
      } else {
        for (var j = 0; j < DOM.filterTags.length; j++) {
          DOM.filterTags[j].classList.remove('active-filter');
        }
        this.classList.add('active-filter');
      }
      filtrarRecetas();
    });
  }
  if (DOM.cerrarSesionBtn) DOM.cerrarSesionBtn.addEventListener('click', cerrarSesion);
}

init();