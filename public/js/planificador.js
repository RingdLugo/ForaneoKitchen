const API = 'http://localhost:3000';
let todasLasRecetas = [];

let planSemanal = {
  lunes: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  martes: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  miercoles: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  jueves: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  viernes: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  sabado: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] },
  domingo: { desayuno: [], comida: [], cena: [], merienda: [], snack: [] }
};

let diaActual = null;
let comidaActual = null;
let diasAbiertos = {};

const diasLista = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const comidasLista = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];
const nombresDias = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const nombresComidas = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', merienda: 'Merienda', snack: 'Snack' };
const iconosComidas = { desayuno: '🥐', comida: '🍲', cena: '🍜', merienda: '🍎', snack: '🍿' };

let presupuesto = 500;

function cargarPlanDesdeLocalStorage() {
  const guardado = localStorage.getItem('planSemanal');
  if (guardado) {
    const planGuardado = JSON.parse(guardado);
    for (const dia of diasLista) {
      if (!planSemanal[dia]) planSemanal[dia] = {};
      for (const comida of comidasLista) {
        if (planGuardado[dia] && Array.isArray(planGuardado[dia][comida])) {
          planSemanal[dia][comida] = planGuardado[dia][comida];
        } else if (planGuardado[dia] && planGuardado[dia][comida] && !Array.isArray(planGuardado[dia][comida])) {
          planSemanal[dia][comida] = [planGuardado[dia][comida]];
        } else {
          planSemanal[dia][comida] = [];
        }
      }
    }
  }
  const presupuestoGuardado = localStorage.getItem('presupuesto');
  if (presupuestoGuardado) {
    presupuesto = parseInt(presupuestoGuardado);
    const presupuestoInput = document.getElementById('presupuesto-input');
    if (presupuestoInput) presupuestoInput.value = presupuesto;
  }
  const abiertosGuardados = localStorage.getItem('diasAbiertos');
  if (abiertosGuardados) {
    diasAbiertos = JSON.parse(abiertosGuardados);
  } else {
    for (const dia of diasLista) {
      diasAbiertos[dia] = dia === 'lunes';
    }
  }
}

function guardarPlanEnLocalStorage() {
  localStorage.setItem('planSemanal', JSON.stringify(planSemanal));
  localStorage.setItem('presupuesto', presupuesto);
  localStorage.setItem('diasAbiertos', JSON.stringify(diasAbiertos));
}

function toggleDia(dia) {
  diasAbiertos[dia] = !diasAbiertos[dia];
  guardarPlanEnLocalStorage();
  renderizarPlanificador();
}

function calcularGastoTotal() {
  let total = 0;
  for (const dia of diasLista) {
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia][comida];
      if (Array.isArray(recetas)) {
        for (const receta of recetas) {
          if (receta && receta.precio_numerico) {
            total += receta.precio_numerico;
          } else if (receta && receta.precio) {
            const precioNum = parseInt(receta.precio.replace(/[^0-9]/g, '')) || 0;
            total += precioNum;
          }
        }
      }
    }
  }
  return total;
}

function calcularGastoDia(dia) {
  let total = 0;
  for (const comida of comidasLista) {
    const recetas = planSemanal[dia][comida];
    if (Array.isArray(recetas)) {
      for (const receta of recetas) {
        if (receta) {
          const precioNum = receta.precio_numerico || parseInt(String(receta.precio).replace(/[^0-9]/g, '')) || 0;
          total += precioNum;
        }
      }
    }
  }
  return total;
}

function calcularGastoComida(dia, comida) {
  let total = 0;
  const recetas = planSemanal[dia][comida];
  if (Array.isArray(recetas)) {
    for (const receta of recetas) {
      if (receta) {
        const precioNum = receta.precio_numerico || parseInt(String(receta.precio).replace(/[^0-9]/g, '')) || 0;
        total += precioNum;
      }
    }
  }
  return total;
}

function actualizarPresupuesto() {
  const total = calcularGastoTotal();
  const restante = presupuesto - total;
  const gastoTotalElem = document.getElementById('gasto-total');
  const restanteElem = document.getElementById('restante');
  
  if (gastoTotalElem) gastoTotalElem.textContent = `$${total}`;
  if (restanteElem) {
    restanteElem.textContent = `$${restante}`;
    restanteElem.style.color = restante < 0 ? '#ff5252' : restante < 100 ? '#ff9800' : '#4caf50';
  }
}

