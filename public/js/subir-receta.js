// public/js/subir-receta.js

const API = 'http://localhost:3000';
let token = localStorage.getItem('token');
let imagenSeleccionada = null;

const DOM = {
  titulo: document.getElementById('titulo'),
  ingredientes: document.getElementById('ingredientes'),
  pasos: document.getElementById('pasos'),
  precio: document.getElementById('precio'),
  tiempo: document.getElementById('tiempo'),
  imagenInput: document.getElementById('receta-imagen'),
  imagePreview: document.getElementById('image-preview'),
  previewImg: document.getElementById('preview-img'),
  publicarBtn: document.getElementById('publicar-btn'),
  removeImageBtn: document.getElementById('remove-image-btn')
};

// ============================================
// VALIDACIONES
// ============================================

function validarTitulo(titulo) {
  const regex = /^[a-zA-ZáéíóúñÑÁÉÍÓÚ\s0-9\-_,.!?()]+$/;
  if (!titulo || titulo.trim() === '') {
    return { valido: false, mensaje: '❌ El título no puede estar vacío' };
  }
  if (!regex.test(titulo)) {
    return { valido: false, mensaje: '❌ El título solo puede contener letras, números y espacios' };
  }
  if (titulo.length < 3) {
    return { valido: false, mensaje: '❌ El título debe tener al menos 3 caracteres' };
  }
  if (titulo.length > 100) {
    return { valido: false, mensaje: '❌ El título no puede exceder los 100 caracteres' };
  }
  return { valido: true, valor: titulo.trim() };
}

function validarPrecio(precio) {
  if (!precio || precio.trim() === '') {
    return { valido: false, mensaje: '❌ El costo es obligatorio' };
  }
  const numeros = precio.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: '❌ El costo debe contener al menos un número (ej: 25, 50, 100)' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 0) {
    return { valido: false, mensaje: '❌ El costo no puede ser negativo' };
  }
  if (valorNumerico > 999) {
    return { valido: false, mensaje: '❌ El costo no puede exceder los $999' };
  }
  return { valido: true, valor: `$${valorNumerico} MXN`, valorNumerico: valorNumerico };
}

function validarTiempo(tiempo) {
  if (!tiempo || tiempo.trim() === '') {
    return { valido: false, mensaje: '❌ El tiempo es obligatorio' };
  }
  const numeros = tiempo.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: '❌ El tiempo debe contener al menos un número (ej: 10, 20, 30)' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 1) {
    return { valido: false, mensaje: '❌ El tiempo debe ser mayor a 0 minutos' };
  }
  if (valorNumerico > 180) {
    return { valido: false, mensaje: '❌ El tiempo no puede exceder los 180 minutos' };
  }
  return { valido: true, valor: `${valorNumerico} min`, valorNumerico: valorNumerico };
}

function validarIngredientes(ingredientes) {
  if (!ingredientes || ingredientes.trim() === '') {
    return { valido: false, mensaje: '❌ Los ingredientes son obligatorios' };
  }
  
  let items = ingredientes.split(',').map(i => i.trim()).filter(i => i);
  
  if (items.length === 0) {
    return { valido: false, mensaje: '❌ Debes agregar al menos un ingrediente' };
  }
  
  if (items.length > 20) {
    return { valido: false, mensaje: '❌ No puedes agregar más de 20 ingredientes' };
  }
  
  for (let item of items) {
    if (item.length < 2) {
      return { valido: false, mensaje: '❌ Cada ingrediente debe tener al menos 2 caracteres' };
    }
    if (item.length > 100) {
      return { valido: false, mensaje: '❌ Un ingrediente no puede exceder los 100 caracteres' };
    }
  }
  
  const ingredientesFormateados = items.join(', ');
  return { valido: true, valor: ingredientesFormateados, lista: items };
}

