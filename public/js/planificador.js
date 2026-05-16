// planificador.js
import { supabase } from './supabaseClient.js';

let todasLasRecetas = [];
let planSemanal = {};
let diasAbiertos = {};
let presupuesto = 500;
let currentUser = null;

const diasLista = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const comidasLista = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];
const nombresDias = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const nombresComidas = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', merienda: 'Merienda', snack: 'Snack' };
const iconosComidas = { desayuno: 'croissant', comida: 'utensils', cena: 'bowl-soup', merienda: 'apple', snack: 'popcorn' };

let diaActual = null;
let comidaActual = null;

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

async function cargarPlanDesdeSupabase() {
  if (!currentUser) return;

  const cached = localStorage.getItem('user_plan_cache');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        planSemanal = parsed;
        console.log('⚡ Cargado desde cache local');
      }
    } catch (e) { }
  }

  // 2. Si lo local está vacío, intentar cargar del servidor
  if (!planSemanal || Object.keys(planSemanal).length === 0) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me/planner', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.plan && Object.keys(data.plan).length > 0) {
          planSemanal = data.plan;
          localStorage.setItem('user_plan_cache', JSON.stringify(planSemanal));
          renderizarPlanificador();
        }
      }
    } catch (error) {
      console.error('Error al cargar plan del servidor:', error);
    }
  }

  // 3. Garantizar estructura mínima
  if (!planSemanal || Object.keys(planSemanal).length === 0) {
    planSemanal = initPlanSemanal();
  }



  // Cargar estado de días abiertos (preferencia UI)
  const abiertosGuardados = localStorage.getItem('diasAbiertos');
  if (abiertosGuardados) {
    diasAbiertos = JSON.parse(abiertosGuardados);
  } else {
    for (const dia of diasLista) {
      diasAbiertos[dia] = dia === 'lunes';
    }
  }

  // Cargar presupuesto guardado
  const presupuestoGuardado = localStorage.getItem('presupuesto');
  if (presupuestoGuardado) {
    presupuesto = parseInt(presupuestoGuardado);
    const presupuestoInput = document.getElementById('presupuesto-input');
    if (presupuestoInput) presupuestoInput.value = presupuesto;
  }
}

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

    // Actualizar cache local con el plan más reciente
    localStorage.setItem('user_plan_cache', JSON.stringify(planSemanal));
    mostrarNotificacion('Plan actualizado. La lista de compras se sincronizó.', false);
  } catch (error) {
    console.error('Error al guardar plan:', error);
    mostrarNotificacion('Error al guardar el plan', true);
  }
}

function toggleDia(dia) {
  diasAbiertos[dia] = !diasAbiertos[dia];
  guardarPreferenciasUI();
  renderizarPlanificador();
}

function guardarPreferenciasUI() {
  localStorage.setItem('diasAbiertos', JSON.stringify(diasAbiertos));
  localStorage.setItem('presupuesto', presupuesto);
}

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

function actualizarPresupuesto() {
  const total = calcularGastoTotal();
  const restante = presupuesto - total;
  const gastoTotalElem = document.getElementById('gasto-total');
  const restanteElem = document.getElementById('restante');

  if (gastoTotalElem) gastoTotalElem.textContent = `$${total}`;
  if (restanteElem) {
    restanteElem.textContent = `$${restante}`;
    restanteElem.style.color = restante < 0 ? '#e53935' : restante < 100 ? '#F2CC8F' : '#E07A5F';
  }
}

function mostrarNotificacion(mensaje, esError = false) {
  let notif = document.getElementById('plan-notif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'plan-notif';
    notif.className = 'notification-toast';
    document.body.appendChild(notif);
  }
  notif.textContent = mensaje;
  notif.style.background = esError ? '#e53935' : '#E07A5F';
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}

async function cargarRecetas() {
  try {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/recipes?ignorePrefs=true', { headers });
    if (!response.ok) throw new Error('Error en API');

    todasLasRecetas = await response.json();
    renderizarModalRecetas(todasLasRecetas);
  } catch (err) {
    console.error('Error cargando recetas:', err);
    mostrarNotificacion('Error al cargar recetas para el planificador', true);
  }
}

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
        <p><i data-lucide="dollar-sign"></i> ${escapeHTML(receta.precio || '$$')} | <i data-lucide="clock"></i> ${escapeHTML(receta.tiempo || '30min')}</p>
      </div>
      <div class="modal-receta-precio">$${receta.precio_numerico || 0}</div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

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

