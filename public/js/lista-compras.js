const API = 'http://localhost:3000';
let todasLasRecetas = [];
let itemsCompra = [];
let categorias = {
  'Abarrotes': ['arroz', 'pasta', 'frijol', 'lenteja', 'harina', 'azucar', 'sal', 'aceite', 'pan'],
  'Lacteos': ['leche', 'crema', 'queso', 'mantequilla', 'yogur', 'requeson'],
  'Verduras': ['cebolla', 'ajo', 'papa', 'tomate', 'lechuga', 'zanahoria', 'brocoli', 'espinaca'],
  'Frutas': ['manzana', 'platano', 'naranja', 'fresa', 'uva', 'pera'],
  'Carnes': ['pollo', 'res', 'cerdo', 'pescado', 'atun', 'salchicha', 'huevo'],
  'Otros': []
};

function cargarPlanDesdeLocalStorage() {
  const guardado = localStorage.getItem('planSemanal');
  if (guardado) {
    return JSON.parse(guardado);
  }
  return null;
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

function normalizarIngrediente(ingrediente) {
  const matchCantidad = ingrediente.match(/^([\d\s\-\/]+)?\s*(.+)$/);
  if (matchCantidad) {
    const cantidad = matchCantidad[1] ? matchCantidad[1].trim() : '';
    const nombre = matchCantidad[2].trim();
    return { nombre, cantidad };
  }
  return { nombre: ingrediente, cantidad: '' };
}

function generarListaCompras() {
  const plan = cargarPlanDesdeLocalStorage();
  if (!plan) return [];
  const ingredientesMap = new Map();
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const comidas = ['desayuno', 'comida', 'cena'];
  for (const dia of dias) {
    for (const comida of comidas) {
      const receta = plan[dia]?.[comida];
      if (receta && receta.ingredientes) {
        const items = receta.ingredientes.split(',').map(i => i.trim()).filter(i => i);
        for (const item of items) {
          const key = item.toLowerCase();
          if (ingredientesMap.has(key)) {
            ingredientesMap.set(key, { ...ingredientesMap.get(key), count: ingredientesMap.get(key).count + 1 });
          } else {
            const normalizado = normalizarIngrediente(item);
            ingredientesMap.set(key, {
              original: item,
              nombre: normalizado.nombre,
              cantidad: normalizado.cantidad,
              count: 1
            });
          }
        }
      }
    }
  }
  const items = Array.from(ingredientesMap.values()).map(item => ({
    id: Date.now() + Math.random(),
    nombre: item.nombre,
    cantidad: item.cantidad,
    original: item.original,
    completado: false,
    categoria: obtenerCategoria(item.nombre)
  }));
  return items;
}

function guardarItemsEnLocalStorage(items) {
  localStorage.setItem('listaComprasItems', JSON.stringify(items));
}

function cargarItemsDesdeLocalStorage() {
  const guardado = localStorage.getItem('listaComprasItems');
  if (guardado) {
    itemsCompra = JSON.parse(guardado);
  } else {
    itemsCompra = generarListaCompras();
    guardarItemsEnLocalStorage(itemsCompra);
  }
}

function actualizarProgreso() {
  const total = itemsCompra.length;
  const completados = itemsCompra.filter(item => item.completado).length;
  const porcentaje = total > 0 ? (completados / total) * 100 : 0;
  document.getElementById('progreso-texto').textContent = `${completados} de ${total} completados`;
  document.getElementById('progreso-fill').style.width = `${porcentaje}%`;
}

function toggleCompletado(id) {
  const item = itemsCompra.find(i => i.id === id);
  if (item) {
    item.completado = !item.completado;
    guardarItemsEnLocalStorage(itemsCompra);
    renderizarLista();
  }
}

function renderizarLista() {
  const container = document.getElementById('lista-contenido');
  if (itemsCompra.length === 0) {
    container.innerHTML = `
      <div class="vacio-mensaje">
        <span>🛒</span>
        <p>No hay ingredientes en tu lista</p>
        <small>Agrega recetas al planificador semanal</small>
      </div>
    `;
    actualizarProgreso();
    return;
  }
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) {
      itemsPorCategoria[item.categoria] = [];
    }
    itemsPorCategoria[item.categoria].push(item);
  }
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  let html = '';
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      html += `
        <div class="categoria-grupo">
          <div class="categoria-titulo">
            <span>${categoria === 'Abarrotes' ? '🛒' : categoria === 'Lacteos' ? '🥛' : categoria === 'Verduras' ? '🥬' : categoria === 'Frutas' ? '🍎' : categoria === 'Carnes' ? '🍗' : '📦'}</span>
            ${categoria}
          </div>
          <ul class="items-lista">
            ${items.map(item => `
              <li class="item-compra ${item.completado ? 'completado' : ''}">
                <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${item.completado ? 'checked' : ''}>
                <div class="item-contenido">
                  <div class="item-nombre">${escapeHTML(item.nombre)}</div>
                  ${item.cantidad ? `<div class="item-cantidad">${escapeHTML(item.cantidad)}</div>` : ''}
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
  }
  container.innerHTML = html;
  document.querySelectorAll('.item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = parseFloat(checkbox.dataset.id);
      toggleCompletado(id);
    });
  });
  actualizarProgreso();
}

