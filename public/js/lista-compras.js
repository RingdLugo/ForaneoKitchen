// lista-compras.js - Lista de compras con Supabase
import { supabase } from './supabaseClient.js';

// Estado
let itemsCompra = [];
let currentUser = null;
let planSemanal = {};

// Categorías de ingredientes
const categorias = {
  'Abarrotes': ['arroz', 'pasta', 'frijol', 'lenteja', 'harina', 'azucar', 'sal', 'aceite', 'pan', 'maiz', 'trigo', 'cereal', 'galleta', 'sopa', 'fideos', 'espagueti', 'garbanzo'],
  'Lacteos': ['leche', 'crema', 'queso', 'mantequilla', 'yogur', 'requeson', 'yoghurt', 'media crema'],
  'Verduras': ['cebolla', 'ajo', 'papa', 'tomate', 'lechuga', 'zanahoria', 'brocoli', 'espinaca', 'cilantro', 'perejil', 'chile', 'jitomate', 'calabaza', 'elote'],
  'Frutas': ['manzana', 'platano', 'naranja', 'fresa', 'uva', 'pera', 'mango', 'piña', 'sandia', 'melon', 'kiwi', 'papaya'],
  'Carnes': ['pollo', 'res', 'cerdo', 'pescado', 'atun', 'salchicha', 'huevo', 'carne', 'salmon', 'camaron', 'tocino', 'jamón'],
  'Otros': []
};

// Cargar usuario (usa JWT propio, no Supabase auth)
async function cargarUsuario() {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  if (userId && token) {
    currentUser = {
      id: parseInt(userId),
      es_premium: localStorage.getItem('userPremium') === 'true',
      puntos: parseInt(localStorage.getItem('userPuntos') || 0),
      username: localStorage.getItem('userName')
    };
  }
}

// Cargar plan semanal desde Supabase
async function cargarPlanSemanal() {
  if (!currentUser) return null;
  
  const { data, error } = await supabase
    .from('planes_semanales')
    .select('plan')
    .eq('usuario_id', currentUser.id)
    .maybeSingle();
  
  if (error) {
    console.error('Error al cargar plan:', error);
    return null;
  }
  
  return data?.plan || null;
}

// Extraer cantidad del ingrediente
function extraerCantidad(nombreIngrediente) {
  const regex = /^(\d+(?:\.\d+)?(?:\s*(?:g|kg|ml|l|taza|cucharada|cucharadita|unidad|pieza|pizca|cdita|cdta|cda|gr|kilo|litro))?)\s+(.+)$/i;
  const match = nombreIngrediente.match(regex);
  if (match) {
    return { cantidad: match[1].trim(), nombre: match[2].trim() };
  }
  return { cantidad: '', nombre: nombreIngrediente.trim() };
}

// Combinar cantidades
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

// Obtener categoría del ingrediente
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

// Generar lista de compras desde el plan semanal
async function generarListaCompras() {
  const plan = await cargarPlanSemanal();
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
                  id: Date.now() + Math.random() * 10000,
                  nombre: nombre,
                  cantidad: cantidad,
                  count: 1,
                  categoria: obtenerCategoria(nombre),
                  recetas: [receta.titulo],
                  completado: false
                });
              }
            }
          }
        }
      }
    }
  }
  
  const items = Array.from(ingredientesMap.values());
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Cargar items guardados desde Supabase
async function cargarItemsDesdeSupabase() {
  if (!currentUser) return [];
  
  const { data, error } = await supabase
    .from('lista_compras')
    .select('items')
    .eq('usuario_id', currentUser.id)
    .maybeSingle();
  
  if (error) {
    console.error('Error al cargar lista:', error);
    return [];
  }
  
  if (data && data.items && data.items.length > 0) {
    return data.items;
  }
  
  // Si no hay lista guardada, generar desde plan
  const nuevosItems = await generarListaCompras();
  await guardarItemsEnSupabase(nuevosItems);
  return nuevosItems;
}

