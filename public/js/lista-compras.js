const API = 'http://localhost:3000';
let itemsCompra = [];

let categorias = {
  'Abarrotes': ['arroz', 'pasta', 'frijol', 'lenteja', 'harina', 'azucar', 'sal', 'aceite', 'pan', 'maiz', 'trigo', 'cereal', 'galleta', 'sopa', 'fideos', 'espagueti', 'garbanzo'],
  'Lacteos': ['leche', 'crema', 'queso', 'mantequilla', 'yogur', 'requeson', 'yoghurt', 'mantequilla', 'media crema'],
  'Verduras': ['cebolla', 'ajo', 'papa', 'tomate', 'lechuga', 'zanahoria', 'brocoli', 'espinaca', 'cilantro', 'perejil', 'chile', 'jitomate', 'calabaza', 'elote'],
  'Frutas': ['manzana', 'platano', 'naranja', 'fresa', 'uva', 'pera', 'mango', 'piña', 'sandia', 'melon', 'kiwi', 'papaya'],
  'Carnes': ['pollo', 'res', 'cerdo', 'pescado', 'atun', 'salchicha', 'huevo', 'carne', 'salmon', 'camaron', 'tocino', 'jamón'],
  'Otros': []
};

function extraerCantidad(nombreIngrediente) {
  const regex = /^(\d+(?:\.\d+)?(?:\s*(?:g|kg|ml|l|taza|cucharada|cucharadita|unidad|pieza|pizca|cdita|cdta|cda|gr|kilo|litro))?)\s+(.+)$/i;
  const match = nombreIngrediente.match(regex);
  if (match) {
    return { cantidad: match[1].trim(), nombre: match[2].trim() };
  }
  return { cantidad: '', nombre: nombreIngrediente.trim() };
}

function combinarCantidades(cant1, cant2) {
  if (!cant1 && !cant2) return '';
  if (!cant1) return cant2;
  if (!cant2) return cant1;
  
  const num1 = parseFloat(cant1);
  const num2 = parseFloat(cant2);
  const unidad1 = cant1.match(/[a-z]+$/i)?.[0] || '';
  const unidad2 = cant2.match(/[a-z]+$/i)?.[0] || '';
  
  if (!isNaN(num1) && !isNaN(num2)) {
    if (unidad1 === unidad2 || (unidad1 && unidad2 && unidad1 === unidad2)) {
      return (num1 + num2) + (unidad1 || '');
    }
  }
  return `${cant1} + ${cant2}`;
}

function obtenerCategoria(ingrediente) {
  const lower = ingrediente.toLowerCase();
  for (const [categoria, palabras] of Object.entries(categorias)) {
    for (const palabra of palabras) {
      if (lower.includes(palabra)) {
        return categoria;
      }
    }
  }
  return 'Otros';
}

function cargarPlanDesdeLocalStorage() {
  const guardado = localStorage.getItem('planSemanal');
  if (guardado) {
    return JSON.parse(guardado);
  }
  return null;
}

function generarListaCompras() {
  const plan = cargarPlanDesdeLocalStorage();
  if (!plan) return [];
  
  const ingredientesMap = new Map();
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const comidas = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];
  
  for (const dia of dias) {
    if (!plan[dia]) continue;
    for (const comida of comidas) {
      let recetas = plan[dia][comida];
      
      if (recetas && !Array.isArray(recetas)) {
        recetas = [recetas];
      }
      
      if (recetas && Array.isArray(recetas)) {
        for (const receta of recetas) {
          if (receta && receta.ingredientes) {
            const items = receta.ingredientes.split(',').map(i => i.trim()).filter(i => i);
            for (const item of items) {
              const key = item.toLowerCase().replace(/[0-9]/g, '').replace(/[^a-záéíóúñ]/g, '').trim();
              const { cantidad, nombre } = extraerCantidad(item);
              
              if (ingredientesMap.has(key)) {
                const existente = ingredientesMap.get(key);
                existente.cantidad = combinarCantidades(existente.cantidad, cantidad);
                existente.count++;
                if (!existente.recetas.includes(receta.titulo)) {
                  existente.recetas.push(receta.titulo);
                }
              } else {
                ingredientesMap.set(key, {
                  original: item,
                  nombre: nombre,
                  cantidad: cantidad,
                  count: 1,
                  categoria: obtenerCategoria(nombre),
                  recetas: [receta.titulo]
                });
              }
            }
          }
        }
      }
    }
  }
  
  const items = Array.from(ingredientesMap.values()).map((item, index) => ({
    id: Date.now() + index + Math.random() * 10000,
    nombre: item.nombre,
    cantidad: item.cantidad,
    original: item.original,
    completado: false,
    categoria: item.categoria,
    recetas: item.recetas,
    manual: false
  }));
  
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function guardarItemsEnLocalStorage() {
  localStorage.setItem('listaComprasItems', JSON.stringify(itemsCompra));
}

function cargarItemsDesdeLocalStorage() {
  const guardado = localStorage.getItem('listaComprasItems');
  if (guardado && JSON.parse(guardado).length > 0) {
    itemsCompra = JSON.parse(guardado);
  } else {
    itemsCompra = generarListaCompras();
    guardarItemsEnLocalStorage();
  }
}

