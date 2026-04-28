// ================================================
// subir-receta.js - ForaneoKitchen
// ================================================

const API = (() => {
  if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
})();

let token = localStorage.getItem('token');
let imagenSeleccionada = null;

// Elementos del DOM
const DOM = {
  titulo: document.getElementById('titulo'),
  ingredientes: document.getElementById('ingredientes'),
  pasos: document.getElementById('pasos'),
  precio: document.getElementById('precio'),
  tiempo: document.getElementById('tiempo'),
  video: document.getElementById('video'),
  esPremiumReceta: document.getElementById('es-premium-receta'),
  puntosMonto: document.getElementById('puntos-monto'),
  imagenInput: document.getElementById('receta-imagen'),
  imagePreview: document.getElementById('image-preview'),
  previewImg: document.getElementById('preview-img'),
  publicarBtn: document.getElementById('publicar-btn'),
  removeImageBtn: document.getElementById('remove-image-btn')
};

// ================================================
// FUNCIONES UTILITARIAS
// ================================================

function mostrarNotificacion(mensaje, tipo = 'info') {
  const notificacion = document.createElement('div');
  notificacion.className = `temp-notification ${tipo}`;
  notificacion.textContent = mensaje;
  notificacion.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: ${tipo === 'error' ? '#ff5252' : tipo === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2000;
    opacity: 0;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    white-space: nowrap;
  `;
  document.body.appendChild(notificacion);
  setTimeout(() => notificacion.style.transform = 'translateX(-50%) translateY(0)', 10);
  setTimeout(() => notificacion.style.opacity = '1', 10);
  setTimeout(() => {
    notificacion.style.opacity = '0';
    setTimeout(() => notificacion.remove(), 300);
  }, 3000);
}

function extraerYouTubeId(url) {
  if (!url || url.trim() === '') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function convertirImagenABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================================================
// VALIDACIONES
// ================================================

function validarTitulo(titulo) {
  if (!titulo || titulo.trim() === '') {
    return { valido: false, mensaje: 'El título no puede estar vacío' };
  }
  if (titulo.length < 3) {
    return { valido: false, mensaje: 'El título debe tener al menos 3 caracteres' };
  }
  if (titulo.length > 100) {
    return { valido: false, mensaje: 'El título no puede exceder los 100 caracteres' };
  }
  return { valido: true, valor: titulo.trim() };
}

function validarPrecio(precio) {
  if (!precio || precio.trim() === '') {
    return { valido: false, mensaje: 'El costo es obligatorio' };
  }
  const numeros = precio.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: 'El costo debe contener al menos un número' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 0) {
    return { valido: false, mensaje: 'El costo no puede ser negativo' };
  }
  if (valorNumerico > 9999) {
    return { valido: false, mensaje: 'El costo no puede exceder los 9999' };
  }
  return { valido: true, valor: `$${valorNumerico} MXN`, valorNumerico: valorNumerico };
}

function validarTiempo(tiempo) {
  if (!tiempo || tiempo.trim() === '') {
    return { valido: false, mensaje: 'El tiempo es obligatorio' };
  }
  const numeros = tiempo.replace(/[^0-9]/g, '');
  if (numeros === '') {
    return { valido: false, mensaje: 'El tiempo debe contener al menos un número' };
  }
  const valorNumerico = parseInt(numeros);
  if (valorNumerico < 1) {
    return { valido: false, mensaje: 'El tiempo debe ser mayor a 0 minutos' };
  }
  if (valorNumerico > 480) {
    return { valido: false, mensaje: 'El tiempo no puede exceder los 480 minutos (8 horas)' };
  }
  return { valido: true, valor: `${valorNumerico} min`, valorNumerico: valorNumerico };
}

function validarIngredientes(ingredientes) {
  if (!ingredientes || ingredientes.trim() === '') {
    return { valido: false, mensaje: 'Los ingredientes son obligatorios' };
  }
  let items = ingredientes.split(',').map(i => i.trim()).filter(i => i);
  if (items.length === 0) {
    return { valido: false, mensaje: 'Debes agregar al menos un ingrediente' };
  }
  if (items.length > 30) {
    return { valido: false, mensaje: 'No puedes agregar más de 30 ingredientes' };
  }
  for (let item of items) {
    if (item.length < 2) {
      return { valido: false, mensaje: 'Cada ingrediente debe tener al menos 2 caracteres' };
    }
    if (item.length > 100) {
      return { valido: false, mensaje: 'Un ingrediente no puede exceder los 100 caracteres' };
    }
  }
  return { valido: true, valor: ingredientes.trim(), lista: items };
}

function validarPasos(pasos) {
  if (!pasos || pasos.trim() === '') {
    return { valido: false, mensaje: 'Los pasos de preparación son obligatorios' };
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
    return { valido: false, mensaje: 'Debes agregar al menos un paso' };
  }
  if (pasosLista.length > 30) {
    return { valido: false, mensaje: 'No puedes agregar más de 30 pasos' };
  }
  for (let paso of pasosLista) {
    if (paso.length < 3) {
      return { valido: false, mensaje: 'Cada paso debe tener al menos 3 caracteres' };
    }
    if (paso.length > 500) {
      return { valido: false, mensaje: 'Un paso no puede exceder los 500 caracteres' };
    }
  }
  const pasosFormateados = pasosLista.map((paso, index) => `${index + 1}. ${paso}`).join('\n');
  return { valido: true, valor: pasosFormateados, lista: pasosLista };
}

function validarVideo(url) {
  if (!url || url.trim() === '') {
    return { valido: true, valor: null };
  }
  const youtubeId = extraerYouTubeId(url);
  if (!youtubeId) {
    return { valido: false, mensaje: 'URL de YouTube no válida. Asegúrate de pegar el enlace correcto.' };
  }
  return { valido: true, valor: url, youtubeId: youtubeId };
}

function validarImagen(file) {
  if (!file) return { valido: true };
  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!tiposPermitidos.includes(file.type)) {
    return { valido: false, mensaje: 'Solo se permiten imágenes JPG, PNG, WEBP o GIF' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { valido: false, mensaje: 'La imagen no puede exceder los 5MB' };
  }
  return { valido: true };
}

// ================================================
// FUNCIONES DE CARGA Y PUNTOS
// ================================================

async function cargarPuntosUsuario() {
  if (!token) return;
  
  try {
    const res = await fetch(`${API}/api/auth/puntos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (DOM.puntosMonto) {
        DOM.puntosMonto.textContent = data.puntos || 0;
      }
    }
  } catch (err) {
    console.error('Error cargando puntos:', err);
  }
}

