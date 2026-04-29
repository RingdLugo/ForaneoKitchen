// subir-receta.js - Subir recetas con Supabase Storage
import { supabase } from './supabaseClient.js';

// Elementos DOM
const freeRestriction = document.getElementById('free-restriction');
const premiumForm = document.getElementById('premium-form');
const puntosMonto = document.getElementById('puntos-monto');
const tituloInput = document.getElementById('titulo');
const precioInput = document.getElementById('precio');
const tiempoInput = document.getElementById('tiempo');
const ingredientesTextarea = document.getElementById('ingredientes');
const pasosTextarea = document.getElementById('pasos');
const videoInput = document.getElementById('video');
const imagenInput = document.getElementById('receta-imagen');
const esPremiumCheckbox = document.getElementById('es-premium-receta');
const publicarBtn = document.getElementById('publicar-btn');
const upgradeBtn = document.getElementById('upgrade-btn');

// Estado
let currentUser = null;
let imagenSeleccionada = null;
let videoSeleccionado = null;

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

// Subir imagen a Supabase Storage
async function uploadImage(file, userId, recipeId) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${recipeId}/${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage.from('recetas-imagenes').upload(fileName, file);
  if (error) return null;
  const { data: { publicUrl } } = supabase.storage.from('recetas-imagenes').getPublicUrl(fileName);
  return publicUrl;
}

// Subir video a Supabase Storage
async function uploadVideo(file, userId, recipeId) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${recipeId}/video-${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage.from('recetas-videos').upload(fileName, file);
  if (error) return null;
  const { data: { publicUrl } } = supabase.storage.from('recetas-videos').getPublicUrl(fileName);
  return publicUrl;
}

// Validaciones
function validarTitulo(titulo) {
  if (!titulo || titulo.trim().length < 3) return { valido: false, mensaje: 'El título debe tener al menos 3 caracteres' };
  return { valido: true, valor: titulo.trim() };
}
function validarPrecio(precio) {
  if (!precio) return { valido: false, mensaje: 'El costo es obligatorio' };
  const numeros = precio.replace(/[^0-9]/g, '');
  if (!numeros) return { valido: false, mensaje: 'El costo debe ser un número' };
  return { valido: true, valor: `$${numeros} MXN`, valorNumerico: parseInt(numeros) };
}
function validarTiempo(tiempo) {
  if (!tiempo) return { valido: false, mensaje: 'El tiempo es obligatorio' };
  const numeros = tiempo.replace(/[^0-9]/g, '');
  if (!numeros) return { valido: false, mensaje: 'El tiempo debe ser un número' };
  return { valido: true, valor: `${numeros} min`, valorNumerico: parseInt(numeros) };
}
function validarIngredientes(ingredientes) {
  if (!ingredientes || ingredientes.trim() === '') return { valido: false, mensaje: 'Ingredientes obligatorios' };
  return { valido: true, valor: ingredientes.trim() };
}
function validarPasos(pasos) {
  if (!pasos || pasos.trim() === '') return { valido: false, mensaje: 'Pasos obligatorios' };
  return { valido: true, valor: pasos.trim() };
}

// Verificar sesión
async function verificarSesion() {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  if (!userId || !token) { window.location.href = 'login.html'; return false; }
  
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.clear();
      window.location.href = 'login.html';
      return false;
    }
    currentUser = await res.json();
    const isPremium = currentUser.es_premium || currentUser.esPremium;
    
    // Sincronizar puntos en la UI
    if (puntosMonto) puntosMonto.textContent = currentUser.puntos || 0;
    
    // Siempre mostrar el formulario
    if (premiumForm) premiumForm.style.display = 'block';

    // Restringir video si no es premium
    if (!isPremium) {
      if (videoInput) {
        videoInput.disabled = true;
        videoInput.placeholder = "🔒 Solo disponible para Premium";
      }
      const videoSection = document.getElementById('video-section');
      if (videoSection) videoSection.style.opacity = '0.6';
      const videoHint = document.getElementById('video-hint');
      if (videoHint) videoHint.innerHTML = "🌟 ¡Hazte Premium para subir videos de tus recetas!";
      
      // Permitir marcar como Premium aunque sea Free (para ganar más puntos)
      const premiumCheckboxLabel = document.querySelector('.checkbox-premium');
      if (premiumCheckboxLabel) {
        premiumCheckboxLabel.style.display = 'flex';
        premiumCheckboxLabel.style.opacity = '1';
      }
      const premiumCheckboxHint = premiumCheckboxLabel?.nextElementSibling;
      if (premiumCheckboxHint && premiumCheckboxHint.classList.contains('input-hint')) {
        premiumCheckboxHint.style.display = 'block';
        premiumCheckboxHint.innerHTML = "✨ Las recetas Premium te dan <strong>30 puntos</strong> (pero no podrás subir video)";
      }
    }

    return true;
  } catch (e) {
    console.error('Error verificando sesión:', e);
    return false;
  }
}

