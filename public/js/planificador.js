// planificador.js - Planificador semanal con Supabase
import { supabase } from './supabaseClient.js';

// Estado
let todasLasRecetas = [];
let planSemanal = {};
let diasAbiertos = {};
let presupuesto = 500;
let currentUser = null;

const diasLista = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const comidasLista = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];
const nombresDias = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const nombresComidas = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', merienda: 'Merienda', snack: 'Snack' };
const iconosComidas = { desayuno: '🥐', comida: '🍲', cena: '🍜', merienda: '🍎', snack: '🍿' };

// Estado para modal
let diaActual = null;
let comidaActual = null;

// Inicializar plan semanal vacío
function initPlanSemanal() {
  const plan = {};
  for (const dia of diasLista) {
    plan[dia] = {};
    for (const comida of comidasLista) {
      plan[dia][comida] = [];
    }
  }
  return plan;
}

// Cargar usuario actual (usa datos de localStorage, sin RLS)
async function cargarUsuario() {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  if (userId && token) {
    currentUser = {
      id: userId,
      es_premium: localStorage.getItem('userPremium') === 'true',
      puntos: parseInt(localStorage.getItem('userPuntos') || 0),
      username: localStorage.getItem('userName')
    };
  }
}

// Cargar plan desde Supabase
async function cargarPlanDesdeSupabase() {
  if (!currentUser) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/users/me/planner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar plan');
    
    const data = await response.json();
    if (data && data.plan) {
      planSemanal = data.plan;
    } else {
      planSemanal = initPlanSemanal();
    }
  } catch (error) {
    console.error('Error al cargar plan:', error);
    planSemanal = initPlanSemanal();
  }
  
  // Cargar días abiertos desde localStorage (preferencia UI)
  const abiertosGuardados = localStorage.getItem('diasAbiertos');
  if (abiertosGuardados) {
    diasAbiertos = JSON.parse(abiertosGuardados);
  } else {
    for (const dia of diasLista) {
      diasAbiertos[dia] = dia === 'lunes';
    }
  }
  
  // Cargar presupuesto
  const presupuestoGuardado = localStorage.getItem('presupuesto');
  if (presupuestoGuardado) {
    presupuesto = parseInt(presupuestoGuardado);
    const presupuestoInput = document.getElementById('presupuesto-input');
    if (presupuestoInput) presupuestoInput.value = presupuesto;
  }
}

// Guardar plan en Supabase
async function guardarPlanEnSupabase() {
  if (!currentUser) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/users/me/planner', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan: planSemanal })
    });
    
    if (!response.ok) throw new Error('Error al guardar plan');
    
    mostrarNotificacion('Plan guardado. La lista de compras se sincronizará automáticamente.', false);
  } catch (error) {
    console.error('Error al guardar plan:', error);
    mostrarNotificacion('Error al guardar el plan', true);
  }
}

// Alternar día abierto/cerrado
function toggleDia(dia) {
  diasAbiertos[dia] = !diasAbiertos[dia];
  guardarPreferenciasUI();
  renderizarPlanificador();
}

// Guardar preferencias UI
function guardarPreferenciasUI() {
  localStorage.setItem('diasAbiertos', JSON.stringify(diasAbiertos));
  localStorage.setItem('presupuesto', presupuesto);
}

// Calcular gastos
function calcularGastoTotal() {
  let total = 0;
  for (const dia of diasLista) {
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia]?.[comida] || [];
      recetas.forEach(receta => {
        total += receta.precio_numerico || 0;
      });
    }
  }
  return total;
}

function calcularGastoDia(dia) {
  let total = 0;
  for (const comida of comidasLista) {
    const recetas = planSemanal[dia]?.[comida] || [];
    recetas.forEach(receta => {
      total += receta.precio_numerico || 0;
    });
  }
  return total;
}

function calcularGastoComida(dia, comida) {
  let total = 0;
  const recetas = planSemanal[dia]?.[comida] || [];
  recetas.forEach(receta => {
    total += receta.precio_numerico || 0;
  });
  return total;
}

// Actualizar presupuesto en UI
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

// Mostrar notificación
function mostrarNotificacion(mensaje, esError = false) {
  let notif = document.getElementById('plan-notif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'plan-notif';
    notif.className = 'notification-toast';
    document.body.appendChild(notif);
  }
  notif.textContent = mensaje;
  notif.style.background = esError ? '#ff5252' : '#4caf50';
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}