function actualizarDesdePlanificador() {
  console.log('Actualizando lista desde planificador...');
  const nuevosItems = generarListaCompras();
  
  const nuevosItemsMap = new Map();
  for (const item of nuevosItems) {
    nuevosItemsMap.set(item.nombre.toLowerCase(), item);
  }
  
  for (const item of itemsCompra) {
    if (!item.manual && nuevosItemsMap.has(item.nombre.toLowerCase())) {
      const nuevoItem = nuevosItemsMap.get(item.nombre.toLowerCase());
      nuevoItem.completado = item.completado;
      nuevosItemsMap.set(item.nombre.toLowerCase(), nuevoItem);
    } else if (!item.manual) {
      nuevosItemsMap.set(item.nombre.toLowerCase(), { ...item, completado: item.completado });
    } else if (item.manual) {
      nuevosItemsMap.set(`manual_${item.id}`, item);
    }
  }
  
  itemsCompra = Array.from(nuevosItemsMap.values());
  guardarItemsEnLocalStorage();
  renderizarLista();
  actualizarProgreso();
}

function toggleCompletado(id) {
  const item = itemsCompra.find(i => i.id === id);
  if (item) {
    item.completado = !item.completado;
    guardarItemsEnLocalStorage();
    renderizarLista();
    actualizarProgreso();
  }
}

function editarCantidad(id) {
  const item = itemsCompra.find(i => i.id === id);
  if (!item) return;
  const nuevaCantidad = prompt('Editar cantidad (ej: 200g, 1kg, 2 piezas):', item.cantidad || '');
  if (nuevaCantidad !== null) {
    item.cantidad = nuevaCantidad;
    guardarItemsEnLocalStorage();
    renderizarLista();
    mostrarNotificacion('Cantidad actualizada');
  }
}

function agregarProductoManual() {
  const nombre = prompt('Nombre del producto:');
  if (!nombre || nombre.trim() === '') return;
  
  const cantidad = prompt('Cantidad (opcional, ej: 200g, 1kg, 2 piezas):');
  const nuevoItem = {
    id: Date.now(),
    nombre: nombre.trim(),
    cantidad: cantidad || '',
    original: nombre.trim(),
    completado: false,
    categoria: obtenerCategoria(nombre),
    manual: true,
    recetas: ['Manual']
  };
  itemsCompra.push(nuevoItem);
  guardarItemsEnLocalStorage();
  renderizarLista();
  mostrarNotificacion(`"${nombre}" agregado a la lista`);
}

function eliminarProductoManual(id) {
  if (confirm('¿Eliminar este producto de la lista?')) {
    itemsCompra = itemsCompra.filter(i => i.id !== id);
    guardarItemsEnLocalStorage();
    renderizarLista();
    mostrarNotificacion('Producto eliminado');
  }
}

function actualizarProgreso() {
  const total = itemsCompra.length;
  const completados = itemsCompra.filter(item => item.completado).length;
  const porcentaje = total > 0 ? (completados / total) * 100 : 0;
  
  const textoProgreso = document.getElementById('progreso-texto');
  const fillProgreso = document.getElementById('progreso-fill');
  
  if (textoProgreso) textoProgreso.textContent = `${completados} de ${total} completados`;
  if (fillProgreso) fillProgreso.style.width = `${porcentaje}%`;
}

function exportarLista() {
  const completados = itemsCompra.filter(item => item.completado).length;
  const total = itemsCompra.length;
  let texto = `🛒 LISTA DE COMPRAS\n`;
  texto += `📅 ${new Date().toLocaleDateString()}\n`;
  texto += `✅ ${completados} de ${total} completados\n`;
  texto += '='.repeat(50) + '\n\n';
  
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  }
  
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      texto += `\n📦 ${categoria.toUpperCase()}\n`;
      texto += '-'.repeat(30) + '\n';
      for (const item of items) {
        const check = item.completado ? '✓' : '○';
        texto += `${check} ${item.nombre}${item.cantidad ? ` - ${item.cantidad}` : ''}\n`;
      }
    }
  }
  
  const blob = new Blob([texto], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compras-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarNotificacion('Lista exportada');
}

async function compartirLista() {
  const completados = itemsCompra.filter(item => item.completado).length;
  const total = itemsCompra.length;
  let texto = `🛒 LISTA DE COMPRAS\n${completados} de ${total} completados\n\n`;
  
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  }
  
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      texto += `\n${categoria}:\n`;
      for (const item of items) {
        const check = item.completado ? '✓' : '○';
        texto += `${check} ${item.nombre}${item.cantidad ? ` - ${item.cantidad}` : ''}\n`;
      }
    }
  }
  
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Mi lista de compras', text: texto });
      mostrarNotificacion('Lista compartida');
    } catch (err) {
      copiarAlPortapapeles(texto);
    }
  } else {
    copiarAlPortapapeles(texto);
  }
}