function mostrarNotificacion(mensaje, esError = false) {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = mensaje;
  notif.style.background = esError ? '#ff5252' : '#4caf50';
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function vaciarPlan() {
  if (confirm('¿Estás seguro de que quieres vaciar todo el plan semanal?')) {
    for (const dia of diasLista) {
      for (const comida of comidasLista) {
        planSemanal[dia][comida] = [];
      }
    }
    guardarPlanEnLocalStorage();
    renderizarPlanificador();
    actualizarPresupuesto();
    mostrarNotificacion('Plan semanal vaciado');
  }
}

function exportarPlan() {
  let texto = '📅 PLAN SEMANAL DE COMIDAS\n';
  texto += `💰 Presupuesto: $${presupuesto}\n`;
  texto += `💸 Gasto total: $${calcularGastoTotal()}\n`;
  texto += `📊 Restante: $${presupuesto - calcularGastoTotal()}\n`;
  texto += '='.repeat(50) + '\n\n';
  
  for (const dia of diasLista) {
    texto += `\n📌 ${nombresDias[dia].toUpperCase()}\n`;
    texto += '-'.repeat(30) + '\n';
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia][comida];
      texto += `${iconosComidas[comida]} ${nombresComidas[comida]}:\n`;
      if (recetas && recetas.length > 0) {
        for (let i = 0; i < recetas.length; i++) {
          const receta = recetas[i];
          texto += `   ${i + 1}. ${receta.titulo} (${receta.precio || '$$'})\n`;
        }
      } else {
        texto += `   • Sin recetas\n`;
      }
      texto += '\n';
    }
    texto += `💰 Total día: $${calcularGastoDia(dia)}\n`;
    texto += '\n';
  }
  
  const blob = new Blob([texto], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-semanal-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarNotificacion('Plan exportado');
}

function eliminarReceta(dia, comida, index) {
  if (confirm('¿Eliminar esta receta del plan?')) {
    planSemanal[dia][comida].splice(index, 1);
    guardarPlanEnLocalStorage();
    renderizarPlanificador();
    actualizarPresupuesto();
    mostrarNotificacion('Receta eliminada');
  }
}

function agregarReceta(dia, comida, receta) {
  if (!planSemanal[dia][comida]) {
    planSemanal[dia][comida] = [];
  }
  planSemanal[dia][comida].push(receta);
  guardarPlanEnLocalStorage();
  renderizarPlanificador();
  actualizarPresupuesto();
  mostrarNotificacion(`✓ "${receta.titulo}" agregada a ${nombresDias[dia]} - ${nombresComidas[comida]}`);
}

function renderizarPlanificador() {
  const container = document.getElementById('dias-container');
  if (!container) return;
  container.innerHTML = '';
  
  for (const dia of diasLista) {
    const gastoDia = calcularGastoDia(dia);
    const estaAbierto = diasAbiertos[dia] === true;
    
    let comidasHTML = '';
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia][comida] || [];
      const gastoComida = calcularGastoComida(dia, comida);
      
      let recetasHTML = '';
      if (recetas.length === 0) {
        recetasHTML = '<div class="vacio-recetas">📭 Sin recetas</div>';
      } else {
        recetasHTML = recetas.map((receta, idx) => `
          <div class="receta-item">
            <div class="receta-info">
              <h4>${escapeHTML(receta.titulo)}</h4>
              <div class="receta-meta">
                <span class="receta-precio">💰 ${escapeHTML(receta.precio || '$$')}</span>
                <span class="receta-tiempo">⏱️ ${escapeHTML(receta.tiempo || '30min')}</span>
              </div>
            </div>
            <button class="btn-eliminar" onclick="eliminarReceta('${dia}', '${comida}', ${idx})">✖</button>
          </div>
        `).join('');
      }
      
      comidasHTML += `
        <div class="comida-card">
          <div class="comida-header">
            <span class="comida-icono">${iconosComidas[comida]}</span>
            <span class="comida-titulo">${nombresComidas[comida]}</span>
            <span class="comida-gasto">💰 $${gastoComida}</span>
          </div>
          <div class="recetas-lista">
            ${recetasHTML}
          </div>
          <button class="btn-agregar" onclick="abrirModalRecetas('${dia}', '${comida}')">
            <span>+</span> Agregar receta
          </button>
        </div>
      `;
    }
    
    const diaCard = document.createElement('div');
    diaCard.className = 'dia-card';
    diaCard.innerHTML = `
      <div class="dia-header" onclick="toggleDia('${dia}')">
        <div class="dia-nombre">
          <span>📅</span> ${nombresDias[dia]}
        </div>
        <div class="dia-gasto">💰 $${gastoDia}</div>
      </div>
      <div class="dia-contenido ${estaAbierto ? 'activo' : ''}">
        <div class="comidas-grid">
          ${comidasHTML}
        </div>
      </div>
    `;
    container.appendChild(diaCard);
  }
  
  actualizarPresupuesto();
}

