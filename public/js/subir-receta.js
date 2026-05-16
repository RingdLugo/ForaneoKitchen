// subir-receta.js
import { supabase } from './supabaseClient.js';

const premiumForm = document.getElementById('premium-form');
const puntosMonto = document.getElementById('puntos-monto');
const tituloInput = document.getElementById('titulo');
const precioInput = document.getElementById('precio');
const tiempoInput = document.getElementById('tiempo');
const porcionesInput = document.getElementById('porciones');
const ingredientesTextarea = document.getElementById('ingredientes');
const pasosTextarea = document.getElementById('pasos');
const imagenInput = document.getElementById('receta-imagen');
const esPremiumCheckbox = document.getElementById('es-premium-receta');
const publicarBtn = document.getElementById('publicar-btn');

const videoYoutubeInput = document.getElementById('video-youtube');
const videoFileInput = document.getElementById('video-file');
const optYoutube = document.getElementById('opt-youtube');
const optFile = document.getElementById('opt-file');
const youtubeArea = document.getElementById('youtube-input-area');
const fileArea = document.getElementById('file-input-area');
const videoPreviewContainer = document.getElementById('video-preview-container');
const videoPreviewPlayer = document.getElementById('video-preview-player');
const removeVideoBtn = document.getElementById('remove-video-btn');

const addTagBtn = document.getElementById('add-tag-btn');
const customTagInput = document.getElementById('custom-tag-input');
const selectedCustomTagsDiv = document.getElementById('selected-custom-tags');

let currentUser = null;
let imagenSeleccionada = null;
let videoSeleccionado = null;
let customTags = [];
let editRecipeId = new URLSearchParams(window.location.search).get('edit');

function mostrarNotificacion(mensaje, tipo = 'success') {
  const notificacion = document.createElement('div');
  notificacion.className = `temp-notification ${tipo}`;

  const iconName = tipo === 'success' ? 'check-circle' : (tipo === 'error' ? 'alert-circle' : 'info');
  notificacion.innerHTML = `<i data-lucide="${iconName}"></i> <span>${mensaje}</span>`;

  document.body.appendChild(notificacion);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  setTimeout(() => notificacion.classList.add('show'), 10);
  setTimeout(() => {
    notificacion.classList.remove('show');
    setTimeout(() => notificacion.remove(), 300);
  }, 3000);
}