function exportarLista() {
  const completados = itemsCompra.filter(item => item.completado).length;
  const total = itemsCompra.length;
  let texto = `LISTA DE COMPRAS\n${completados} de ${total} completados\n\n`;
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) {
      itemsPorCategoria[item.categoria] = [];
    }
    itemsPorCategoria[item.categoria].push(item);
  }
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      texto += `\n${categoria.toUpperCase()}\n${'-'.repeat(30)}\n`;
      for (const item of items) {
        const check = item.completado ? '✓' : '□';
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
}

async function compartirLista() {
  const completados = itemsCompra.filter(item => item.completado).length;
  const total = itemsCompra.length;
  let texto = `LISTA DE COMPRAS\n${completados} de ${total} completados\n\n`;
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) {
      itemsPorCategoria[item.categoria] = [];
    }
    itemsPorCategoria[item.categoria].push(item);
  }
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      texto += `\n${categoria.toUpperCase()}\n${'-'.repeat(30)}\n`;
      for (const item of items) {
        const check = item.completado ? '✓' : '□';
        texto += `${check} ${item.nombre}${item.cantidad ? ` - ${item.cantidad}` : ''}\n`;
      }
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Lista de Compras',
        text: texto
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        copiarAlPortapapeles(texto);
      }
    }
  } else {
    copiarAlPortapapeles(texto);
  }
}

function copiarAlPortapapeles(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    alert('Lista copiada al portapapeles');
  }).catch(() => {
    alert('No se pudo copiar la lista');
  });
}

function actualizarDesdePlanificador() {
  const nuevosItems = generarListaCompras();
  const itemsMap = new Map();
  for (const item of nuevosItems) {
    itemsMap.set(item.original.toLowerCase(), item);
  }
  const nuevosItemsArray = Array.from(itemsMap.values());
  for (const nuevoItem of nuevosItemsArray) {
    const existente = itemsCompra.find(i => i.original.toLowerCase() === nuevoItem.original.toLowerCase());
    if (existente) {
      nuevoItem.completado = existente.completado;
    }
  }
  itemsCompra = nuevosItemsArray;
  guardarItemsEnLocalStorage(itemsCompra);
  renderizarLista();
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

function init() {
  cargarItemsDesdeLocalStorage();
  renderizarLista();
  document.getElementById('exportar-btn').addEventListener('click', exportarLista);
  document.getElementById('compartir-btn').addEventListener('click', compartirLista);
  window.addEventListener('storage', (e) => {
    if (e.key === 'planSemanal') {
      actualizarDesdePlanificador();
    }
  });
}

init();