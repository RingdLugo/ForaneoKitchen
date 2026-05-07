// login.js — ForaneoKitchen (Multi-step Premium Flow)
const API_BASE = (() => {
  const origin = window.location.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:3000/api';
  }
  return origin + '/api';
})();

// ── DOM ──────────────────────────────────────────────────────
const loginBox    = document.getElementById('login-box');
const registroBox = document.getElementById('registro-box');
const loginBtn    = document.getElementById('login-btn');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink    = document.getElementById('show-login');

// Steps
const regStep1 = document.getElementById('reg-step-1');
const regStep2 = document.getElementById('reg-step-2');
const regStep3 = document.getElementById('reg-step-3');

// Buttons
const nextStepBtn = document.getElementById('next-step-btn');
const btnChooseFree = document.getElementById('btn-choose-free');
const btnChoosePremium = document.getElementById('btn-choose-premium');
const finalizeRegBtn = document.getElementById('finalize-reg-btn');

let currentAction = 'login';
let selectedPremium = false;

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'error') {
  const existing = document.querySelector('.custom-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `custom-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Alternar vistas ───────────────────────────────────────────
function showLoginBox() {
  loginBox.style.display    = 'block';
  registroBox.style.display = 'none';
  currentAction = 'login';
}
function showRegistroBox() {
  loginBox.style.display    = 'none';
  registroBox.style.display = 'block';
  regStep1.style.display = 'block';
  regStep2.style.display = 'none';
  regStep3.style.display = 'none';
  currentAction = 'register';
}

showRegisterLink?.addEventListener('click', e => { e.preventDefault(); showRegistroBox(); });
showLoginLink?.addEventListener('click',    e => { e.preventDefault(); showLoginBox(); });

// ── Multi-Step Logic ─────────────────────────────────────────

nextStepBtn?.addEventListener('click', () => {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (!nombre || !email || !username || !password || !confirm) {
    return showToast('Todos los campos son obligatorios', 'error');
  }
  if (password !== confirm) return showToast('Las contraseñas no coinciden', 'error');
  
  regStep1.style.display = 'none';
  regStep2.style.display = 'block';
});

btnChooseFree?.addEventListener('click', () => {
  selectedPremium = false;
  registerUser(); // Registrar directo como Free
});

btnChoosePremium?.addEventListener('click', () => {
  selectedPremium = true;
  regStep2.style.display = 'none';
  regStep3.style.display = 'block';
});

finalizeRegBtn?.addEventListener('click', () => {
  const cardName = document.getElementById('card-name').value.trim();
  const cardNumber = document.getElementById('card-number').value.trim();
  
  if (!cardName || cardNumber.length < 16) {
    return showToast('Datos de tarjeta inválidos', 'error');
  }

  // Simulación de validación Stripe/Banco
  finalizeRegBtn.disabled = true;
  finalizeRegBtn.textContent = 'Procesando pago... ⌛';
  
  setTimeout(() => {
    showToast('💳 Tarjeta válida, cobro exitoso ($30 MXN)', 'success');
    registerUser();
  }, 2000);
});

// ── REGISTRO FINAL ────────────────────────────────────────────
async function registerUser() {
  const nombre    = document.getElementById('reg-nombre').value.trim();
  const apellido  = document.getElementById('reg-apellido').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const username  = document.getElementById('reg-username').value.trim();
  const password  = document.getElementById('reg-password').value;
  const confirm   = document.getElementById('reg-confirm').value;

  try {
    const res = await fetch(`${API_BASE}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nombre, apellido, email, username, password, 
        confirmPassword: confirm, 
        esPremium: selectedPremium 
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar');

    showToast(`✅ Cuenta creada! Verifica tu email: ${email}`, 'success');
    localStorage.setItem('verifyEmail', email);
    setTimeout(() => { window.location.href = 'verificar.html'; }, 1500);

  } catch (err) {
    showToast(err.message, 'error');
    finalizeRegBtn.disabled = false;
    finalizeRegBtn.textContent = 'Pagar y Registrarse 🔒';
  }
}

// ── LOGIN ─────────────────────────────────────────────────────
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    return showToast('Faltan credenciales', 'error');
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Validando...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de login');

    // Guardar sesión
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userName', data.user.username);
    
    showToast('🚀 ¡Bienvenido!', 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 1000);
  } catch (err) {
    showToast(err.message, 'error');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar Sesión →';
  }
}

loginBtn?.addEventListener('click', login);