function copiarAlPortapapeles(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    mostrarNotificacion('Lista copiada al portapapeles');
  }).catch(() => {
    mostrarNotificacion('No se pudo copiar', true);
  });
}

function mostrarNotificacion(mensaje, esError = false) {
  const notif = document.createElement('div');
  notif.className = 'notification-toast';
  notif.textContent = mensaje;
  notif.style.background = esError ? '#ff5252' : '#4caf50';
  document.body.appendChild(notif);
  setTimeout(() => notif.classList.add('show'), 10);
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderizarLista() {
  const container = document.getElementById('lista-contenido');
  if (!container) return;
  
  if (itemsCompra.length === 0) {
    container.innerHTML = `
      <div class="vacio-mensaje">
        <span>🛒</span>
        <p>Tu lista de compras está vacía</p>
        <small>Agrega recetas desde el planificador semanal</small>
        <button class="btn-agregar-manual" id="agregar-manual-btn">+ Agregar producto manual</button>
        <button class="btn-sincronizar" id="sincronizar-btn" style="margin-top:10px;">🔄 Sincronizar con planificador</button>
      </div>
    `;
    const agregarBtn = document.getElementById('agregar-manual-btn');
    const sincronizarBtn = document.getElementById('sincronizar-btn');
    if (agregarBtn) agregarBtn.addEventListener('click', agregarProductoManual);
    if (sincronizarBtn) sincronizarBtn.addEventListener('click', () => {
      actualizarDesdePlanificador();
      mostrarNotificacion('Lista sincronizada con el planificador');
    });
    actualizarProgreso();
    return;
  }
  
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  }
  
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  let html = `
    <div class="lista-header-actions">
      <button class="btn-agregar-manual" id="agregar-manual-btn">+ Agregar producto manual</button>
      <button class="btn-sincronizar" id="sincronizar-btn">🔄 Sincronizar con planificador</button>
    </div>
  `;
  
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      const icono = categoria === 'Abarrotes' ? '🛒' : categoria === 'Lacteos' ? '🥛' : categoria === 'Verduras' ? '🥬' : categoria === 'Frutas' ? '🍎' : categoria === 'Carnes' ? '🍗' : '📦';
      html += `
        <div class="categoria-grupo">
          <div class="categoria-titulo">
            <span>${icono}</span> ${categoria}
          </div>
          <ul class="items-lista">
      `;
      for (const item of items) {
        html += `
          <li class="item-compra ${item.completado ? 'completado' : ''}" data-id="${item.id}">
            <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${item.completado ? 'checked' : ''}>
            <div class="item-contenido">
              <div class="item-nombre">${escapeHTML(item.nombre)}</div>
              ${item.cantidad ? `<div class="item-cantidad">📦 ${escapeHTML(item.cantidad)}</div>` : ''}
              ${item.recetas && item.recetas.length > 0 && !item.manual ? `<div class="item-recetas">📖 ${escapeHTML(item.recetas.slice(0, 2).join(', '))}${item.recetas.length > 2 ? ` +${item.recetas.length - 2}` : ''}</div>` : ''}
            </div>
            <div class="item-acciones">
              <button class="btn-editar-cantidad" data-id="${item.id}" title="Editar cantidad">✏️</button>
              ${item.manual ? `<button class="btn-eliminar-item" data-id="${item.id}" title="Eliminar">🗑️</button>` : ''}
            </div>
          </li>
        `;
      }
      html += `</ul></div>`;
    }
  }
  
  container.innerHTML = html;
  
  document.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = parseFloat(cb.dataset.id);
      toggleCompletado(id);
    });
  });
  
  document.querySelectorAll('.btn-editar-cantidad').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseFloat(btn.dataset.id);
      editarCantidad(id);
    });
  });
  
  document.querySelectorAll('.btn-eliminar-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseFloat(btn.dataset.id);
      eliminarProductoManual(id);
    });
  });
  
  const agregarBtn = document.getElementById('agregar-manual-btn');
  const sincronizarBtn = document.getElementById('sincronizar-btn');
  if (agregarBtn) agregarBtn.addEventListener('click', agregarProductoManual);
  if (sincronizarBtn) sincronizarBtn.addEventListener('click', () => {
    actualizarDesdePlanificador();
    mostrarNotificacion('Lista sincronizada con el planificador');
  });
  
  actualizarProgreso();
}

function initStorageListener() {
  window.addEventListener('storage', (e) => {
    if (e.key === 'planSemanal') {
      console.log('planSemanal cambiado, actualizando lista...');
      actualizarDesdePlanificador();
    }
  });
  
  setInterval(() => {
    const planActual = localStorage.getItem('planSemanal');
    const planAnterior = this.ultimoPlan;
    if (planActual !== planAnterior) {
      this.ultimoPlan = planActual;
      actualizarDesdePlanificador();
    }
  }, 2000);
}

function init() {
  cargarItemsDesdeLocalStorage();
  renderizarLista();
  initStorageListener();
  
  const exportarBtn = document.getElementById('exportar-btn');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarLista);
  
  const compartirBtn = document.getElementById('compartir-btn');
  if (compartirBtn) compartirBtn.addEventListener('click', compartirLista);
}

init();