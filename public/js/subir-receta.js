// subir-receta.js - Subir recetas con Supabase Storage
import { supabase } from './supabaseClient.js';

// Elementos DOM
const premiumForm = document.getElementById('premium-form');
const puntosMonto = document.getElementById('puntos-monto');
const tituloInput = document.getElementById('titulo');
const precioInput = document.getElementById('precio');
const tiempoInput = document.getElementById('tiempo');
const ingredientesTextarea = document.getElementById('ingredientes');
const pasosTextarea = document.getElementById('pasos');
const imagenInput = document.getElementById('receta-imagen');
const esPremiumCheckbox = document.getElementById('es-premium-receta');
const publicarBtn = document.getElementById('publicar-btn');

// Video Elements
const videoYoutubeInput = document.getElementById('video-youtube');
const videoFileInput = document.getElementById('video-file');
const optYoutube = document.getElementById('opt-youtube');
const optFile = document.getElementById('opt-file');
const youtubeArea = document.getElementById('youtube-input-area');
const fileArea = document.getElementById('file-input-area');
const videoPreviewContainer = document.getElementById('video-preview-container');
const videoPreviewPlayer = document.getElementById('video-preview-player');
const removeVideoBtn = document.getElementById('remove-video-btn');

// Tags Elements
const addTagBtn = document.getElementById('add-tag-btn');
const customTagInput = document.getElementById('custom-tag-input');
const selectedCustomTagsDiv = document.getElementById('selected-custom-tags');

// Estado
let currentUser = null;
let imagenSeleccionada = null;
let videoSeleccionado = null;
let customTags = [];

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = 'success') {
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

// Extraer YouTube ID
function extractYouTubeId(url) {
  if (!url || url.trim() === '') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Validaciones
const validar = {
  titulo: (t) => t?.trim().length >= 3 ? { v: true, val: t.trim() } : { v: false, m: 'Título corto (mín 3)' },
  precio: (p) => {
    const n = p?.replace(/[^0-9]/g, '');
    return n ? { v: true, val: `$${n} MXN`, num: parseInt(n) } : { v: false, m: 'Costo numérico' };
  },
  tiempo: (t) => {
    const n = t?.replace(/[^0-9]/g, '');
    return n ? { v: true, val: `${n} min`, num: parseInt(n) } : { v: false, m: 'Tiempo numérico' };
  }
};

// Verificar sesión
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

    const isPremium = currentUser.es_premium || currentUser.rol === 'premium';
    if (!isPremium) {
      optFile.disabled = true;
      optFile.title = "Solo usuarios Premium";
      optFile.style.opacity = '0.5';
    }
    return true;
  } catch (e) { return false; }
}

// ── Manejo de Etiquetas Personalizadas ─────────────────────────────────────────
addTagBtn?.addEventListener('click', () => {
  const tag = customTagInput.value.trim().toLowerCase();
  if (!tag) return;
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
    <span class="recipe-tag" style="background:#e8f5e9; color:#2e7d32; padding:5px 12px; border-radius:20px; font-size:0.8rem; display:flex; align-items:center; gap:5px;">
      ${tag} <b onclick="window.removeTag('${tag}')" style="cursor:pointer">&times;</b>
    </span>
  `).join('');
}

window.removeTag = (tag) => {
  customTags = customTags.filter(t => t !== tag);
  renderCustomTags();
};

// ── Manejo de Video ────────────────────────────────────────────────────────────
optYoutube?.addEventListener('click', () => {
  optYoutube.classList.add('active');
  optFile.classList.remove('active');
  youtubeArea.style.display = 'block';
  fileArea.style.display = 'none';
});

optFile?.addEventListener('click', () => {
  const isPremium = currentUser.es_premium || currentUser.rol === 'premium';
  if (!isPremium) {
    mostrarNotificacion('La subida de archivos es exclusiva Premium 👑', 'error');
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
    // Aumentamos el límite a 2GB para soportar videos de 1-2 horas
    const MAX_SIZE = 2000 * 1024 * 1024; 
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

// ── Publicar ──────────────────────────────────────────────────────────────────
async function publicarReceta() {
  const tV = validar.titulo(tituloInput.value); if (!tV.v) return mostrarNotificacion(tV.m, 'error');
  const pV = validar.precio(precioInput.value); if (!pV.v) return mostrarNotificacion(pV.m, 'error');
  const tiV = validar.tiempo(tiempoInput.value); if (!tiV.v) return mostrarNotificacion(tiV.m, 'error');

  const ingredientes = ingredientesTextarea.value.trim();
  const pasos = pasosTextarea.value.trim();
  if (!ingredientes || !pasos) return mostrarNotificacion('Ingredientes y pasos obligatorios', 'error');

  // Recopilar todas las etiquetas
  const selectedTags = Array.from(document.querySelectorAll('#receta-etiquetas input:checked')).map(cb => cb.value);
  const allTags = [...new Set([...selectedTags, ...customTags])];

  publicarBtn.disabled = true;
  publicarBtn.textContent = 'Publicando...';

  try {
    let finalImage = null;
    if (imagenSeleccionada) {
      finalImage = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = e => r(e.target.result);
        reader.readAsDataURL(imagenSeleccionada);
      });
    }

    let videoUrl = null;
    let videoYoutubeId = extractYouTubeId(videoYoutubeInput.value);

    // Si hay archivo de video, subirlo a Supabase Storage
    if (videoSeleccionado && fileArea.style.display === 'block') {
      mostrarNotificacion('🎥 Iniciando subida de video pesado... Esto puede tomar varios minutos. No cierres la ventana.', 'info');
      
      const fileName = `videos/${currentUser.id}/${Date.now()}-${videoSeleccionado.name.replace(/\s+/g, '_')}`;
      
      // Intentar subir al bucket 'recetas' (asegúrate de que exista y sea público)
      const { data, error: uploadError } = await supabase.storage
        .from('recetas')
        .upload(fileName, videoSeleccionado, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase Storage Error:', uploadError);
        let msg = `Error: ${uploadError.message}`;
        if (uploadError.message.includes('not found')) {
          msg = '⚠️ Error: No existe el contenedor "recetas" en tu Supabase. Por favor, créalo en la sección Storage.';
        }
        throw new Error(msg);
      }

      const { data: { publicUrl } } = supabase.storage.from('recetas').getPublicUrl(fileName);
      videoUrl = publicUrl;
      videoYoutubeId = null;
    }

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        titulo: tV.val,
        ingredientes,
        pasos,
        precio: pV.val,
        precioNumerico: pV.num,
        tiempo: tiV.val,
        tiempoNumerico: tiV.num,
        imagen: finalImage,
        videoUrl: videoUrl,
        videoYoutube: videoYoutubeId,
        esPremium: esPremiumCheckbox?.checked || false,
        etiquetas: allTags
      })
    });

    if (!res.ok) throw new Error('Fallo al publicar en el servidor');
    
    mostrarNotificacion('✅ ¡Receta publicada con éxito!', 'success');
    setTimeout(() => window.location.href = 'home.html', 2000);
  } catch (error) {
    mostrarNotificacion(error.message, 'error');
    publicarBtn.disabled = false;
    publicarBtn.textContent = 'Publicar receta →';
  }
}

// ── Imagen ────────────────────────────────────────────────────────────────────
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
});

async function init() {
  if (await verificarSesion()) {
    publicarBtn?.addEventListener('click', publicarReceta);
  }
}
init();