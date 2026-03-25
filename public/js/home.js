const API = 'http://localhost:3000';
let token = localStorage.getItem('token');
let currentUser = null;
let todasLasRecetas = [];
let imagenSeleccionada = null;

const DOM = {
  userName: document.getElementById('user-name'),
  premiumBadge: document.getElementById('premium-badge'),
  searchInput: document.getElementById('search-input'),
  filterTags: document.querySelectorAll('.tag'),
  recetasContainer: document.getElementById('recetas'),
  titulo: document.getElementById('titulo'),
  ingredientes: document.getElementById('ingredientes'),
  pasos: document.getElementById('pasos'),
  precio: document.getElementById('precio'),
  tiempo: document.getElementById('tiempo'),
  imagenInput: document.getElementById('receta-imagen'),
  imagePreview: document.getElementById('image-preview'),
  previewImg: document.getElementById('preview-img'),
  publicarBtn: document.getElementById('publicar-btn'),
  cerrarSesionBtn: document.getElementById('cerrar-sesion-btn'),
  chatBoton: document.getElementById('chat-boton'),
  chatWindow: document.getElementById('chat-window'),
  cerrarChatBtn: document.getElementById('cerrar-chat-btn'),
  chatInput: document.getElementById('chat-input'),
  enviarChatBtn: document.getElementById('enviar-chat-btn'),
  chatMessages: document.getElementById('chat-messages'),
  removeImageBtn: document.getElementById('remove-image-btn')
};

function validarTitulo(titulo) {
  const regex = /^[a-zA-ZáéíóúñÑÁÉÍÓÚ\s0-9\-_,.!?()]+$/;
  if (!titulo || titulo.trim() === '') {
    return { valido: false, mensaje: '❌ El título no puede estar vacío' };
  }
  if (!regex.test(titulo)) {
    return { valido: false, mensaje: '❌ El título solo puede contener letras, números y espacios' };
  }
  if (titulo.length < 3) {
    return { valido: false, mensaje: '❌ El título debe tener al menos 3 caracteres' };
  }
  if (titulo.length > 100) {
    return { valido: false, mensaje: '❌ El título no puede exceder los 100 caracteres' };
  }
  return { valido: true, valor: titulo.trim() };
}

function validarPrecio(precio) {
  if (!precio || precio.trim() === '') {
    return { valido: true, valor: '$$' };
  }
  const numeros = precio.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: '❌ El costo debe contener al menos un número' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 0) {
    return { valido: false, mensaje: '❌ El costo no puede ser negativo' };
  }
  if (valorNumerico > 999) {
    return { valido: false, mensaje: '❌ El costo no puede exceder los $999' };
  }
  return { valido: true, valor: `$${valorNumerico} MXN` };
}

function validarTiempo(tiempo) {
  if (!tiempo || tiempo.trim() === '') {
    return { valido: true, valor: '30 min' };
  }
  const numeros = tiempo.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: '❌ El tiempo debe contener al menos un número' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 1) {
    return { valido: false, mensaje: '❌ El tiempo debe ser mayor a 0 minutos' };
  }
  if (valorNumerico > 180) {
    return { valido: false, mensaje: '❌ El tiempo no puede exceder los 180 minutos' };
  }
  return { valido: true, valor: `${valorNumerico} min` };
}

function validarIngredientes(ingredientes) {
  if (!ingredientes || ingredientes.trim() === '') {
    return { valido: false, mensaje: '❌ Los ingredientes son obligatorios' };
  }
  
  let items = ingredientes.split(',').map(i => i.trim()).filter(i => i);
  
  if (items.length === 0) {
    return { valido: false, mensaje: '❌ Debes agregar al menos un ingrediente' };
  }
  
  if (items.length > 20) {
    return { valido: false, mensaje: '❌ No puedes agregar más de 20 ingredientes' };
  }
  
  for (let item of items) {
    if (item.length < 2) {
      return { valido: false, mensaje: '❌ Cada ingrediente debe tener al menos 2 caracteres' };
    }
    if (item.length > 100) {
      return { valido: false, mensaje: '❌ Un ingrediente no puede exceder los 100 caracteres' };
    }
  }
  
  const ingredientesFormateados = items.join(', ');
  return { valido: true, valor: ingredientesFormateados, lista: items };
}

