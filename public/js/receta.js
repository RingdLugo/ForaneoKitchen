const API = 'http://localhost:3000';

function obtenerIdReceta() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatearIngredientes(ingredientes) {
  if (!ingredientes) return [];
  return ingredientes.split(',').map(i => i.trim()).filter(i => i);
}

function formatearPasos(pasos) {
  if (!pasos) return [];
  if (pasos.match(/\d+\./)) {
    return pasos.split(/\d+\./).filter(p => p.trim()).map(p => p.trim());
  }
  if (pasos.includes('\n')) {
    return pasos.split('\n').filter(p => p.trim()).map(p => p.trim());
  }
  return [pasos.trim()];
}

function renderizarReceta(receta) {
  const container = document.getElementById('receta-container');
  if (!container) return;
  
  const ingredientesLista = formatearIngredientes(receta.ingredientes);
  const pasosLista = formatearPasos(receta.pasos);
  const precio = receta.precio || '$$';
  const tiempo = receta.tiempo || '30 min';
  const imagenURL = receta.imagen || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e8f5e9"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%234caf50" font-size="40"%3E🍳%3C/text%3E%3C/svg%3E';
  
  const precioNumerico = parseInt(precio.replace(/[^0-9]/g, '')) || 0;
  const precioPorcion = precioNumerico > 0 ? Math.round(precioNumerico / 2) : 0;
  
  const ingredientesHTML = ingredientesLista.map(ing => `<li>🍳 ${escapeHTML(ing)}</li>`).join('');
  
  const pasosHTML = pasosLista.map((paso, index) => `
    <div class="paso-item">
      <div class="paso-numero">${index + 1}</div>
      <div class="paso-texto">${escapeHTML(paso)}</div>
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="receta-imagen">
      <img src="${imagenURL}" alt="${escapeHTML(receta.titulo)}">
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
          <div class="info-value total">${escapeHTML(precio)}</div>
        </div>
        <div class="info-card">
          <span class="info-icon">🍽️</span>
          <div class="info-label">POR PORCION</div>
          <div class="info-value">$${precioPorcion}</div>
        </div>
        <div class="info-card">
          <span class="info-icon">⏱️</span>
          <div class="info-label">TIEMPO</div>
          <div class="info-value">${escapeHTML(tiempo)}</div>
        </div>
      </div>
      
      <div class="seccion">
        <h2>📝 Ingredientes</h2>
        <ul class="lista-ingredientes">${ingredientesHTML}</ul>
      </div>
      
      <div class="seccion">
        <h2>👨‍🍳 Preparacion</h2>
        <div class="pasos-lista">${pasosHTML}</div>
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
    mostrarError('No se especifico que receta ver');
    return;
  }
  
  try {
    const res = await fetch(`${API}/api/recipes/${id}`);
    
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