// Cargar recetas desde el API
async function cargarRecetas() {
  try {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    // El API ya filtra por permisos si se le pide, pero para el planificador 
    // queremos ver todas las que el usuario puede planear (ignoramos filtros de dieta).
    const response = await fetch('/api/recipes?ignorePrefs=true', { headers });
    if (!response.ok) throw new Error('Error en API');
    
    todasLasRecetas = await response.json();
    renderizarModalRecetas(todasLasRecetas);
  } catch (err) {
    console.error('Error cargando recetas:', err);
    mostrarNotificacion('Error al cargar recetas para el planificador', true);
  }
}

// Renderizar modal de recetas
function renderizarModalRecetas(recetas) {
  const container = document.getElementById('modal-recetas-list');
  if (!container) return;
  
  if (recetas.length === 0) {
    container.innerHTML = '<div class="vacio-recetas">No hay recetas disponibles</div>';
    return;
  }
  
  container.innerHTML = recetas.map(receta => `
    <div class="modal-receta-item" data-id="${receta.id}">
      <div class="modal-receta-info">
        <h4>${escapeHTML(receta.titulo)}</h4>
        <p>💰 ${escapeHTML(receta.precio || '$$')} | ⏱️ ${escapeHTML(receta.tiempo || '30min')}</p>
      </div>
      <div class="modal-receta-precio">$${receta.precio_numerico || 0}</div>
    </div>
  `).join('');
  
  // Event listeners
  container.querySelectorAll('.modal-receta-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      const receta = todasLasRecetas.find(r => r.id === id);
      if (receta && diaActual && comidaActual) {
        agregarReceta(diaActual, comidaActual, receta);
        cerrarModalRecetas();
      }
    });
  });
}

// Filtrar recetas en modal
function setupModalSearch() {
  const searchInput = document.getElementById('modal-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const busqueda = e.target.value.toLowerCase();
      const filtradas = todasLasRecetas.filter(r => 
        r.titulo.toLowerCase().includes(busqueda) ||
        (r.ingredientes && r.ingredientes.toLowerCase().includes(busqueda))
      );
      renderizarModalRecetas(filtradas);
    });
  }
}

// Abrir modal
function abrirModalRecetas(dia, comida) {
  diaActual = dia;
  comidaActual = comida;
  const modal = document.getElementById('modal-recetas');
  const searchInput = document.getElementById('modal-search-input');
  if (modal) {
    modal.classList.add('active');
    if (searchInput) {
      searchInput.value = '';
      renderizarModalRecetas(todasLasRecetas);
      searchInput.focus();
    }
  }
}

// Cerrar modal
function cerrarModalRecetas() {
  const modal = document.getElementById('modal-recetas');
  if (modal) modal.classList.remove('active');
  diaActual = null;
  comidaActual = null;
}

// Agregar receta al plan
async function agregarReceta(dia, comida, receta) {
  if (!planSemanal[dia][comida]) {
    planSemanal[dia][comida] = [];
  }
  
  // Verificar duplicados
  const yaExiste = planSemanal[dia][comida].some(r => r.id === receta.id);
  if (yaExiste) {
    mostrarNotificacion('Esta receta ya está agregada', true);
    return;
  }
  
  planSemanal[dia][comida].push(receta);
  await guardarPlanEnSupabase();
  renderizarPlanificador();
  actualizarPresupuesto();
}

// Eliminar receta del plan
async function eliminarReceta(dia, comida, index) {
  if (confirm('¿Eliminar esta receta del plan?')) {
    if (!planSemanal[dia]) planSemanal[dia] = {};
    if (!planSemanal[dia][comida]) planSemanal[dia][comida] = [];
    
    planSemanal[dia][comida].splice(index, 1);
    await guardarPlanEnSupabase();
    renderizarPlanificador();
    actualizarPresupuesto();
  }
}

// Función auxiliar para manejar el agregado desde URL
async function manejarAgregadoDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const agregarId = params.get('agregar');
  
  if (agregarId) {
    try {
      const id = parseInt(agregarId);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/recipes/${id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const receta = await res.json();
        // Por defecto lo agregamos al Lunes - Comida si viene de URL
        // o abrimos el modal para que el usuario elija
        diaActual = 'lunes';
        comidaActual = 'comida';
        await agregarReceta(diaActual, comidaActual, receta);
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        mostrarNotificacion(`Receta "${receta.titulo}" agregada al Lunes`);
      }
    } catch (e) {
      console.error('Error agregando desde URL:', e);
    }
  }
}