function validarPasos(pasos) {
  if (!pasos || pasos.trim() === '') {
    return { valido: false, mensaje: '❌ Los pasos de preparación son obligatorios' };
  }
  
  let pasosLista = [];
  
  if (pasos.match(/\d+\./)) {
    pasosLista = pasos.split(/\d+\./).filter(p => p.trim()).map(p => p.trim());
  } else if (pasos.includes('\n')) {
    pasosLista = pasos.split('\n').filter(p => p.trim()).map(p => p.trim());
  } else {
    pasosLista = [pasos.trim()];
  }
  
  if (pasosLista.length === 0) {
    return { valido: false, mensaje: '❌ Debes agregar al menos un paso' };
  }
  
  if (pasosLista.length > 20) {
    return { valido: false, mensaje: '❌ No puedes agregar más de 20 pasos' };
  }
  
  for (let paso of pasosLista) {
    if (paso.length < 5) {
      return { valido: false, mensaje: '❌ Cada paso debe tener al menos 5 caracteres' };
    }
    if (paso.length > 500) {
      return { valido: false, mensaje: '❌ Un paso no puede exceder los 500 caracteres' };
    }
  }
  
  const pasosFormateados = pasosLista.map((paso, index) => {
    return `${index + 1}. ${paso}`;
  }).join('\n');
  
  return { valido: true, valor: pasosFormateados, lista: pasosLista };
}

function validarImagen(file) {
  if (!file) return { valido: true };
  
  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(file.type)) {
    return { valido: false, mensaje: '❌ Solo se permiten imágenes JPG, PNG o WEBP' };
  }
  
  if (file.size > 5 * 1024 * 1024) {
    return { valido: false, mensaje: '❌ La imagen no puede exceder los 5MB' };
  }
  
  return { valido: true };
}

// ============================================
// GENERAR ETIQUETAS BASADAS EN DATOS NUMÉRICOS
// ============================================

function generarEtiquetasAutomaticas(titulo, ingredientes, pasos, precioNumerico, tiempoNumerico) {
  const etiquetas = [];
  const pasosLower = pasos.toLowerCase();
  const ingredientesLower = ingredientes.toLowerCase();
  const tituloLower = titulo.toLowerCase();
  
  // ECONÓMICAS: precio ≤ 35 MXN
  if (precioNumerico > 0 && precioNumerico <= 35) {
    etiquetas.push('economica');
  }
  
  // RÁPIDAS: tiempo ≤ 20 minutos
  if (tiempoNumerico > 0 && tiempoNumerico <= 20) {
    etiquetas.push('rapida');
  }
  
  // MICROONDAS: si contiene la palabra
  if (pasosLower.includes('microondas') || 
      ingredientesLower.includes('microondas') ||
      tituloLower.includes('microondas')) {
    etiquetas.push('microondas');
  }
  
  // MENOS DE $30: precio ≤ 30 MXN
  if (precioNumerico > 0 && precioNumerico <= 30) {
    etiquetas.push('menos30');
  }
  
  return etiquetas;
}

// ============================================
// UTILIDADES
// ============================================

function mostrarNotificacion(mensaje, tipo = 'info') {
  const notificacion = document.createElement('div');
  notificacion.className = `temp-notification ${tipo}`;
  notificacion.textContent = mensaje;
  document.body.appendChild(notificacion);
  
  setTimeout(() => notificacion.classList.add('show'), 10);
  setTimeout(() => {
    notificacion.classList.remove('show');
    setTimeout(() => notificacion.remove(), 300);
  }, 3000);
}

function convertirImagenABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function eliminarImagen() {
  imagenSeleccionada = null;
  if (DOM.imagenInput) DOM.imagenInput.value = '';
  if (DOM.imagePreview) DOM.imagePreview.style.display = 'none';
  if (DOM.previewImg) DOM.previewImg.src = '';
}

function setupImageUpload() {
  if (!DOM.imagenInput) return;
  
  DOM.imagenInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const validacion = validarImagen(file);
      if (!validacion.valido) {
        mostrarNotificacion(validacion.mensaje, 'error');
        DOM.imagenInput.value = '';
        return;
      }
      
      imagenSeleccionada = file;
      const reader = new FileReader();
      reader.onload = function(event) {
        DOM.previewImg.src = event.target.result;
        DOM.imagePreview.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    } else if (file) {
      mostrarNotificacion('Por favor selecciona un archivo de imagen válido', 'error');
      imagenSeleccionada = null;
    }
  });
  
  if (DOM.removeImageBtn) {
    DOM.removeImageBtn.addEventListener('click', eliminarImagen);
  }
}

function mostrarErrorCampo(campo, mensaje) {
  campo.classList.add('error');
  mostrarNotificacion(mensaje, 'error');
  campo.focus();
  setTimeout(() => {
    campo.classList.remove('error');
  }, 3000);
}