// Publicar receta
async function publicarReceta() {
  if (!currentUser) { mostrarNotificacion('Debes iniciar sesión', 'error'); return; }
  const tV = validarTitulo(tituloInput.value); if (!tV.valido) { mostrarNotificacion(tV.mensaje, 'error'); return; }
  const pV = validarPrecio(precioInput.value); if (!pV.valido) { mostrarNotificacion(pV.mensaje, 'error'); return; }
  const tiV = validarTiempo(tiempoInput.value); if (!tiV.valido) { mostrarNotificacion(tiV.mensaje, 'error'); return; }
  const iV = validarIngredientes(ingredientesTextarea.value); if (!iV.valido) { mostrarNotificacion(iV.mensaje, 'error'); return; }
  const paV = validarPasos(pasosTextarea.value); if (!paV.valido) { mostrarNotificacion(paV.mensaje, 'error'); return; }
  
  const esPremiumReceta = esPremiumCheckbox?.checked || false;
  const youtubeId = extractYouTubeId(videoInput?.value);
  
  // Recopilar etiquetas
  const etiquetas = Array.from(document.querySelectorAll('#receta-etiquetas input:checked')).map(cb => cb.value);
  
  publicarBtn.disabled = true;
  publicarBtn.textContent = 'Publicando...';
  
  try {
    let finalImage = null;
    if (imagenSeleccionada) {
      finalImage = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(imagenSeleccionada);
      });
    }

    let videoUrl = videoInput?.value || null;
    let videoYoutubeId = youtubeId;

    // Si hay archivo de video, subirlo (solo Premium)
    if (videoSeleccionado && (currentUser.es_premium || currentUser.esPremium)) {
      mostrarNotificacion('Subiendo video...', 'info');
      // Subir a Storage y obtener URL
      const fileName = `${currentUser.id}/${Date.now()}-${videoSeleccionado.name}`;
      const { data, error: uploadError } = await supabase.storage.from('recetas-videos').upload(fileName, videoSeleccionado);
      if (uploadError) {
        console.warn('Error subiendo video a storage:', uploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage.from('recetas-videos').getPublicUrl(fileName);
        videoUrl = publicUrl;
        videoYoutubeId = null; // Priorizar archivo sobre URL si ambos existen
      }
    }

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        titulo: tV.valor,
        ingredientes: iV.valor,
        pasos: paV.valor,
        precio: pV.valor,
        precioNumerico: pV.valorNumerico,
        tiempo: tiV.valor,
        tiempoNumerico: tiV.valorNumerico,
        imagen: finalImage,
        videoUrl: videoUrl,
        videoYoutube: videoYoutubeId,
        esPremium: esPremiumReceta,
        etiquetas: etiquetas
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al publicar');
    }

    const receta = await res.json();
    
    // El backend ya debería haber otorgado los puntos por la receta.
    // Pero si el frontend manejaba algo manual, lo quitamos para centralizar.
    
    mostrarNotificacion(`✅ ¡Receta publicada!`, 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 2000);
  } catch (error) {
    console.error(error);
    mostrarNotificacion('Error: ' + error.message, 'error');
  } finally {
    publicarBtn.disabled = false;
    publicarBtn.textContent = 'Publicar receta →';
  }
}

function setupImageUpload() {
  if (!imagenInput) return;
  imagenInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      imagenSeleccionada = file;
      const reader = new FileReader();
      reader.onload = ev => {
        const pImg = document.getElementById('preview-img');
        const pDiv = document.getElementById('image-preview');
        if (pImg) pImg.src = ev.target.result;
        if (pDiv) pDiv.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }
  });
}

function setupVideoUpload() {
  if (!videoInput) return;
  videoInput.addEventListener('change', e => {
    const val = e.target.value.trim();
    const uploadArea = document.getElementById('video-upload-area');
    if (val && !val.startsWith('http')) {
      if (uploadArea) uploadArea.style.display = 'block';
    } else {
      if (uploadArea) uploadArea.style.display = 'none';
      const yid = extractYouTubeId(val);
      const prev = document.getElementById('video-preview');
      if (yid && prev) {
        prev.innerHTML = `<iframe width="100%" height="180" src="https://www.youtube.com/embed/${yid}" frameborder="0" allowfullscreen></iframe>`;
      } else if (prev) prev.innerHTML = '';
    }
  });
  const vFile = document.getElementById('video-file');
  if (vFile) {
    vFile.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('video/')) {
        videoSeleccionado = file;
        const prev = document.getElementById('video-preview');
        if (prev) {
          prev.innerHTML = `<video src="${URL.createObjectURL(file)}" controls style="width:100%; border-radius:12px;"></video>`;
        }
      }
    });
  }
}

async function init() {
  const ok = await verificarSesion();
  if (ok) {
    setupImageUpload();
    setupVideoUpload();
    publicarBtn?.addEventListener('click', publicarReceta);
  }
  upgradeBtn?.addEventListener('click', () => { window.location.href = 'perfil.html'; });
}
init();