function extractYouTubeId(url) {
  if (!url || url.trim() === '') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const PROFANITY = ['puto', 'puta', 'mierda', 'pendejo', 'pendeja', 'culero', 'cabron', 'chinga', 'verga', 'pito', 'fuck', 'shit', 'asshole', 'idiota', 'estupido'];

const VALIDAR = {
  isInvalid: (s) => {
    if (!s) return false;
    const lower = s.toLowerCase();
    const isOffensive = PROFANITY.some(word => lower.includes(word));
    const isGibberish = s.length > 10 && !/[aeiouáéíóúü]/i.test(s);
    const isRepeated = /(.)\1{4,}/.test(s);
    return isOffensive || isGibberish || isRepeated;
  }
};

const validar = {
  titulo: (t) => {
    const val = t?.trim();
    if (!val || val.length < 5) return { v: false, m: 'El título es muy corto (mín 5 letras)' };
    if (VALIDAR.isInvalid(val)) return { v: false, m: 'Título inapropiado o incoherente' };
    if (!/[aeiouáéíóú]/i.test(val)) return { v: false, m: 'Título inválido (sin vocales)' };
    return { v: true, val };
  },
  precio: (p) => {
    const n = p?.toString().replace(/[^0-9]/g, '');
    const num = parseInt(n);
    if (!n || isNaN(num) || num <= 0) return { v: false, m: 'Costo inválido (mín $1)' };
    return { v: true, val: `$${n} MXN`, num };
  },
  tiempo: (t) => {
    const n = t?.toString().replace(/[^0-9]/g, '');
    const num = parseInt(n);
    if (!n || isNaN(num) || num < 1 || num > 1440) return { v: false, m: 'Tiempo inválido (1-1440 min)' };
    return { v: true, val: `${n} min`, num };
  },
  porciones: (p) => {
    const val = p?.trim();
    if (!val || val.length < 1) return { v: false, m: 'Indica las porciones' };
    if (VALIDAR.isInvalid(val)) return { v: false, m: 'Porciones inválidas' };
    return { v: true, val };
  },
  ingredientes: (i) => {
    const val = i?.trim();
    if (!val || val.length < 10) return { v: false, m: 'Lista de ingredientes muy corta' };
    if (VALIDAR.isInvalid(val)) return { v: false, m: 'Ingredientes inapropiados o incoherentes' };
    const units = /gramos|kg|ml|litro|taza|pieza|cucharada|pisca|sobre|diente|cebolla|sal|pimienta|aceite|agua|leche|huevo|harina|azúcar/i;
    if (!/[0-9]/.test(val) && !units.test(val)) return { v: false, m: 'Ingredientes incompletos (agrega cantidades o medidas)' };
    return { v: true, val };
  },
  pasos: (s) => {
    const val = s?.trim();
    if (!val || val.length < 20) return { v: false, m: 'Pasos de preparación muy cortos' };
    if (VALIDAR.isInvalid(val)) return { v: false, m: 'Pasos inapropiados o incoherentes' };
    const verbs = /mezclar|cocinar|picar|hervir|freir|hornear|servir|agregar|calentar|cortar|limpiar|batir|asar/i;
    if (!verbs.test(val) && !/[0-9]\.?\s/.test(val)) return { v: false, m: 'Instrucciones poco claras. Usa pasos numerados o verbos de cocina.' };
    return { v: true, val };
  }
};

async function verificarSesion() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return false; }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { window.location.href = 'login.html'; return false; }
    currentUser = await res.json();
    if (puntosMonto) puntosMonto.textContent = currentUser.puntos || 0;
    if (premiumForm) premiumForm.style.display = 'block';

    const isPremium = currentUser.es_premium || currentUser.rol === 'premium' || currentUser.rol === 'admin';

    if (!isPremium) {
      if (optYoutube) {
        optYoutube.disabled = true;
        optYoutube.title = 'Solo usuarios Premium pueden agregar videos';
        optYoutube.style.opacity = '0.5';
      }
      if (optFile) {
        optFile.disabled = true;
        optFile.title = 'Solo usuarios Premium pueden subir videos';
        optFile.style.opacity = '0.5';
      }

      const premiumCheckboxContainer = document.querySelector('.checkbox-group');
      if (premiumCheckboxContainer) premiumCheckboxContainer.style.display = 'none';

      const videoSection = document.getElementById('video-section');
      if (videoSection) {
        videoSection.innerHTML = `
          <label><i data-lucide="video"></i> Video de la receta (solo Premium <i data-lucide="crown"></i>)</label>
          <div style="background: #FDFBF7; border: 1px solid #F2CC8F; border-radius: 12px; padding: 15px; text-align: center; margin-top: 5px;">
            <p style="margin: 0; color: #E07A5F; font-size: 0.9rem; font-weight: 500;">
              <i data-lucide="lock" style="width:14px;height:14px;"></i> Los videos son una función exclusiva para usuarios <strong>Premium</strong>.
            </p>
            <button type="button" onclick="window.location.href='perfil.html'" style="margin-top: 10px; padding: 8px 18px; background: #E07A5F; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display:inline-flex; align-items:center; gap:6px;">Mejorar cuenta <i data-lucide="crown" style="width:14px;height:14px;"></i></button>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }

    if (editRecipeId) {
      document.getElementById('form-title').innerHTML = '<i data-lucide="edit-3"></i> Editar receta';
      document.getElementById('form-desc').textContent = 'Actualiza los detalles de tu creación culinaria';
      publicarBtn.innerHTML = 'Guardar cambios <i data-lucide="arrow-right" style="width:18px;"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    return true;
  } catch (e) { return false; }
}

async function cargarDatosEdicion(id) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/recipes/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No se pudo cargar la receta');
    const r = await res.json();

    document.getElementById('form-title').textContent = '✏️ Editar receta';
    document.getElementById('form-desc').textContent = 'Actualiza los detalles de tu creación culinaria';
    publicarBtn.textContent = 'Guardar cambios →';

    tituloInput.value = r.titulo;
    precioInput.value = r.precio_numerico || r.precio?.replace(/[^0-9]/g, '') || '';
    tiempoInput.value = r.tiempo_numerico || r.tiempo?.replace(/[^0-9]/g, '') || '';
    if (porcionesInput) porcionesInput.value = r.porciones || '';
    ingredientesTextarea.value = r.ingredientes;
    pasosTextarea.value = r.pasos;
    if (esPremiumCheckbox) esPremiumCheckbox.checked = r.es_premium;

    if (Array.isArray(r.etiquetas)) {
      r.etiquetas.forEach(t => {
        const cb = document.querySelector(`#receta-etiquetas input[value="${t}"]`);
        if (cb) cb.checked = true;
        else {
          customTags.push(t);
        }
      });
      renderCustomTags();
    }

    if (r.imagen) {
      document.getElementById('preview-img').src = r.imagen;
      document.getElementById('image-preview').style.display = 'flex';
    }

    const isPremium = currentUser.es_premium || currentUser.rol === 'premium' || currentUser.rol === 'admin';
    if (isPremium) {
      if (r.video_youtube) {
        videoYoutubeInput.value = `https://www.youtube.com/watch?v=${r.video_youtube}`;
        optYoutube.click();
      } else if (r.video_url) {
        videoPreviewPlayer.src = r.video_url;
        videoPreviewContainer.style.display = 'block';
        optFile.click();
      }
    }
  } catch (e) {
    mostrarNotificacion(e.message, 'error');
  }
}