function cerrarModalRecetas() {
  const modal = document.getElementById('modal-recetas');
  if (modal) modal.classList.remove('active');
  diaActual = null;
  comidaActual = null;
}

async function agregarReceta(dia, comida, receta) {
  // 1. Asegurar estructura
  if (!planSemanal[dia]) planSemanal[dia] = {};
  if (!planSemanal[dia][comida]) planSemanal[dia][comida] = [];

  // 2. Agregar con ID único para permitir recetas ilimitadas
  const nuevaInstancia = { ...receta, instanceId: Date.now() + Math.random() };
  planSemanal[dia][comida].push(nuevaInstancia);

  // 3. GUARDADO LOCAL INMEDIATO (Vital para persistencia al cambiar de pantalla)
  localStorage.setItem('user_plan_cache', JSON.stringify(planSemanal));

  // 4. Actualizar Interfaz
  renderizarPlanificador();
  actualizarPresupuesto();

  // 5. Sincronizar con servidor en segundo plano (SIN BLOQUEAR)
  guardarPlanEnSupabase().catch(e => console.error('Error sincronizando:', e));
}



async function eliminarReceta(dia, comida, index) {
  if (confirm('¿Eliminar esta receta del plan?')) {
    if (!planSemanal[dia]) planSemanal[dia] = {};
    if (!planSemanal[dia][comida]) planSemanal[dia][comida] = [];

    planSemanal[dia][comida].splice(index, 1);

    // Guardado local inmediato
    localStorage.setItem('user_plan_cache', JSON.stringify(planSemanal));

    renderizarPlanificador();
    actualizarPresupuesto();

    try {
      await guardarPlanEnSupabase();
    } catch (e) {
      console.error('Error sincronizando al eliminar:', e);
    }
  }
}


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
        diaActual = 'lunes';
        comidaActual = 'comida';
        await agregarReceta(diaActual, comidaActual, receta);

        window.history.replaceState({}, document.title, window.location.pathname);
        mostrarNotificacion(`Receta "${receta.titulo}" agregada al Lunes`);
      }
    } catch (e) {
      console.error('Error agregando desde URL:', e);
    }
  }
}