// Guardar items en Supabase
async function guardarItemsEnSupabase(items) {
  if (!currentUser) return;
  
  const { error } = await supabase
    .from('lista_compras')
    .upsert({
      usuario_id: currentUser.id,
      items: items,
      updated_at: new Date().toISOString()
    }, { onConflict: 'usuario_id' });
  
  if (error) {
    console.error('Error al guardar lista:', error);
  }
}

// Sincronizar con planificador
async function sincronizarConPlanificador() {
  const nuevosItems = await generarListaCompras();
  const nuevosItemsMap = new Map();
  
  for (const item of nuevosItems) {
    nuevosItemsMap.set(item.nombre.toLowerCase(), item);
  }
  
  // Mantener estado de completado de items existentes
  for (const item of itemsCompra) {
    if (nuevosItemsMap.has(item.nombre.toLowerCase())) {
      const nuevoItem = nuevosItemsMap.get(item.nombre.toLowerCase());
      nuevoItem.completado = item.completado;
      nuevoItem.id = item.id;
      nuevosItemsMap.set(item.nombre.toLowerCase(), nuevoItem);
    }
  }
  
  itemsCompra = Array.from(nuevosItemsMap.values());
  await guardarItemsEnSupabase(itemsCompra);
  renderizarLista();
  actualizarProgreso();
  mostrarNotificacion('Lista sincronizada con el planificador');
}

// Marcar item como completado
async function toggleCompletado(id) {
  const item = itemsCompra.find(i => i.id === id);
  if (item) {
    item.completado = !item.completado;
    await guardarItemsEnSupabase(itemsCompra);
    renderizarLista();
    actualizarProgreso();
  }
}

// Editar cantidad
async function editarCantidad(id) {
  const item = itemsCompra.find(i => i.id === id);
  if (!item) return;
  
  const nuevaCantidad = prompt('Editar cantidad (ej: 200g, 1kg, 2 piezas):', item.cantidad || '');
  if (nuevaCantidad !== null) {
    item.cantidad = nuevaCantidad;
    await guardarItemsEnSupabase(itemsCompra);
    renderizarLista();
    mostrarNotificacion('Cantidad actualizada');
  }
}

// Eliminar item manual
async function eliminarItem(id) {
  if (confirm('¿Eliminar este producto de la lista?')) {
    itemsCompra = itemsCompra.filter(i => i.id !== id);
    await guardarItemsEnSupabase(itemsCompra);
    renderizarLista();
    actualizarProgreso();
    mostrarNotificacion('Producto eliminado');
  }
}

// Actualizar barra de progreso
function actualizarProgreso() {
  const total = itemsCompra.length;
  const completados = itemsCompra.filter(item => item.completado).length;
  const porcentaje = total > 0 ? (completados / total) * 100 : 0;
  
  const textoProgreso = document.getElementById('progreso-texto');
  const fillProgreso = document.getElementById('progreso-fill');
  
  if (textoProgreso) textoProgreso.textContent = `${completados} de ${total} completados`;
  if (fillProgreso) fillProgreso.style.width = `${porcentaje}%`;
}

