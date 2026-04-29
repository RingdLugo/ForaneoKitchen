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
  currentUser = {
    id: userId,
    es_premium: localStorage.getItem('userPremium') === 'true',
    puntos: parseInt(localStorage.getItem('userPuntos') || 0),
    rol: localStorage.getItem('userRol'),
    username: localStorage.getItem('userName')
  };
  if (puntosMonto) puntosMonto.textContent = currentUser.puntos || 0;
  if (currentUser.es_premium) {
    freeRestriction.style.display = 'none';
    premiumForm.style.display = 'block';
    return true;
  } else {
    freeRestriction.style.display = 'block';
    premiumForm.style.display = 'none';
    return false;
  }
}

// Publicar receta
async function publicarReceta() {
  if (!currentUser?.es_premium) { mostrarNotificacion('Solo Premium', 'error'); return; }
  const tV = validarTitulo(tituloInput.value); if (!tV.valido) { mostrarNotificacion(tV.mensaje, 'error'); return; }
  const pV = validarPrecio(precioInput.value); if (!pV.valido) { mostrarNotificacion(pV.mensaje, 'error'); return; }
  const tiV = validarTiempo(tiempoInput.value); if (!tiV.valido) { mostrarNotificacion(tiV.mensaje, 'error'); return; }
  const iV = validarIngredientes(ingredientesTextarea.value); if (!iV.valido) { mostrarNotificacion(iV.mensaje, 'error'); return; }
  const paV = validarPasos(pasosTextarea.value); if (!paV.valido) { mostrarNotificacion(paV.mensaje, 'error'); return; }
  
  const esPremiumReceta = esPremiumCheckbox?.checked || false;
  const youtubeId = extractYouTubeId(videoInput?.value);
  
  publicarBtn.disabled = true;
  publicarBtn.textContent = 'Publicando...';
  
  try {
    const { data: receta, error: insertError } = await supabase.from('recetas').insert({
      titulo: tV.valor, ingredientes: iV.valor, pasos: paV.valor,
      precio: pV.valor, precio_numerico: pV.valorNumerico,
      tiempo: tiV.valor, tiempo_numerico: tiV.valorNumerico,
      video_youtube: youtubeId, video_url: videoInput?.value,
      es_premium: esPremiumReceta, autor: currentUser.username,
      usuario_id: currentUser.id, likes: 0, fecha: new Date().toISOString()
    }).select().single();
    
    if (insertError) throw insertError;
    
    if (imagenSeleccionada) {
      const imgUrl = await uploadImage(imagenSeleccionada, currentUser.id, receta.id);
      if (imgUrl) await supabase.from('recetas').update({ imagen: imgUrl }).eq('id', receta.id);
    }
    
    if (videoSeleccionado && currentUser.es_premium) {
      const vidUrl = await uploadVideo(videoSeleccionado, currentUser.id, receta.id);
      if (vidUrl) await supabase.from('recetas').update({ video_url: vidUrl }).eq('id', receta.id);
    }
    
    const pts = esPremiumReceta ? 30 : 20;
    const nPts = (currentUser.puntos || 0) + pts;
    await supabase.from('usuarios').update({ puntos: nPts }).eq('id', currentUser.id);
    await supabase.from('puntos_log').insert({ usuario_id: currentUser.id, accion: 'subir_receta', puntos: pts, descripcion: `Receta: ${tV.valor}` });
    
    mostrarNotificacion(`✅ ¡Receta publicada! +${pts} pts`, 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 2000);
  } catch (error) {
    console.error(error);
    mostrarNotificacion('Error al publicar', 'error');
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