async function exportarPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    mostrarNotificacion('Librería PDF no cargada. Intenta de nuevo.', true);
    return;
  }

  mostrarNotificacion('Generando PDF...', false);

  const pdfContent = document.createElement('div');
  pdfContent.style.padding = '40px';
  pdfContent.style.fontFamily = 'Arial, sans-serif';
  pdfContent.style.backgroundColor = 'white';
  pdfContent.style.color = '#333';
  pdfContent.style.position = 'fixed';
  pdfContent.style.left = '-9999px';
  pdfContent.style.top = '0';
  pdfContent.style.width = '800px';

  let html = `
    <div style="text-align: center; margin-bottom: 30px; color: #333;">
      <h1 style="color: #D95D39; margin-bottom: 10px;">📅 Plan Semanal de Comidas</h1>
      <p style="color: #666; font-size: 14px;">Fecha: ${new Date().toLocaleDateString()}</p>
      <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px; font-weight: bold;">
        <span style="color: #666;">Presupuesto: $${presupuesto}</span>
        <span style="color: #D95D39;">Gasto: $${calcularGastoTotal()}</span>
        <span style="color: #E07A5F;">Restante: $${presupuesto - calcularGastoTotal()}</span>
      </div>
    </div>
  `;

  for (const dia of diasLista) {
    const gastoDia = calcularGastoDia(dia);
    html += `
      <div style="margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #FDFBF7; padding: 12px 16px; border-bottom: 2px solid #E07A5F;">
          <h2 style="color: #D95D39; margin: 0; font-size: 18px;">📌 ${nombresDias[dia]} - Gasto: $${gastoDia}</h2>
        </div>
        <table style="width: 100%; border-collapse: collapse; background: white;">
    `;

    for (const comida of comidasLista) {
      const recetas = planSemanal[dia][comida] || [];
      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; width: 100px; vertical-align: top; background-color: #fafafa;">
            <strong style="color: #E07A5F; font-size: 12px;">${nombresComidas[comida].toUpperCase()}</strong>
          </td>
          <td style="padding: 12px; color: #333;">
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
        recetasHTML = '<div class="vacio-recetas"><i data-lucide="inbox"></i> Sin recetas</div>';
      } else {
        recetasHTML = recetas.map((receta, idx) => `
          <div class="receta-item">
            <div class="receta-info">
              <h4>${escapeHTML(receta.titulo)}</h4>
              <div class="receta-meta">
                <span class="receta-precio"><i data-lucide="dollar-sign"></i> ${escapeHTML(receta.precio || '$$')}</span>
                <span class="receta-tiempo"><i data-lucide="clock"></i> ${escapeHTML(receta.tiempo || '30min')}</span>
              </div>
            </div>
            <button class="btn-eliminar" onclick="window.eliminarReceta('${dia}', '${comida}', ${idx})"><i data-lucide="trash-2"></i></button>
          </div>
        `).join('');
      }

      comidasHTML += `
        <div class="comida-card">
          <div class="comida-header">
            <span class="comida-icono"><i data-lucide="${iconosComidas[comida]}"></i></span>
            <span class="comida-titulo">${nombresComidas[comida]}</span>
            <span class="comida-gasto"><i data-lucide="dollar-sign"></i> $${gastoComida}</span>
          </div>
          <div class="recetas-lista">
            ${recetasHTML}
          </div>
          <button class="btn-agregar" onclick="window.abrirModalRecetas('${dia}', '${comida}')">
            <i data-lucide="plus"></i> Agregar receta
          </button>
        </div>
      `;
    }

    const diaCard = document.createElement('div');
    diaCard.className = 'dia-card';
    diaCard.innerHTML = `
      <div class="dia-header" onclick="window.toggleDia('${dia}')">
        <div class="dia-nombre">
          <i data-lucide="calendar"></i> ${nombresDias[dia]}
        </div>
        <div class="dia-gasto"><i data-lucide="dollar-sign"></i> $${gastoDia}</div>
      </div>
      <div class="dia-contenido ${estaAbierto ? 'activo' : ''}">
        <div class="comidas-grid">${comidasHTML}</div>
      </div>
    `;
    container.appendChild(diaCard);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
  actualizarPresupuesto();
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function irAListaCompras() {
  window.location.href = 'lista-compras.html';
}

async function init() {
  try {
    // 1. Cargar usuario primero
    await cargarUsuario();

    // 2. Preparar el terreno (Inicializar plan si no hay nada)
    planSemanal = initPlanSemanal();

    // 3. Cargar datos (Local + Server)
    await cargarPlanDesdeSupabase();

    // 4. Cargar recetas disponibles
    await cargarRecetas();

    // 5. Manejar si venimos de "Subir Receta"
    await manejarAgregadoDesdeURL();

    // 6. Dibujar todo
    renderizarPlanificador();
    setupModalSearch();

    // 7. Configurar eventos de botones fijos
    const presupuestoInput = document.getElementById('presupuesto-input');
    if (presupuestoInput) {
      presupuestoInput.value = presupuesto;
      presupuestoInput.addEventListener('change', (e) => {
        presupuesto = parseInt(e.target.value) || 0;
        guardarPreferenciasUI();
        actualizarPresupuesto();
      });
    }

    document.getElementById('exportar-pdf-btn')?.addEventListener('click', exportarPDF);
    document.getElementById('lista-compras-btn')?.addEventListener('click', irAListaCompras);
    document.querySelector('.modal-close')?.addEventListener('click', cerrarModalRecetas);

    window.addEventListener('click', (e) => {
      const modal = document.getElementById('modal-recetas');
      if (e.target === modal) cerrarModalRecetas();
    });

    console.log('🚀 Planificador inicializado correctamente');
  } catch (err) {
    console.error('Error crítico en init:', err);
  }
}


// Funciones globales
window.toggleDia = toggleDia;
window.eliminarReceta = eliminarReceta;
window.abrirModalRecetas = abrirModalRecetas;
window.cerrarModalRecetas = cerrarModalRecetas;

init();

// Lógica de ocultado automático de la navegación al scroll
(function () {
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
      nav.classList.add('nav-hidden');
    } else {
      nav.classList.remove('nav-hidden');
    }
    lastScrollY = window.scrollY;
  });
})();
