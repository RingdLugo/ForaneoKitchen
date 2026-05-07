// login.js — ForaneoKitchen (CORREGIDO)
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
const registerBtn = document.getElementById('register-btn');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink    = document.getElementById('show-login');

let currentAction = 'login';

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
  currentAction = 'register';
}

showRegisterLink?.addEventListener('click', e => { e.preventDefault(); showRegistroBox(); });
showLoginLink?.addEventListener('click',    e => { e.preventDefault(); showLoginBox(); });

function guardarSesion(id, username, rol, esPremium, puntos, token, preferencias) {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', id);
  localStorage.setItem('userName', username);
  localStorage.setItem('userRol', rol);
  localStorage.setItem('userPremium', esPremium);
  localStorage.setItem('userPuntos', puntos || 0);
  localStorage.setItem('userPrefs', JSON.stringify(preferencias || []));
  
  console.log('✅ Sesión guardada:', { id, username, rol, token: token?.substring(0, 20) + '...' });
}

// ── REGISTRO ──────────────────────────────────────────────────
async function registerUser() {
  const nombre    = document.getElementById('reg-nombre')?.value.trim();
  const apellido  = document.getElementById('reg-apellido')?.value.trim();
  const email     = document.getElementById('reg-email')?.value.trim();
  const username  = document.getElementById('reg-username')?.value.trim();
  const password  = document.getElementById('reg-password')?.value;
  const confirm   = document.getElementById('reg-confirm')?.value;
  const esPremium = document.getElementById('reg-premium')?.checked || false;

  if (!nombre || !apellido || !email || !username || !password || !confirm) {
    showToast('Todos los campos son obligatorios', 'error'); return;
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showToast('Username: solo letras, números y _ (3-20 caracteres)', 'error'); return;
  }
  if (password !== confirm) {
    showToast('Las contraseñas no coinciden', 'error'); return;
  }
  if (password.length < 8) {
    showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return;
  }

  if (registerBtn) { registerBtn.disabled = true; registerBtn.textContent = 'Enviando código...'; }

  try {
    const res  = await fetch(`${API_BASE}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, email, username, password, confirmPassword: confirm, esPremium })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar');

    showToast(`✅ Código enviado a ${email}`, 'success');
    localStorage.setItem('verifyEmail', email);
    setTimeout(() => { window.location.href = 'verificar.html'; }, 1500);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (registerBtn) { registerBtn.disabled = false; registerBtn.textContent = 'Crear Cuenta →'; }
  }
}

// ── LOGIN (CORREGIDO) ─────────────────────────────────────────
async function loginUser() {
  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!username || !password) {
    showToast('Ingresa usuario y contraseña', 'error'); 
    return;
  }

  if (loginBtn) { 
    loginBtn.disabled = true; 
    loginBtn.textContent = 'Iniciando...'; 
  }

  try {
    console.log('📡 Intentando login con:', { username });
    
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    console.log('📡 Respuesta del servidor:', data);
    
    if (!res.ok) throw new Error(data.error || 'Usuario o contraseña incorrectos');

    // Verificar que el token existe
    if (!data.token) {
      console.error('❌ El servidor no devolvió token');
      throw new Error('Error en el servidor: token no recibido');
    }

    // Guardar sesión correctamente
    guardarSesion(
      data.user.id, 
      data.user.username, 
      data.user.rol, 
      data.user.esPremium, 
      data.user.puntos,
      data.token,
      data.user.preferencias
    );

    showToast(`¡Bienvenido, ${data.user.username}!`, 'success');
    console.log('✅ Login exitoso, redirigiendo a home...');
    
    setTimeout(() => { 
      window.location.href = 'home.html'; 
    }, 500);

  } catch (err) {
    console.error('❌ Error en login:', err);
    showToast(err.message, 'error');
  } finally {
    if (loginBtn) { 
      loginBtn.disabled = false; 
      loginBtn.textContent = 'Iniciar Sesión →'; 
    }
  }
}

// ── Event listeners ───────────────────────────────────────────
loginBtn?.addEventListener('click', loginUser);
registerBtn?.addEventListener('click', registerUser);

document.querySelectorAll('input').forEach(inp => {
  inp.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      currentAction === 'login' ? loginUser() : registerUser();
    }
  });
});

// ── Verificar si ya hay sesión activa ─────────────────────────
async function checkSession() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  
  console.log('🔍 Verificando sesión existente - token:', token ? '✅' : '❌', 'userId:', userId);
  
  if (token && userId) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        console.log('✅ Sesión válida, redirigiendo a home');
        window.location.href = 'home.html';
      } else {
        console.log('⚠️ Sesión inválida, limpiando localStorage');
        localStorage.clear();
      }
    } catch (err) {
      console.log('⚠️ Error verificando sesión:', err.message);
      localStorage.clear();
    }
  }
}

// ── Iniciar ───────────────────────────────────────────────────
checkSession();