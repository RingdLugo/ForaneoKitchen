const API = 'http://localhost:3000';
let todasLasRecetas = [];
let planSemanal = {
  lunes: { desayuno: null, comida: null, cena: null },
  martes: { desayuno: null, comida: null, cena: null },
  miercoles: { desayuno: null, comida: null, cena: null },
  jueves: { desayuno: null, comida: null, cena: null },
  viernes: { desayuno: null, comida: null, cena: null },
  sabado: { desayuno: null, comida: null, cena: null },
  domingo: { desayuno: null, comida: null, cena: null }
};
let diaActual = null;
let comidaActual = null;

const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const comidas = ['desayuno', 'comida', 'cena'];
const nombresDias = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const nombresComidas = { desayuno: '🌅 Desayuno', comida: '🍽️ Comida', cena: '🌙 Cena' };

let presupuesto = 500;

function cargarPlanDesdeLocalStorage() {
  const guardado = localStorage.getItem('planSemanal');
  if (guardado) {
    planSemanal = JSON.parse(guardado);
  }
  const presupuestoGuardado = localStorage.getItem('presupuesto');
  if (presupuestoGuardado) {
    presupuesto = parseInt(presupuestoGuardado);
    document.getElementById('presupuesto-input').value = presupuesto;
  }
}

function guardarPlanEnLocalStorage() {
  localStorage.setItem('planSemanal', JSON.stringify(planSemanal));
  localStorage.setItem('presupuesto', presupuesto);
}

function calcularGastoTotal() {
  let total = 0;
  for (const dia of dias) {
    for (const comida of comidas) {
      const receta = planSemanal[dia][comida];
      if (receta) {
        const precioNumerico = receta.precioNumerico || parseInt(receta.precio?.replace(/[^0-9]/g, '')) || 0;
        total += precioNumerico;
      }
    }
  }
  return total;
}

function actualizarPresupuesto() {
  const total = calcularGastoTotal();
  const restante = presupuesto - total;
  document.getElementById('gasto-total').textContent = `Gasto total: $${total} MXN`;
  const restanteElement = document.getElementById('restante');
  restanteElement.textContent = `Restante: $${restante} MXN`;
  if (restante < 0) {
    restanteElement.style.color = '#ff5252';
  } else if (restante < 100) {
    restanteElement.style.color = '#ff9800';
  } else {
    restanteElement.style.color = '#4caf50';
  }
}

function renderizarPlanificador() {
  const container = document.getElementById('dias-container');
  container.innerHTML = '';
  for (const dia of dias) {
    const diaCard = document.createElement('div');
    diaCard.className = 'dia-card';
    diaCard.innerHTML = `
      <div class="dia-header">${nombresDias[dia]}</div>
      <div class="comidas-container">
        ${comidas.map(comida => `
          <div class="comida-item">
            <div class="comida-tipo">${nombresComidas[comida]}</div>
            <div id="${dia}-${comida}" class="receta-seleccionada-placeholder"></div>
            <button class="agregar-receta-btn" data-dia="${dia}" data-comida="${comida}">+ Agregar receta</button>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(diaCard);
  }
  for (const dia of dias) {
    for (const comida of comidas) {
      const receta = planSemanal[dia][comida];
      const placeholder = document.querySelector(`#${dia}-${comida}`);
      if (placeholder) {
        if (receta) {
          const precioNumerico = receta.precioNumerico || parseInt(receta.precio?.replace(/[^0-9]/g, '')) || 0;
          placeholder.innerHTML = `
            <div class="receta-seleccionada" data-dia="${dia}" data-comida="${comida}">
              <h4>${escapeHTML(receta.titulo)}</h4>
              <div class="receta-info">
                <span class="receta-precio">💰 ${escapeHTML(receta.precio || '$$')}</span>
                <span class="receta-tiempo">⏱️ ${escapeHTML(receta.tiempo || '30 min')}</span>
              </div>
              <button class="eliminar-receta" data-dia="${dia}" data-comida="${comida}">✖</button>
            </div>
          `;
        } else {
          placeholder.innerHTML = '<div class="vacio-mensaje" style="padding: 12px; text-align: center; color: #999;">Sin receta</div>';
        }
      }
    }
  }
  document.querySelectorAll('.agregar-receta-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      diaActual = btn.dataset.dia;
      comidaActual = btn.dataset.comida;
      abrirModalRecetas();
    });
  });
  document.querySelectorAll('.eliminar-receta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dia = btn.dataset.dia;
      const comida = btn.dataset.comida;
      planSemanal[dia][comida] = null;
      guardarPlanEnLocalStorage();
      renderizarPlanificador();
      actualizarPresupuesto();
    });
  });
  actualizarPresupuesto();
}

function abrirModalRecetas() {
  const modal = document.getElementById('modal-recetas');
  const searchInput = document.getElementById('modal-search-input');
  modal.style.display = 'flex';
  renderizarModalRecetas(todasLasRecetas);
  searchInput.value = '';
  searchInput.focus();
  searchInput.oninput = () => {
    const busqueda = searchInput.value.toLowerCase();
    const filtradas = todasLasRecetas.filter(r => 
      r.titulo.toLowerCase().includes(busqueda) ||
      r.ingredientes.toLowerCase().includes(busqueda)
    );
    renderizarModalRecetas(filtradas);
  };
}

function renderizarModalRecetas(recetas) {
  const container = document.getElementById('modal-recetas-list');
  if (recetas.length === 0) {
    container.innerHTML = '<div class="vacio-mensaje">No hay recetas disponibles</div>';
    return;
  }
  container.innerHTML = recetas.map(receta => {
    const precioNumerico = receta.precioNumerico || parseInt(receta.precio?.replace(/[^0-9]/g, '')) || 0;
    return `
      <div class="modal-receta-item" data-id="${receta.id}">
        <div class="modal-receta-info">
          <h4>${escapeHTML(receta.titulo)}</h4>
          <p>💰 ${escapeHTML(receta.precio || '$$')} | ⏱️ ${escapeHTML(receta.tiempo || '30 min')}</p>
        </div>
        <div class="modal-receta-precio">$${precioNumerico}</div>
      </div>
    `;
  }).join('');
  document.querySelectorAll('.modal-receta-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      const receta = todasLasRecetas.find(r => r.id === id);
      if (receta && diaActual && comidaActual) {
        planSemanal[diaActual][comidaActual] = receta;
        guardarPlanEnLocalStorage();
        cerrarModalRecetas();
        renderizarPlanificador();
        actualizarPresupuesto();
      }
    });
  });
}

function cerrarModalRecetas() {
  document.getElementById('modal-recetas').style.display = 'none';
  diaActual = null;
  comidaActual = null;
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

async function cargarRecetas() {
  try {
    const res = await fetch(`${API}/api/recetas`);
    todasLasRecetas = await res.json();
    renderizarModalRecetas(todasLasRecetas);
  } catch (err) {
    console.error('Error cargando recetas', err);
  }
}

function init() {
  cargarPlanDesdeLocalStorage();
  cargarRecetas();
  renderizarPlanificador();
  const presupuestoInput = document.getElementById('presupuesto-input');
  presupuestoInput.addEventListener('change', (e) => {
    presupuesto = parseInt(e.target.value) || 0;
    guardarPlanEnLocalStorage();
    actualizarPresupuesto();
  });
  document.getElementById('lista-compras-btn').addEventListener('click', () => {
    window.location.href = 'lista-compras.html';
  });
  document.querySelector('.modal-close').addEventListener('click', cerrarModalRecetas);
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-recetas')) cerrarModalRecetas();
  });
}

init();