// ================================================
// FUNCIÓN PRINCIPAL: PUBLICAR RECETA
// ================================================

async function publicarReceta() {
  const tokenActual = localStorage.getItem('token');
  if (!tokenActual) {
    mostrarNotificacion('Debes iniciar sesión para publicar recetas', 'error');
    setTimeout(() => window.location.href = 'login.html', 2000);
    return;
  }

  // Obtener valores
  const tituloRaw = DOM.titulo?.value || '';
  const precioRaw = DOM.precio?.value || '';
  const tiempoRaw = DOM.tiempo?.value || '';
  const ingredientesRaw = DOM.ingredientes?.value || '';
  const pasosRaw = DOM.pasos?.value || '';
  const videoUrl = DOM.video?.value || '';
  const esPremium = DOM.esPremiumReceta?.checked || false;

  // Validaciones
  const tituloValidacion = validarTitulo(tituloRaw);
  if (!tituloValidacion.valido) {
    mostrarNotificacion(tituloValidacion.mensaje, 'error');
    DOM.titulo?.focus();
    return;
  }

  const precioValidacion = validarPrecio(precioRaw);
  if (!precioValidacion.valido) {
    mostrarNotificacion(precioValidacion.mensaje, 'error');
    DOM.precio?.focus();
    return;
  }

  const tiempoValidacion = validarTiempo(tiempoRaw);
  if (!tiempoValidacion.valido) {
    mostrarNotificacion(tiempoValidacion.mensaje, 'error');
    DOM.tiempo?.focus();
    return;
  }

  const ingredientesValidacion = validarIngredientes(ingredientesRaw);
  if (!ingredientesValidacion.valido) {
    mostrarNotificacion(ingredientesValidacion.mensaje, 'error');
    DOM.ingredientes?.focus();
    return;
  }

  const pasosValidacion = validarPasos(pasosRaw);
  if (!pasosValidacion.valido) {
    mostrarNotificacion(pasosValidacion.mensaje, 'error');
    DOM.pasos?.focus();
    return;
  }

  const videoValidacion = validarVideo(videoUrl);
  if (!videoValidacion.valido) {
    mostrarNotificacion(videoValidacion.mensaje, 'error');
    DOM.video?.focus();
    return;
  }

  if (imagenSeleccionada) {
    const imagenValidacion = validarImagen(imagenSeleccionada);
    if (!imagenValidacion.valido) {
      mostrarNotificacion(imagenValidacion.mensaje, 'error');
      return;
    }
  }

  // Convertir imagen a Base64
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

  // Datos a enviar
  const puntosGanados = esPremium ? 30 : 15;
  
  const datos = {
    titulo: tituloValidacion.valor,
    ingredientes: ingredientesValidacion.valor,
    pasos: pasosValidacion.valor,
    precio: precioValidacion.valor,
    precioNumerico: precioValidacion.valorNumerico,
    tiempo: tiempoValidacion.valor,
    tiempoNumerico: tiempoValidacion.valorNumerico,
    imagen: imagenBase64,
    video_url: videoValidacion.valor,
    es_premium_receta: esPremium,
    etiquetas: []
  };

  // Deshabilitar botón durante el envío
  if (DOM.publicarBtn) {
    DOM.publicarBtn.disabled = true;
    DOM.publicarBtn.textContent = 'Publicando...';
  }

  try {
    const res = await fetch(`${API}/api/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenActual}`
      },
      body: JSON.stringify(datos)
    });

    const data = await res.json();

    if (res.ok) {
      mostrarNotificacion(
        `¡Receta publicada! Ganaste ${puntosGanados} puntos ${esPremium ? '✨ (Premium)' : ''} 🎁`,
        'success'
      );
      
      // Limpiar formulario
      if (DOM.titulo) DOM.titulo.value = '';
      if (DOM.ingredientes) DOM.ingredientes.value = '';
      if (DOM.pasos) DOM.pasos.value = '';
      if (DOM.precio) DOM.precio.value = '';
      if (DOM.tiempo) DOM.tiempo.value = '';
      if (DOM.video) DOM.video.value = '';
      if (DOM.esPremiumReceta) DOM.esPremiumReceta.checked = false;
      if (DOM.imagenInput) DOM.imagenInput.value = '';
      if (DOM.imagePreview) DOM.imagePreview.style.display = 'none';
      if (DOM.previewImg) DOM.previewImg.src = '';
      imagenSeleccionada = null;
      
      // Limpiar vista previa de video
      const videoPreview = document.getElementById('video-preview');
      if (videoPreview) {
        videoPreview.innerHTML = '';
        videoPreview.classList.remove('active');
      }
      
      // Recargar puntos
      await cargarPuntosUsuario();
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 2500);
    } else {
      mostrarNotificacion(data.error || 'Error al publicar la receta', 'error');
    }
  } catch (err) {
    console.error('Error en la petición:', err);
    mostrarNotificacion('No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.', 'error');
  } finally {
    if (DOM.publicarBtn) {
      DOM.publicarBtn.disabled = false;
      DOM.publicarBtn.textContent = 'Publicar receta →';
    }
  }
}