// Exportar a PDF usando jsPDF
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  
  const pdfContent = document.createElement('div');
  pdfContent.style.padding = '20px';
  pdfContent.style.fontFamily = 'Arial, sans-serif';
  pdfContent.style.backgroundColor = 'white';
  
  let html = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #2e7d32;">📅 Plan Semanal de Comidas</h1>
      <p style="color: #666;">Fecha: ${new Date().toLocaleDateString()}</p>
      <p style="color: #666;">Presupuesto: $${presupuesto} | Gasto total: $${calcularGastoTotal()} | Restante: $${presupuesto - calcularGastoTotal()}</p>
    </div>
  `;
  
  for (const dia of diasLista) {
    const gastoDia = calcularGastoDia(dia);
    html += `
      <div style="margin-bottom: 25px; page-break-inside: avoid;">
        <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 12px 16px; border-radius: 12px; margin-bottom: 12px;">
          <h2 style="color: #2e7d32; margin: 0;">📌 ${nombresDias[dia]} - Gasto: $${gastoDia}</h2>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
    `;
    
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia][comida] || [];
      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; width: 120px; vertical-align: top;">
            <strong>${iconosComidas[comida]} ${nombresComidas[comida]}</strong>
          </td>
          <td style="padding: 10px;">
      `;
      
      if (recetas.length === 0) {
        html += '<span style="color: #999;">Sin recetas</span>';
      } else {
        recetas.forEach(receta => {
          html += `<div style="margin-bottom: 8px;">• <strong>${escapeHTML(receta.titulo)}</strong> - ${receta.precio || '$$'}</div>`;
        });
      }
      
      html += `</td></tr>`;
    }
    
    html += `</table></div>`;
  }
  
  pdfContent.innerHTML = html;
  document.body.appendChild(pdfContent);
  
  try {
    const canvas = await html2canvas(pdfContent, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`plan-semanal-${new Date().toISOString().slice(0, 10)}.pdf`);
    mostrarNotificacion('PDF generado correctamente');
  } catch (error) {
    console.error('Error al generar PDF:', error);
    mostrarNotificacion('Error al generar PDF', true);
  } finally {
    document.body.removeChild(pdfContent);
  }
}

// Renderizar planificador completo
function renderizarPlanificador() {
  const container = document.getElementById('dias-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (const dia of diasLista) {
    const gastoDia = calcularGastoDia(dia);
    const estaAbierto = diasAbiertos[dia] === true;
    
    let comidasHTML = '';
    for (const comida of comidasLista) {
      const recetas = planSemanal[dia]?.[comida] || [];
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
            <button class="btn-eliminar" onclick="window.eliminarReceta('${dia}', '${comida}', ${idx})">✖</button>
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
          <button class="btn-agregar" onclick="window.abrirModalRecetas('${dia}', '${comida}')">
            <span>+</span> Agregar receta
          </button>
        </div>
      `;
    }
    
    const diaCard = document.createElement('div');
    diaCard.className = 'dia-card';
    diaCard.innerHTML = `
      <div class="dia-header" onclick="window.toggleDia('${dia}')">
        <div class="dia-nombre">
          <span>📅</span> ${nombresDias[dia]}
        </div>
        <div class="dia-gasto">💰 $${gastoDia}</div>
      </div>
      <div class="dia-contenido ${estaAbierto ? 'activo' : ''}">
        <div class="comidas-grid">${comidasHTML}</div>
      </div>
    `;
    container.appendChild(diaCard);
  }
  
  actualizarPresupuesto();
}

// Escapar HTML
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Ir a lista de compras
function irAListaCompras() {
  window.location.href = 'lista-compras.html';
}

// Inicializar
async function init() {
  await cargarUsuario();
  await cargarPlanDesdeSupabase();
  await cargarRecetas();
  
  // Manejar si viene de la página de receta
  await manejarAgregadoDesdeURL();
  
  renderizarPlanificador();
  setupModalSearch();
  
  // Event listeners
  const presupuestoInput = document.getElementById('presupuesto-input');
  if (presupuestoInput) {
    presupuestoInput.addEventListener('change', (e) => {
      presupuesto = parseInt(e.target.value) || 0;
      guardarPreferenciasUI();
      actualizarPresupuesto();
    });
  }
  
  const exportarBtn = document.getElementById('exportar-pdf-btn');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarPDF);
  
  const listaComprasBtn = document.getElementById('lista-compras-btn');
  if (listaComprasBtn) listaComprasBtn.addEventListener('click', irAListaCompras);
  
  const modalClose = document.querySelector('.modal-close');
  if (modalClose) modalClose.addEventListener('click', cerrarModalRecetas);
  
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-recetas');
    if (e.target === modal) cerrarModalRecetas();
  });
}

// Exponer funciones globalmente
window.toggleDia = toggleDia;
window.eliminarReceta = eliminarReceta;
window.abrirModalRecetas = abrirModalRecetas;
window.cerrarModalRecetas = cerrarModalRecetas;

init();