addTagBtn?.addEventListener('click', () => {
  const tag = customTagInput.value.trim().toLowerCase();
  if (!tag) return;

  if (tag.length < 3) {
    mostrarNotificacion('La categoría debe tener al menos 3 letras', 'error');
    return;
  }

  if (VALIDAR.isInvalid(tag)) {
    mostrarNotificacion('Nombre de categoría inapropiado o incoherente', 'error');
    return;
  }

  if (customTags.includes(tag)) {
    mostrarNotificacion('Esa categoría ya está agregada', 'error');
    return;
  }
  customTags.push(tag);
  renderCustomTags();
  customTagInput.value = '';
});

function renderCustomTags() {
  selectedCustomTagsDiv.innerHTML = customTags.map(tag => `
    <span class="recipe-tag" style="background:#F4F1DE; color:#E07A5F; padding:5px 12px; border-radius:20px; font-size:0.8rem; display:flex; align-items:center; gap:8px; border: 1px solid #F2CC8F;">
      ${tag} <i data-lucide="x" onclick="window.removeTag('${tag}')" style="width:14px;height:14px;cursor:pointer"></i>
    </span>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.removeTag = (tag) => {
  customTags = customTags.filter(t => t !== tag);
  renderCustomTags();
};

optYoutube?.addEventListener('click', () => {
  const isPremium = currentUser?.es_premium || currentUser?.rol === 'premium' || currentUser?.rol === 'admin';
  if (!isPremium) {
    mostrarNotificacion('Los videos son exclusivos Premium', 'error');
    return;
  }
  optYoutube.classList.add('active');
  optFile.classList.remove('active');
  youtubeArea.style.display = 'block';
  fileArea.style.display = 'none';
});

optFile?.addEventListener('click', () => {
  const isPremium = currentUser?.es_premium || currentUser?.rol === 'premium' || currentUser?.rol === 'admin';
  if (!isPremium) {
    mostrarNotificacion('La subida de archivos es exclusiva Premium', 'error');
    return;
  }
  optFile.classList.add('active');
  optYoutube.classList.remove('active');
  fileArea.style.display = 'block';
  youtubeArea.style.display = 'none';
});

videoFileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const MAX_SIZE = 2000 * 1024 * 1024; // 2GB
    if (file.size > MAX_SIZE) {
      mostrarNotificacion('El video es demasiado grande (máx 2GB). Intenta comprimirlo o usa YouTube.', 'error');
      return;
    }
    videoSeleccionado = file;
    videoPreviewPlayer.src = URL.createObjectURL(file);
    videoPreviewContainer.style.display = 'block';
  }
});

removeVideoBtn?.addEventListener('click', () => {
  videoSeleccionado = null;
  videoFileInput.value = '';
  videoPreviewContainer.style.display = 'none';
  videoPreviewPlayer.src = '';
});

async function publicarReceta() {
  const vTitulo = validar.titulo(tituloInput.value);
  const vPrecio = validar.precio(precioInput.value);
  const vTiempo = validar.tiempo(tiempoInput.value);
  const vPorc = validar.porciones(porcionesInput.value);
  const vIngred = validar.ingredientes(ingredientesTextarea.value);
  const vPasos = validar.pasos(pasosTextarea.value);

  if (!vTitulo.v) return mostrarNotificacion(vTitulo.m, 'error');
  if (!vIngred.v) return mostrarNotificacion(vIngred.m, 'error');
  if (!vPasos.v) return mostrarNotificacion(vPasos.m, 'error');
  if (!vTiempo.v) return mostrarNotificacion(vTiempo.m, 'error');
  if (!vPorc.v) return mostrarNotificacion(vPorc.m, 'error');
  if (!vPrecio.v) return mostrarNotificacion(vPrecio.m, 'error');

  const ingredientes = vIngred.val;
  const pasos = vPasos.val;

  const selectedTags = Array.from(document.querySelectorAll('#receta-etiquetas input:checked')).map(cb => cb.value);
  const allTags = [...new Set([...selectedTags, ...customTags])];

  publicarBtn.disabled = true;
  publicarBtn.innerHTML = editRecipeId ? 'Guardando... <i data-lucide="loader" class="spin"></i>' : 'Publicando... <i data-lucide="loader" class="spin"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  try {
    let finalImage = null;
    if (imagenSeleccionada) {
      finalImage = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = e => r(e.target.result);
        reader.readAsDataURL(imagenSeleccionada);
      });
    } else if (editRecipeId) {
      finalImage = document.getElementById('preview-img').src;
      if (finalImage.includes('placeholder')) finalImage = null;
    }

    let videoUrl = null;
    let videoYoutubeId = extractYouTubeId(videoYoutubeInput?.value);

    const isPremium = currentUser.es_premium || currentUser.rol === 'premium' || currentUser.rol === 'admin';

    if (isPremium && videoSeleccionado && fileArea.style.display === 'block') {
      mostrarNotificacion('Subiendo video...', 'info');
      const fileName = `videos/${currentUser.id}/${Date.now()}-${videoSeleccionado.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('recetas')
        .upload(fileName, videoSeleccionado, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(`Error al subir video: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('recetas').getPublicUrl(fileName);
      videoUrl = publicUrl;
      videoYoutubeId = null;
    } else if (isPremium && editRecipeId && fileArea.style.display === 'block') {
      videoUrl = videoPreviewPlayer.src;
    }

    const payload = {
      titulo: vTitulo.val,
      ingredientes,
      pasos,
      precio: vPrecio.val,
      precioNumerico: vPrecio.num,
      tiempo: vTiempo.val,
      tiempoNumerico: vTiempo.num,
      porciones: vPorc.val,
      imagen: finalImage,
      videoUrl,
      videoYoutube: videoYoutubeId,
      esPremium: esPremiumCheckbox?.checked || false,
      etiquetas: allTags
    };

    const url = editRecipeId ? `/api/recipes/${editRecipeId}` : '/api/recipes';
    const method = editRecipeId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Fallo en el servidor');
    }

    mostrarNotificacion(editRecipeId ? '¡Receta actualizada!' : '¡Receta publicada!', 'success');
    setTimeout(() => window.location.href = editRecipeId ? `receta.html?id=${editRecipeId}` : 'home.html', 2000);

  } catch (error) {
    mostrarNotificacion(error.message, 'error');
    publicarBtn.disabled = false;
    publicarBtn.innerHTML = editRecipeId ? 'Guardar cambios <i data-lucide="arrow-right"></i>' : 'Publicar receta <i data-lucide="arrow-right"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

imagenInput?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) return mostrarNotificacion('Imagen máx 5MB', 'error');
    imagenSeleccionada = file;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('preview-img').src = ev.target.result;
      document.getElementById('image-preview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('remove-image-btn')?.addEventListener('click', () => {
  imagenSeleccionada = null;
  imagenInput.value = '';
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('preview-img').src = '';
});

async function init() {
  if (await verificarSesion()) {
    publicarBtn?.addEventListener('click', publicarReceta);

    // Regla de Mayúscula Inicial Automática (por cada línea)
    const autoCapitalize = (el) => {
      if (!el) return;
      el.addEventListener('input', (e) => {
        let val = e.target.value;
        if (val.length > 0) {
          // Detecta inicio de texto, nueva línea, o letra después de "1. " o "- "
          e.target.value = val.replace(/(^|\n|(?:\d+\.\s+)|(?:-\s+))([a-z])/g, (match, separator, letter) => {
            return separator + letter.toUpperCase();
          });
        }
      });

    };


    autoCapitalize(tituloInput);
    autoCapitalize(ingredientesTextarea);
    autoCapitalize(pasosTextarea);

    // Cargar datos si estamos en modo edición
    if (editRecipeId) {
      cargarDatosEdicion(editRecipeId);
    }
  }
}
init();



// Lógica de ocultado automático de la navegación al scroll
(function() {
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