// ================================================
// CONFIGURACIÓN DE IMAGEN
// ================================================

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
        if (DOM.previewImg) DOM.previewImg.src = event.target.result;
        if (DOM.imagePreview) DOM.imagePreview.style.display = 'flex';
        mostrarNotificacion('Imagen cargada correctamente', 'success');
      };
      reader.readAsDataURL(file);
    } else if (file) {
      mostrarNotificacion('Por favor selecciona un archivo de imagen válido', 'error');
      imagenSeleccionada = null;
    }
  });
  
  if (DOM.removeImageBtn) {
    DOM.removeImageBtn.addEventListener('click', () => {
      imagenSeleccionada = null;
      if (DOM.imagenInput) DOM.imagenInput.value = '';
      if (DOM.imagePreview) DOM.imagePreview.style.display = 'none';
      if (DOM.previewImg) DOM.previewImg.src = '';
      mostrarNotificacion('Imagen eliminada', 'info');
    });
  }
}

// ================================================
// VALIDACIÓN EN TIEMPO REAL
// ================================================

function setupValidacionTiempoReal() {
  // Validar título mientras se escribe
  if (DOM.titulo) {
    DOM.titulo.addEventListener('input', () => {
      if (DOM.titulo.value.length > 0 && DOM.titulo.value.length < 3) {
        DOM.titulo.style.borderColor = '#ff9800';
      } else if (DOM.titulo.value.length >= 3) {
        DOM.titulo.style.borderColor = '#4caf50';
      } else {
        DOM.titulo.style.borderColor = '#e0e0e0';
      }
    });
  }
  
  // Mostrar puntos según selección Premium
  if (DOM.esPremiumReceta) {
    DOM.esPremiumReceta.addEventListener('change', () => {
      const puntosInfo = document.querySelector('.puntos-info');
      if (DOM.esPremiumReceta.checked) {
        if (puntosInfo) {
          puntosInfo.style.background = 'linear-gradient(135deg, #fff3e0, #ffe0b2)';
        }
        mostrarNotificacion('✨ Receta Premium: Ganarás 30 puntos + 3 días Premium gratis', 'success');
      } else {
        if (puntosInfo) {
          puntosInfo.style.background = 'linear-gradient(135deg, #e8f5e9, #c8e6c9)';
        }
      }
    });
  }
}

// ================================================
// INICIALIZACIÓN
// ================================================

async function init() {
  // Verificar autenticación
  token = localStorage.getItem('token');
  if (!token) {
    mostrarNotificacion('Debes iniciar sesión para publicar recetas', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return;
  }
  
  // Cargar puntos del usuario
  await cargarPuntosUsuario();
  
  // Configurar eventos
  setupImageUpload();
  setupValidacionTiempoReal();
  
  if (DOM.publicarBtn) {
    DOM.publicarBtn.addEventListener('click', publicarReceta);
  }
  
  // Permitir enviar con Ctrl+Enter
  const textareas = [DOM.ingredientes, DOM.pasos];
  textareas.forEach(textarea => {
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          publicarReceta();
        }
      });
    }
  });
  
  console.log('✅ subir-receta.js inicializado correctamente');
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}