function abrirModalRecetas(dia, comida) {
  diaActual = dia;
  comidaActual = comida;
  const modal = document.getElementById('modal-recetas');
  const searchInput = document.getElementById('modal-search-input');
  if (modal) {
    modal.classList.add('active');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
      renderizarModalRecetas(todasLasRecetas);
      searchInput.oninput = (e) => {
        const busqueda = e.target.value.toLowerCase();
        const filtradas = todasLasRecetas.filter(r => 
          r.titulo.toLowerCase().includes(busqueda) ||
          (r.ingredientes && r.ingredientes.toLowerCase().includes(busqueda))
        );
        renderizarModalRecetas(filtradas);
      };
    }
  }
}

function cerrarModalRecetas() {
  const modal = document.getElementById('modal-recetas');
  if (modal) modal.classList.remove('active');
  diaActual = null;
  comidaActual = null;
}

function renderizarModalRecetas(recetas) {
  const container = document.getElementById('modal-recetas-list');
  if (!container) return;
  if (recetas.length === 0) {
    container.innerHTML = '<div class="vacio-recetas">No hay recetas disponibles</div>';
    return;
  }
  container.innerHTML = recetas.map(receta => {
    const precioNum = receta.precio_numerico || parseInt(String(receta.precio).replace(/[^0-9]/g, '')) || 0;
    return `
      <div class="modal-receta-item" onclick="seleccionarReceta(${receta.id})">
        <div class="modal-receta-info">
          <h4>${escapeHTML(receta.titulo)}</h4>
          <p>💰 ${escapeHTML(receta.precio || '$$')} | ⏱️ ${escapeHTML(receta.tiempo || '30min')}</p>
        </div>
        <div class="modal-receta-precio">$${precioNum}</div>
      </div>
    `;
  }).join('');
}

function seleccionarReceta(id) {
  const receta = todasLasRecetas.find(r => r.id === id);
  if (receta && diaActual && comidaActual) {
    agregarReceta(diaActual, comidaActual, receta);
    cerrarModalRecetas();
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function cargarRecetas() {
  try {
    const res = await fetch(`${API}/api/recipes`);
    if (res.ok) {
      todasLasRecetas = await res.json();
      renderizarModalRecetas(todasLasRecetas);
    }
  } catch (err) {
    console.error('Error cargando recetas:', err);
  }
}

function initDarkMode() {
  const savedDark = localStorage.getItem('darkMode') === 'true';
  if (savedDark) {
    document.body.classList.add('dark-mode');
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) darkToggle.checked = true;
  }
}

function init() {
  initDarkMode();
  cargarPlanDesdeLocalStorage();
  cargarRecetas();
  renderizarPlanificador();
  
  const presupuestoInput = document.getElementById('presupuesto-input');
  if (presupuestoInput) {
    presupuestoInput.addEventListener('change', (e) => {
      presupuesto = parseInt(e.target.value) || 0;
      guardarPlanEnLocalStorage();
      actualizarPresupuesto();
    });
  }
  
  const vaciarBtn = document.getElementById('vaciar-plan-btn');
  if (vaciarBtn) vaciarBtn.addEventListener('click', vaciarPlan);
  
  const exportarBtn = document.getElementById('exportar-plan-btn');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarPlan);
  
  const listaComprasBtn = document.getElementById('lista-compras-btn');
  if (listaComprasBtn) {
    listaComprasBtn.addEventListener('click', () => {
      window.location.href = 'lista-compras.html';
    });
  }
  
  const modalClose = document.querySelector('.modal-close');
  if (modalClose) modalClose.addEventListener('click', cerrarModalRecetas);
  
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-recetas');
    if (e.target === modal) cerrarModalRecetas();
  });
}

window.eliminarReceta = eliminarReceta;
window.agregarReceta = agregarReceta;
window.abrirModalRecetas = abrirModalRecetas;
window.cerrarModalRecetas = cerrarModalRecetas;
window.seleccionarReceta = seleccionarReceta;
window.toggleDia = toggleDia;

init();