// Exportar a PDF
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  
  const pdfContent = document.createElement('div');
  pdfContent.style.padding = '20px';
  pdfContent.style.fontFamily = 'Arial, sans-serif';
  pdfContent.style.backgroundColor = 'white';
  
  const completados = itemsCompra.filter(item => item.completado).length;
  const total = itemsCompra.length;
  
  let html = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #2e7d32;">🛒 Lista de Compras</h1>
      <p style="color: #666;">Fecha: ${new Date().toLocaleDateString()}</p>
      <p style="color: #666;">✅ ${completados} de ${total} completados</p>
    </div>
  `;
  
  // Agrupar por categoría
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  }
  
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  
  for (const categoria of categoriasOrdenadas) {
    const items = itemsPorCategoria[categoria];
    if (items && items.length > 0) {
      const icono = categoria === 'Abarrotes' ? '🛒' : categoria === 'Lacteos' ? '🥛' : categoria === 'Verduras' ? '🥬' : categoria === 'Frutas' ? '🍎' : categoria === 'Carnes' ? '🍗' : '📦';
      html += `
        <div style="margin-bottom: 20px;">
          <div style="background: #e8f5e9; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px;">
            <h3 style="color: #2e7d32; margin: 0;">${icono} ${categoria}</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
      `;
      
      for (const item of items) {
        const check = item.completado ? '✓' : '○';
        html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; width: 30px;">${check}</td>
            <td style="padding: 8px;"><strong>${escapeHTML(item.nombre)}</strong></td>
            <td style="padding: 8px; text-align: right;">${item.cantidad ? escapeHTML(item.cantidad) : ''}</td>
          </tr>
        `;
      }
      
      html += `</table></div>`;
    }
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
    pdf.save(`lista-compras-${new Date().toISOString().slice(0, 10)}.pdf`);
    mostrarNotificacion('PDF generado correctamente');
  } catch (error) {
    console.error('Error al generar PDF:', error);
    mostrarNotificacion('Error al generar PDF', true);
  } finally {
    document.body.removeChild(pdfContent);
  }
}

// Mostrar notificación
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

// Escapar HTML
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Renderizar lista
function renderizarLista() {
  const container = document.getElementById('lista-contenido');
  if (!container) return;
  
  if (itemsCompra.length === 0) {
    container.innerHTML = `
      <div class="vacio-mensaje">
        <span>🛒</span>
        <p>Tu lista de compras está vacía</p>
        <small>Agrega recetas desde el planificador semanal</small>
        <button id="sincronizar-vacio-btn" class="btn-sincronizar">🔄 Sincronizar con planificador</button>
      </div>
    `;
    const sincronizarBtn = document.getElementById('sincronizar-vacio-btn');
    if (sincronizarBtn) sincronizarBtn.addEventListener('click', sincronizarConPlanificador);
    actualizarProgreso();
    return;
  }
  
  const itemsPorCategoria = {};
  for (const item of itemsCompra) {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  }
  
  const categoriasOrdenadas = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  let html = '';
  
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
              ${item.recetas && item.recetas.length > 0 ? `<div class="item-recetas">📖 ${escapeHTML(item.recetas.slice(0, 2).join(', '))}${item.recetas.length > 2 ? ` +${item.recetas.length - 2}` : ''}</div>` : ''}
            </div>
            <div class="item-acciones">
              <button class="btn-editar-cantidad" data-id="${item.id}" title="Editar cantidad">✏️</button>
            </div>
          </li>
        `;
      }
      
      html += `</ul></div>`;
    }
  }
  
  container.innerHTML = html;
  
  // Event listeners
  document.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = parseFloat(cb.dataset.id);
      await toggleCompletado(id);
    });
  });
  
  document.querySelectorAll('.btn-editar-cantidad').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseFloat(btn.dataset.id);
      await editarCantidad(id);
    });
  });
  
  actualizarProgreso();
}

// Inicializar
async function init() {
  await cargarUsuario();
  
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }
  
  itemsCompra = await cargarItemsDesdeSupabase();
  
  // Sincronización automática: Si la lista está vacía pero hay un plan, generar
  if (itemsCompra.length === 0) {
    itemsCompra = await generarListaCompras();
    if (itemsCompra.length > 0) {
      await guardarItemsEnSupabase(itemsCompra);
    }
  }
  
  renderizarLista();
  
  // Event listeners
  const exportarBtn = document.getElementById('exportar-pdf-btn');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarPDF);
  
  const sincronizarBtn = document.getElementById('sincronizar-btn');
  if (sincronizarBtn) sincronizarBtn.addEventListener('click', sincronizarConPlanificador);
}

init();