// ============================================
// PUBLICAR RECETA
// ============================================

async function publicarReceta() {
  if (!token) {
    mostrarNotificacion('Debes iniciar sesión para publicar recetas', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return;
  }

  const tituloRaw = DOM.titulo.value;
  const precioRaw = DOM.precio.value;
  const tiempoRaw = DOM.tiempo.value;
  const ingredientesRaw = DOM.ingredientes.value;
  const pasosRaw = DOM.pasos.value;

  const tituloValidacion = validarTitulo(tituloRaw);
  if (!tituloValidacion.valido) {
    mostrarErrorCampo(DOM.titulo, tituloValidacion.mensaje);
    return;
  }

  const precioValidacion = validarPrecio(precioRaw);
  if (!precioValidacion.valido) {
    mostrarErrorCampo(DOM.precio, precioValidacion.mensaje);
    return;
  }

  const tiempoValidacion = validarTiempo(tiempoRaw);
  if (!tiempoValidacion.valido) {
    mostrarErrorCampo(DOM.tiempo, tiempoValidacion.mensaje);
    return;
  }

  const ingredientesValidacion = validarIngredientes(ingredientesRaw);
  if (!ingredientesValidacion.valido) {
    mostrarErrorCampo(DOM.ingredientes, ingredientesValidacion.mensaje);
    return;
  }

  const pasosValidacion = validarPasos(pasosRaw);
  if (!pasosValidacion.valido) {
    mostrarErrorCampo(DOM.pasos, pasosValidacion.mensaje);
    return;
  }

  if (imagenSeleccionada) {
    const imagenValidacion = validarImagen(imagenSeleccionada);
    if (!imagenValidacion.valido) {
      mostrarNotificacion(imagenValidacion.mensaje, 'error');
      return;
    }
  }

  // Generar etiquetas basadas en DATOS NUMÉRICOS
  const etiquetas = generarEtiquetasAutomaticas(
    tituloValidacion.valor,
    ingredientesValidacion.valor,
    pasosValidacion.valor,
    precioValidacion.valorNumerico,
    tiempoValidacion.valorNumerico
  );

  let imagenBase64 = null;
  if (imagenSeleccionada) {
    try {
      imagenBase64 = await convertirImagenABase64(imagenSeleccionada);
    } catch (err) {
      console.error('Error al convertir imagen:', err);
      mostrarNotificacion('Error al procesar la imagen', 'error');
      return;
    }
  }

  const datos = {
    titulo: tituloValidacion.valor,
    ingredientes: ingredientesValidacion.valor,
    pasos: pasosValidacion.valor,
    precio: precioValidacion.valor,
    precioNumerico: precioValidacion.valorNumerico,
    tiempo: tiempoValidacion.valor,
    tiempoNumerico: tiempoValidacion.valorNumerico,
    imagen: imagenBase64,
    etiquetas: etiquetas
  };

  DOM.publicarBtn.disabled = true;
  DOM.publicarBtn.textContent = 'Publicando...';

  try {
    const res = await fetch(`${API}/api/recetas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datos)
    });

    if (res.ok) {
      mostrarNotificacion('🎉 ¡Receta publicada exitosamente!', 'success');
      
      DOM.titulo.value = '';
      DOM.ingredientes.value = '';
      DOM.pasos.value = '';
      DOM.precio.value = '';
      DOM.tiempo.value = '';
      eliminarImagen();
      
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 2000);
      
    } else {
      const err = await res.json();
      mostrarNotificacion(err.error || 'Error al publicar', 'error');
    }
  } catch (err) {
    console.error('Error:', err);
    mostrarNotificacion('No se pudo conectar con el servidor', 'error');
  } finally {
    DOM.publicarBtn.disabled = false;
    DOM.publicarBtn.textContent = 'Publicar receta →';
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================

function init() {
  setupImageUpload();
  
  if (DOM.publicarBtn) {
    DOM.publicarBtn.addEventListener('click', publicarReceta);
  }
  
  const inputs = [DOM.titulo, DOM.precio, DOM.tiempo];
  inputs.forEach(input => {
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextInput = inputs[inputs.indexOf(input) + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            DOM.ingredientes.focus();
          }
        }
      });
    }
  });
}

init();