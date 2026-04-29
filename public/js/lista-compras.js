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

// Cargar usuario
async function cargarUsuario() {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  if (userId && token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        currentUser = await res.json();
      }
    } catch (e) {
      console.error('Error cargando usuario:', e);
    }
  }
}

// Cargar plan semanal
async function cargarPlanSemanal() {
  if (!currentUser) return null;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/users/me/planner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data?.plan || null;
    }
  } catch (e) {
    console.error('Error cargando plan:', e);
  }
  return null;
}

// Extraer cantidad
function extraerCantidad(nombreIngrediente) {
  const regex = /^(\d+(?:\.\d+)?(?:\s*(?:g|kg|ml|l|taza|cucharada|cucharadita|unidad|pieza|pizca|cdita|cdta|cda|gr|kilo|litro))?)\s+(.+)$/i;
  const match = nombreIngrediente.match(regex);
  if (match) {
    return { cantidad: match[1].trim(), nombre: match[2].trim() };
  }
  return { cantidad: '', nombre: nombreIngrediente.trim() };
}

// Obtener categoría
function obtenerCategoria(ingrediente) {
  const lower = ingrediente.toLowerCase();
  for (const [categoria, palabras] of Object.entries(categorias)) {
    for (const palabra of palabras) {
      if (lower.includes(palabra)) return categoria;
    }
  }
  return 'Otros';
}

// Sincronización inteligente basada en recetas del plan
async function sincronizarInteligente() {
  const plan = await cargarPlanSemanal();
  if (!plan) return;

  const itemsPlan = [];
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const comidas = ['desayuno', 'comida', 'cena', 'merienda', 'snack'];

  dias.forEach(dia => {
    comidas.forEach(comida => {
      let recetas = plan[dia]?.[comida];
      if (!recetas) return;
      if (!Array.isArray(recetas)) recetas = [recetas];
      
      recetas.forEach(receta => {
        if (receta && receta.ingredientes) {
          // Separar ingredientes por coma o por líneas
          const ingredientesRaw = receta.ingredientes.includes('\n') 
            ? receta.ingredientes.split('\n') 
            : receta.ingredientes.split(',');
            
          ingredientesRaw.map(i => i.trim()).filter(i => i).forEach(ing => {
            const { cantidad, nombre } = extraerCantidad(ing);
            itemsPlan.push({ nombre, cantidad, recetaTitulo: receta.titulo });
          });
        }
      });
    });
  });

  let modificado = false;
  itemsPlan.forEach(newItem => {
    const nombreNormalizado = newItem.nombre.toLowerCase().trim();
    // Buscar si ya existe el ingrediente (sin importar la receta)
    let existente = itemsCompra.find(i => i.nombre.toLowerCase().trim() === nombreNormalizado);
    
    if (!existente) {
      itemsCompra.push({
        id: Date.now() + Math.random(),
        nombre: newItem.nombre,
        cantidad: newItem.cantidad,
        completado: false,
        categoria: obtenerCategoria(newItem.nombre),
        recetas: [newItem.recetaTitulo]
      });
      modificado = true;
    } else {
      // Si ya existe, nos aseguramos de que la receta esté en la lista
      if (!existente.recetas) existente.recetas = [];
      if (!existente.recetas.includes(newItem.recetaTitulo)) {
        existente.recetas.push(newItem.recetaTitulo);
        modificado = true;
      }
    }
  });

  if (modificado) {
    await guardarItemsEnSupabase(itemsCompra);
    renderizarLista();
  }
}

// Cargar items desde Supabase
async function cargarItemsDesdeSupabase() {
  if (!currentUser) return [];
  const { data, error } = await supabase
    .from('lista_compras')
    .select('items')
    .eq('usuario_id', currentUser.id)
    .maybeSingle();
  return data?.items || [];
}

// Guardar items en Supabase
async function guardarItemsEnSupabase(items) {
  if (!currentUser) return;
  await supabase
    .from('lista_compras')
    .upsert({
      usuario_id: currentUser.id,
      items: items,
      updated_at: new Date().toISOString()
    }, { onConflict: 'usuario_id' });
}