function validarPasos(pasos) {
  if (!pasos || pasos.trim() === '') {
    return { valido: false, mensaje: '❌ Los pasos de preparación son obligatorios' };
  }
  
  let pasosLista = [];
  
  if (pasos.match(/\d+\./)) {
    pasosLista = pasos.split(/\d+\./).filter(p => p.trim()).map(p => p.trim());
  } else if (pasos.includes('\n')) {
    pasosLista = pasos.split('\n').filter(p => p.trim()).map(p => p.trim());
  } else {
    pasosLista = [pasos.trim()];
  }
  
  if (pasosLista.length === 0) {
    return { valido: false, mensaje: '❌ Debes agregar al menos un paso' };
  }
  
  if (pasosLista.length > 20) {
    return { valido: false, mensaje: '❌ No puedes agregar más de 20 pasos' };
  }
  
  for (let paso of pasosLista) {
    if (paso.length < 5) {
      return { valido: false, mensaje: '❌ Cada paso debe tener al menos 5 caracteres' };
    }
    if (paso.length > 500) {
      return { valido: false, mensaje: '❌ Un paso no puede exceder los 500 caracteres' };
    }
  }
  
  const pasosFormateados = pasosLista.map((paso, index) => {
    return `${index + 1}. ${paso}`;
  }).join('\n');
  
  return { valido: true, valor: pasosFormateados, lista: pasosLista };
}

function validarImagen(file) {
  if (!file) return { valido: true };
  
  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(file.type)) {
    return { valido: false, mensaje: '❌ Solo se permiten imágenes JPG, PNG o WEBP' };
  }
  
  if (file.size > 5 * 1024 * 1024) {
    return { valido: false, mensaje: '❌ La imagen no puede exceder los 5MB' };
  }
  
  return { valido: true };
}

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

function convertirImagenABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function coincideConFiltro(receta, filtro) {
  const tituloLower = receta.titulo.toLowerCase();
  const ingredientesLower = receta.ingredientes.toLowerCase();
  const pasosLower = receta.pasos.toLowerCase();
  const precio = receta.precio || '';
  const precioNumerico = parseInt(precio.replace(/[^0-9]/g, '')) || 0;
  
  switch(filtro) {
    case 'economicas':
      return ingredientesLower.includes('barato') || 
             ingredientesLower.includes('económico') ||
             ingredientesLower.includes('arroz') ||
             ingredientesLower.includes('papa') ||
             ingredientesLower.includes('huevo') ||
             ingredientesLower.includes('frijol') ||
             ingredientesLower.includes('lenteja') ||
             tituloLower.includes('económico') ||
             tituloLower.includes('barato');
    
    case 'rapidas':
      return pasosLower.includes('rápido') ||
             pasosLower.includes('minutos') ||
             pasosLower.includes('15 min') ||
             pasosLower.includes('10 min') ||
             pasosLower.includes('5 min') ||
             tituloLower.includes('rápida') ||
             tituloLower.includes('exprés');
    
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
  const tituloLower = receta.titulo.toLowerCase();
  const ingredientesLower = receta.ingredientes.toLowerCase();
  const pasosLower = receta.pasos.toLowerCase();
  const precio = receta.precio || '';
  const precioNumerico = parseInt(precio.replace(/[^0-9]/g, '')) || 0;
  
  if (ingredientesLower.includes('huevo') || ingredientesLower.includes('arroz') ||
      ingredientesLower.includes('papa') || ingredientesLower.includes('lenteja') ||
      ingredientesLower.includes('frijol') || ingredientesLower.includes('pasta') ||
      tituloLower.includes('económico') || tituloLower.includes('barato')) {
    etiquetas.push('económicas');
  }
  
  if (pasosLower.includes('rápido') || pasosLower.includes('minutos') ||
      pasosLower.includes('15 min') || pasosLower.includes('10 min') ||
      pasosLower.includes('5 min') || tituloLower.includes('rápida')) {
    etiquetas.push('rápidas');
  }
  
  if (pasosLower.includes('microondas') || ingredientesLower.includes('microondas')) {
    etiquetas.push('microondas');
  }
  
  if (precioNumerico > 0 && precioNumerico <= 30) {
    etiquetas.push('menos de $30');
  }
  
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
    recetasFiltradas = recetasFiltradas.filter(receta => 
      coincideConFiltro(receta, filtroCategoria)
    );
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
    mensaje = `No se encontraron recetas con el filtro "${nombreFiltro}".`;
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
    
    const etiquetasHTML = etiquetas.map(etq => 
      `<span class="recipe-tag">${escapeHTML(etq)}</span>`
    ).join('');
    
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
        <div class="recipe-tags">
          ${etiquetasHTML}
        </div>
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
    const res = await fetch(`${API}/api/recetas`);
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

async function subirReceta() {
  if (!token) {
    mostrarNotificacion('Debes iniciar sesión para publicar recetas', 'error');
    return;
  }

  const tituloRaw = DOM.titulo.value;
  const precioRaw = DOM.precio.value;
  const tiempoRaw = DOM.tiempo.value;
  const ingredientesRaw = DOM.ingredientes.value;
  const pasosRaw = DOM.pasos.value;

  const tituloValidacion = validarTitulo(tituloRaw);
  if (!tituloValidacion.valido) {
    mostrarNotificacion(tituloValidacion.mensaje, 'error');
    DOM.titulo.focus();
    return;
  }

  const precioValidacion = validarPrecio(precioRaw);
  if (!precioValidacion.valido) {
    mostrarNotificacion(precioValidacion.mensaje, 'error');
    DOM.precio.focus();
    return;
  }

  const tiempoValidacion = validarTiempo(tiempoRaw);
  if (!tiempoValidacion.valido) {
    mostrarNotificacion(tiempoValidacion.mensaje, 'error');
    DOM.tiempo.focus();
    return;
  }

  const ingredientesValidacion = validarIngredientes(ingredientesRaw);
  if (!ingredientesValidacion.valido) {
    mostrarNotificacion(ingredientesValidacion.mensaje, 'error');
    DOM.ingredientes.focus();
    return;
  }

  const pasosValidacion = validarPasos(pasosRaw);
  if (!pasosValidacion.valido) {
    mostrarNotificacion(pasosValidacion.mensaje, 'error');
    DOM.pasos.focus();
    return;
  }

  if (imagenSeleccionada) {
    const imagenValidacion = validarImagen(imagenSeleccionada);
    if (!imagenValidacion.valido) {
      mostrarNotificacion(imagenValidacion.mensaje, 'error');
      return;
    }
  }

  let imagenBase64 = null;
  if (imagenSeleccionada) {
    try {
      imagenBase64 = await convertirImagenABase64(imagenSeleccionada);
    } catch (err) {
      console.error('Error al convertir imagen:', err);
      mostrarNotificacion('Error al procesar la imagen', 'error');
      return;
    }
  }

  const datos = {
    titulo: tituloValidacion.valor,
    ingredientes: ingredientesValidacion.valor,
    pasos: pasosValidacion.valor,
    precio: precioValidacion.valor,
    tiempo: tiempoValidacion.valor,
    imagen: imagenBase64
  };

  try {
    const res = await fetch(`${API}/api/recetas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datos)
    });

    if (res.ok) {
      mostrarNotificacion('🎉 ¡Receta publicada exitosamente!', 'success');
      
      DOM.titulo.value = '';
      DOM.ingredientes.value = '';
      DOM.pasos.value = '';
      DOM.precio.value = '';
      DOM.tiempo.value = '';
      eliminarImagen();
      
      await cargarRecetas();
      
      if (DOM.searchInput) DOM.searchInput.value = '';
      document.querySelectorAll('.tag').forEach(t => t.classList.remove('active-filter'));
      
    } else {
      const err = await res.json();
      mostrarNotificacion(err.error || 'Error al publicar', 'error');
    }
  } catch (err) {
    console.error('Error:', err);
    mostrarNotificacion('No se pudo conectar con el servidor', 'error');
  }
}

function eliminarImagen() {
  imagenSeleccionada = null;
  if (DOM.imagenInput) DOM.imagenInput.value = '';
  if (DOM.imagePreview) DOM.imagePreview.style.display = 'none';
  if (DOM.previewImg) DOM.previewImg.src = '';
}

function setupImageUpload() {
  if (!DOM.imagenInput) return;
  
  DOM.imagenInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const validacion = validarImagen(file);
      if (!validacion.valido) {
        mostrarNotificacion(validacion.mensaje, 'error');
        DOM.imagenInput.value = '';
        return;
      }
      
      imagenSeleccionada = file;
      const reader = new FileReader();
      reader.onload = function(event) {
        DOM.previewImg.src = event.target.result;
        DOM.imagePreview.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    } else if (file) {
      mostrarNotificacion('Por favor selecciona un archivo de imagen válido', 'error');
      imagenSeleccionada = null;
    }
  });
  
  if (DOM.removeImageBtn) {
    DOM.removeImageBtn.addEventListener('click', eliminarImagen);
  }
}

async function init() {
  if (!token) return window.location.href = 'login.html';

  try {
    const res = await fetch(`${API}/api/recetas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Token inválido');

    const payload = JSON.parse(atob(token.split('.')[1]));

    currentUser = {
      username: payload.username,
      esPremium: payload.esPremium
    };

    if (DOM.userName) DOM.userName.textContent = currentUser.username || 'Usuario';

    if (currentUser.esPremium) {
      if (DOM.premiumBadge) DOM.premiumBadge.style.display = 'flex';
      if (DOM.chatBoton) DOM.chatBoton.style.display = 'block';
    }

    await cargarRecetas();
    setupEventListeners();

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

  if (DOM.publicarBtn) {
    DOM.publicarBtn.addEventListener('click', subirReceta);
  }

  if (DOM.cerrarSesionBtn) {
    DOM.cerrarSesionBtn.addEventListener('click', cerrarSesion);
  }

  setupImageUpload();
}

function agregarMensaje(tipo, texto) {
  if (!DOM.chatMessages) return;
  
  const div = document.createElement('div');
  div.className = `msg msg-${tipo}`;
  div.textContent = texto;
  DOM.chatMessages.appendChild(div);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

async function preguntar() {
  if (!DOM.chatInput) return;
  
  const pregunta = DOM.chatInput.value.trim();
  if (!pregunta) return;

  agregarMensaje('user', pregunta);
  DOM.chatInput.value = '';

  try {
    const res = await fetch(`${API}/api/recetas`);
    const recetas = await res.json();

    let encontrado = '';
    const lower = pregunta.toLowerCase();

    recetas.forEach(r => {
      if (r.titulo.toLowerCase().includes(lower) ||
          r.ingredientes.toLowerCase().includes(lower) ||
          r.pasos.toLowerCase().includes(lower)) {
        encontrado += `📌 ${r.titulo}\n   💰 ${r.precio || '$$'} | ⏱️ ${r.tiempo || '30 min'}\n   👨‍🍳 Autor: ${r.autor}\n   🥘 Ingredientes: ${r.ingredientes.substring(0, 100)}...\n\n`;
      }
    });

    const respuesta = encontrado || `No encontré nada relacionado con "${pregunta}". Prueba con otro término como "arroz", "huevo" o "rápida".`;
    agregarMensaje('bot', respuesta);
  } catch (err) {
    agregarMensaje('bot', 'Error al buscar recetas 😔');
  }
}

function setupChatbot() {
  if (DOM.chatBoton) {
    DOM.chatBoton.addEventListener('click', () => {
      if (DOM.chatWindow) DOM.chatWindow.style.display = 'flex';
      agregarMensaje('bot', '¡Hola! Soy ChefBot (solo para Premium). ¿Qué receta o ingrediente quieres ver?');
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

setupChatbot();
init();