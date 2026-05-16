// login.js — ForaneoKitchen
const API_BASE = (() => {
  const origin = window.location.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:3000/api';
  }
  return origin + '/api';
})();

const loginBox = document.getElementById('login-box');
const registroBox = document.getElementById('registro-box');
const loginBtn = document.getElementById('login-btn');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const regStep1 = document.getElementById('reg-step-1');
const regStep2 = document.getElementById('reg-step-2');
const regStep3 = document.getElementById('reg-step-3');

const nextStepBtn = document.getElementById('next-step-btn');
const btnChooseFree = document.getElementById('btn-choose-free');
const btnChoosePremium = document.getElementById('btn-choose-premium');
const finalizeRegBtn = document.getElementById('finalize-reg-btn');

let currentAction = 'login';
let selectedPremium = false;

const PROFANITY = ['puto', 'puta', 'mierda', 'pendejo', 'pendeja', 'culero', 'cabron', 'chinga', 'verga', 'pito', 'fuck', 'shit', 'asshole', 'idiota', 'estupido'];

const VALIDAR = {
  isInvalidContent: (s) => {
    if (!s) return false;
    const lower = s.toLowerCase();
    const isOffensive = PROFANITY.some(word => lower.includes(word));
    const isGibberish = s.length > 10 && !/[aeiouáéíóúü]/i.test(s);
    const isRepeated = /(.)\1{4,}/.test(s);
    return isOffensive || isGibberish || isRepeated;
  },
  nombre: (s) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(s) && !VALIDAR.isInvalidContent(s),
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  password: (s) => s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(pass), // Corregido pass -> s
  tarjeta: (s) => {
    const raw = s.replace(/\D/g, '');
    if (raw.length !== 16) return false;
    if (/(\d)\1{15}/.test(raw)) return false;
    if ("1234567890123456789".includes(raw)) return false;
    let sum = 0;
    for (let i = 0; i < raw.length; i++) {
      let intVal = parseInt(raw.substr(i, 1));
      if (i % 2 === 0) {
        intVal *= 2;
        if (intVal > 9) intVal = 1 + (intVal % 10);
      }
      sum += intVal;
    }
    return sum % 10 === 0;
  }
};

function showToast(message, type = 'error') {
  const existing = document.querySelector('.custom-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `custom-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showLoginBox() {
  loginBox.style.display = 'block';
  registroBox.style.display = 'none';
  const guestOpt = document.getElementById('guest-option');
  if (guestOpt) guestOpt.style.display = 'block';
  currentAction = 'login';
}
function showRegistroBox() {
  loginBox.style.display = 'none';
  registroBox.style.display = 'block';
  regStep1.style.display = 'block';
  regStep2.style.display = 'none';
  regStep3.style.display = 'none';
  const guestOpt = document.getElementById('guest-option');
  if (guestOpt) guestOpt.style.display = 'none';
  currentAction = 'register';
}

showRegisterLink?.addEventListener('click', e => { e.preventDefault(); showRegistroBox(); });
showLoginLink?.addEventListener('click', e => { e.preventDefault(); showLoginBox(); });

nextStepBtn?.addEventListener('click', () => {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (!nombre || !apellido || !email || !username || !password || !confirm) {
    return showToast('Todos los campos son obligatorios', 'error');
  }

  if (!VALIDAR.nombre(nombre)) return showToast('Por favor, escribe un nombre válido (solo letras y sin palabras inapropiadas)', 'error');
  if (!VALIDAR.nombre(apellido)) return showToast('Por favor, escribe un apellido válido (solo letras)', 'error');
  if (VALIDAR.isInvalidContent(username)) return showToast('El nombre de usuario contiene palabras no permitidas o es incoherente', 'error');
  if (!VALIDAR.email(email)) return showToast('Escribe un correo electrónico válido (ejemplo@correo.com)', 'error');

  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return showToast('Tu contraseña debe ser más segura: mínimo 8 caracteres, letras y números', 'error');
  }
  if (password !== confirm) return showToast('Las contraseñas no coinciden', 'error');

  regStep1.style.display = 'none';
  regStep2.style.display = 'block';
});

btnChooseFree?.addEventListener('click', () => {
  selectedPremium = false;
  registerUser();
});

btnChoosePremium?.addEventListener('click', () => {
  selectedPremium = true;
  regStep2.style.display = 'none';
  regStep3.style.display = 'block';
});

finalizeRegBtn?.addEventListener('click', () => {
  const cardName = document.getElementById('card-name').value.trim();
  const cardNumber = document.getElementById('card-number').value.trim();
  const cardExp = document.getElementById('card-expiry').value.trim();
  const cardCvv = document.getElementById('card-cvv').value.trim();

  if (!cardName || !VALIDAR.nombre(cardName)) {
    return showToast('Por favor, escribe el nombre completo del titular (solo letras)', 'error');
  }
  if (!VALIDAR.tarjeta(cardNumber)) {
    return showToast('El número de tarjeta no es válido o es demasiado simple. Por favor, verifica los 16 dígitos.', 'error');
  }
  if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
    return showToast('Escribe la fecha de expiración en formato MM/AA (ej: 12/26)', 'error');
  }
  if (cardCvv.length < 3) {
    return showToast('El código CVV debe tener al menos 3 dígitos', 'error');
  }

  // Simular procesamiento de pago
  finalizeRegBtn.disabled = true;
  finalizeRegBtn.textContent = 'Procesando pago... ⌛';

  setTimeout(() => {
    showToast('💳 Tarjeta válida, cobro exitoso ($30 MXN)', 'success');
    registerUser();
  }, 2000);
});

async function registerUser() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

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

    showToast('¡Bienvenido!', 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 1000);
  } catch (err) {
    showToast(err.message, 'error');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar Sesión →';
  }
}

loginBtn?.addEventListener('click', login);

// Lógica de Ocultar/Ver Contraseña
document.addEventListener('click', (e) => {
  const eye = e.target.closest('.eye-toggle');
  if (!eye) return;

  const targetId = eye.dataset.target;
  const input = document.getElementById(targetId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    eye.innerHTML = '<i data-lucide="eye-off"></i>';
  } else {
    input.type = 'password';
    eye.innerHTML = '<i data-lucide="eye"></i>';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
});