// Renderizar lista
function renderizarLista() {
  const container = document.getElementById('lista-contenido');
  if (!container) return;
  
  if (itemsCompra.length === 0) {
    container.innerHTML = `<div class="vacio-mensaje"><span>🛒</span><p>Tu lista está vacía</p></div>`;
    actualizarProgreso();
    return;
  }
  
  const itemsPorCategoria = {};
  itemsCompra.forEach(item => {
    if (!itemsPorCategoria[item.categoria]) itemsPorCategoria[item.categoria] = [];
    itemsPorCategoria[item.categoria].push(item);
  });
  
  const ordenCategorias = ['Abarrotes', 'Lacteos', 'Verduras', 'Frutas', 'Carnes', 'Otros'];
  let html = '';
  
  ordenCategorias.forEach(cat => {
    const items = itemsPorCategoria[cat];
    if (items && items.length > 0) {
      const icono = { Abarrotes:'🛒', Lacteos:'🥛', Verduras:'🥬', Frutas:'🍎', Carnes:'🍗', Otros:'📦' }[cat];
      html += `<div class="categoria-grupo"><div class="categoria-titulo"><span>${icono}</span> ${cat}</div><ul class="items-lista">`;
      items.forEach(item => {
        html += `
          <li class="item-compra ${item.completado ? 'completado' : ''}" data-id="${item.id}">
            <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${item.completado ? 'checked' : ''}>
            <div class="item-contenido">
              <div class="item-nombre">${escapeHTML(item.nombre)}</div>
              ${item.cantidad ? `<div class="item-cantidad">📦 ${escapeHTML(item.cantidad)}</div>` : ''}
              ${item.recetas && item.recetas.length > 0 ? `<div class="item-recetas">📖 ${escapeHTML(item.recetas.join(', '))}</div>` : ''}
            </div>
            <button class="btn-eliminar-item" data-id="${item.id}">✖</button>
          </li>`;
      });
      html += `</ul></div>`;
    }
  });
  
  container.innerHTML = html;
  
  // Eventos
  container.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = parseFloat(e.target.dataset.id);
      const item = itemsCompra.find(i => i.id === id);
      if (item) {
        item.completado = e.target.checked;
        await guardarItemsEnSupabase(itemsCompra);
        renderizarLista();
        actualizarProgreso();
      }
    });
  });

  container.querySelectorAll('.btn-eliminar-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseFloat(e.target.dataset.id);
      itemsCompra = itemsCompra.filter(i => i.id !== id);
      await guardarItemsEnSupabase(itemsCompra);
      renderizarLista();
      actualizarProgreso();
    });
  });
  
  actualizarProgreso();
}

function actualizarProgreso() {
  const total = itemsCompra.length;
  const completados = itemsCompra.filter(i => i.completado).length;
  const porcentaje = total > 0 ? (completados / total) * 100 : 0;
  const fill = document.getElementById('progreso-fill');
  const texto = document.getElementById('progreso-texto');
  if (fill) fill.style.width = `${porcentaje}%`;
  if (texto) texto.textContent = `${completados} de ${total} completados`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Exportar PDF
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Filtrar solo items seleccionados (no completados)
  const itemsPendientes = itemsCompra.filter(item => !item.completado);
  
  if (itemsPendientes.length === 0) {
    alert("No hay artículos pendientes para exportar.");
    return;
  }
  
  doc.setFontSize(20);
  doc.setTextColor(26, 60, 52);
  doc.text("Lista de Compras - ForaneoKitchen", 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Generada el: ${new Date().toLocaleDateString()}`, 20, 30);
  
  let y = 45;
  
  // Agrupar por categoría para el PDF
  const agrupados = {};
  itemsPendientes.forEach(item => {
    const cat = item.categoria || 'Otros';
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(item);
  });
  
  for (const [cat, items] of Object.entries(agrupados)) {
    if (y > 270) { doc.addPage(); y = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(76, 175, 80);
    doc.text(cat, 20, y);
    y += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(0);
    items.forEach(item => {
      if (y > 280) { doc.addPage(); y = 20; }
      const text = `- [ ] ${item.cantidad ? item.cantidad + ' ' : ''}${item.nombre}`;
      doc.text(text, 25, y);
      y += 7;
    });
    y += 5;
  }
  
  doc.save(`Lista_Compras_${new Date().getTime()}.pdf`);
}

async function agregarItemManual() {
  const input = document.getElementById('input-item');
  const nombre = input?.value.trim();
  if (!nombre) return;
  
  const { cantidad, nombre: nombreSolo } = extraerCantidad(nombre);
  itemsCompra.push({
    id: Date.now(),
    nombre: nombreSolo,
    cantidad: cantidad,
    completado: false,
    categoria: obtenerCategoria(nombreSolo),
    recetas: []
  });
  
  input.value = '';
  await guardarItemsEnSupabase(itemsCompra);
  renderizarLista();
}

// Inicializar
async function init() {
  await cargarUsuario();
  if (!currentUser) { window.location.href = 'login.html'; return; }
  
  // 1. Cargar items existentes
  itemsCompra = await cargarItemsDesdeSupabase();
  
  // 2. Sincronizar con el plan actual
  await sincronizarInteligente(); 
  
  // 3. Renderizar
  renderizarLista();
  
  // Eventos
  document.getElementById('add-item-btn')?.addEventListener('click', agregarItemManual);
  document.getElementById('input-item')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') agregarItemManual();
  });
  document.getElementById('sync-btn')?.addEventListener('click', async () => {
    await sincronizarInteligente();
    renderizarLista();
  });
  document.getElementById('exportar-pdf-btn')?.addEventListener('click', exportarPDF);
}

init();