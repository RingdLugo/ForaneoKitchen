const API = 'http://localhost:3000';

function obtenerIdReceta() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
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

function formatearIngredientes(ingredientes) {
  if (!ingredientes) return [];
  
  let items = ingredientes.split(',').map(i => i.trim()).filter(i => i);
  
  if (items.length === 1 && ingredientes.includes('\n')) {
    items = ingredientes.split('\n').map(i => i.trim()).filter(i => i);
  }
  
  return items;
}

function formatearPasos(pasos) {
  if (!pasos) return [];
  
  let items = [];
  
  if (pasos.match(/\d+\./)) {
    items = pasos.split(/\d+\./).filter(p => p.trim()).map(p => p.trim());
  } else if (pasos.includes('\n')) {
    items = pasos.split('\n').filter(p => p.trim()).map(p => p.trim());
  } else {
    items = [pasos.trim()];
  }
  
  return items;
}

function calcularPrecioPorPorcion(precio) {
  if (!precio || precio === '$$') return '—';
  const numeros = precio.replace(/[^0-9]/g, '');
  if (!numeros) return '—';
  const total = parseInt(numeros);
  const porcion = Math.round(total / 2);
  return `$${porcion}`;
}

function obtenerPrecioTotal(precio) {
  if (!precio || precio === '$$') return '—';
  const numeros = precio.replace(/[^0-9]/g, '');
  if (!numeros) return '—';
  return `$${numeros}`;
}

function renderizarReceta(receta) {
  const container = document.getElementById('receta-container');
  if (!container) return;
  
  const etiquetas = obtenerEtiquetasReceta(receta);
  const ingredientesLista = formatearIngredientes(receta.ingredientes);
  const pasosLista = formatearPasos(receta.pasos);
  const precioTotal = obtenerPrecioTotal(receta.precio);
  const precioPorcion = calcularPrecioPorPorcion(receta.precio);
  const tiempo = receta.tiempo || '30 min';
  const imagenURL = receta.imagen || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e8f5e9"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%234caf50" font-size="40"%3E🍳%3C/text%3E%3C/svg%3E';
  
  const etiquetasHTML = etiquetas.map(etq => 
    `<span class="receta-tag">${escapeHTML(etq)}</span>`
  ).join('');
  
  const ingredientesHTML = ingredientesLista.map(ing => 
    `<li>🍳 ${escapeHTML(ing)}</li>`
  ).join('');
  
  const pasosHTML = pasosLista.map((paso, index) => 
    `<div class="paso-item">
      <div class="paso-numero">${index + 1}</div>
      <div class="paso-texto">${escapeHTML(paso)}</div>
    </div>`
  ).join('');
  
  container.innerHTML = `
    <div class="receta-imagen">
      <img src="${escapeHTML(imagenURL)}" alt="${escapeHTML(receta.titulo)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23e8f5e9\'/%3E%3Ctext x=\'50\' y=\'55\' text-anchor=\'middle\' fill=\'%234caf50\' font-size=\'40\'%3E🍳%3C/text%3E%3C/svg%3E'">
    </div>
    <div class="receta-content">
      <h1>${escapeHTML(receta.titulo)}</h1>
      <div class="receta-autor">
        <span>👨‍🍳</span> ${escapeHTML(receta.autor)}
      </div>
      
      <div class="info-cards">
        <div class="info-card">
          <span class="info-icon">💰</span>
          <div class="info-label">TOTAL</div>
          <div class="info-value total">${escapeHTML(precioTotal)}</div>
        </div>
        <div class="info-card">
          <span class="info-icon">🍽️</span>
          <div class="info-label">POR PORCIÓN</div>
          <div class="info-value">${escapeHTML(precioPorcion)}</div>
        </div>
        <div class="info-card">
          <span class="info-icon">⏱️</span>
          <div class="info-label">TIEMPO</div>
          <div class="info-value">${escapeHTML(tiempo)}</div>
        </div>
      </div>
      
      <div class="seccion">
        <h2>📝 Ingredientes</h2>
        <ul class="lista-ingredientes">
          ${ingredientesHTML}
        </ul>
      </div>
      
      <div class="seccion">
        <h2>👨‍🍳 Preparación</h2>
        <div class="pasos-lista">
          ${pasosHTML}
        </div>
      </div>
      
      <div class="receta-tags">
        ${etiquetasHTML}
      </div>
    </div>
  `;
}

function mostrarError(mensaje) {
  const container = document.getElementById('receta-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="error-message">
      <div class="error-icon">😢</div>
      <p>${mensaje}</p>
      <button onclick="window.location.href='home.html'">Volver a recetas</button>
    </div>
  `;
}

async function cargarReceta() {
  const id = obtenerIdReceta();
  
  if (!id) {
    mostrarError('No se especificó qué receta ver');
    return;
  }
  
  try {
    const res = await fetch(`${API}/api/recetas/${id}`);
    
    if (!res.ok) {
      if (res.status === 404) {
        mostrarError('La receta que buscas no existe');
      } else {
        mostrarError('Error al cargar la receta');
      }
      return;
    }
    
    const receta = await res.json();
    renderizarReceta(receta);
    
  } catch (err) {
    console.error('Error:', err);
    mostrarError('No se pudo conectar con el servidor');
  }
}

cargarReceta();