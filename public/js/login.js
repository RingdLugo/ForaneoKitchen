const API = 'http://localhost:3000';
let token = localStorage.getItem('token');
let currentEmail = '';
let errors = {};

function mostrarRegistro() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('registro-box').style.display = 'block';
  errors = {};
  limpiarErrores();
}

function mostrarLogin() {
  document.getElementById('registro-box').style.display = 'none';
  document.getElementById('login-box').style.display = 'block';
  limpiarErrores();
}

function mostrarVerify(email) {
  currentEmail = email;
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('registro-box').style.display = 'none';
  document.getElementById('verify-box').style.display = 'block';
  document.getElementById('verify-email').textContent = email;
  limpiarErrores();
}

function limpiarErrores() {
  document.querySelectorAll('.error-message').forEach(el => el.remove());
}

function mostrarErrores() {
  limpiarErrores();
  Object.keys(errors).forEach(campo => {
    const input = document.getElementById(`reg-${campo}`);
    if (input) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.style.cssText = 'color: #f44336; font-size: 0.85rem; margin-top: 4px; font-weight: 500;';
      errorDiv.textContent = errors[campo];
      input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }
  });
}

function validateForm() {
  errors = {};
  let isValid = true;

  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirmPassword = document.getElementById('reg-confirm').value;

  if (!nombre) {
    errors.nombre = 'El nombre es requerido';
    isValid = false;
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(nombre)) {
    errors.nombre = 'Solo letras (2-50 caracteres)';
    isValid = false;
  } else if (/(.)\1{2,}/.test(nombre)) {
    errors.nombre = 'No se permiten 3 letras iguales seguidas (aaa, bbb)';
    isValid = false;
  }

  if (!apellido) {
    errors.apellido = 'El apellido es requerido';
    isValid = false;
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(apellido)) {
    errors.apellido = 'Solo letras (2-50 caracteres)';
    isValid = false;
  } else if (/(.)\1{2,}/.test(apellido)) {
    errors.apellido = 'No se permiten 3 letras iguales seguidas (aaa, bbb)';
    isValid = false;
  }

  if (!email) {
    errors.email = 'El email es requerido';
    isValid = false;
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|icloud\.com)$/i;
    if (!emailRegex.test(email)) {
      errors.email = 'Solo: gmail.com, hotmail.com, outlook.com, yahoo.com, icloud.com';
      isValid = false;
    }
  }

  if (!username) {
    errors.username = 'El username es requerido';
    isValid = false;
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.username = '3-20 caracteres (letras, números, _)';
    isValid = false;
  }

  if (!password) {
    errors.password = 'La contraseña es requerida';
    isValid = false;
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,20}$/.test(password)) {
    errors.password = 'Mín 8 chars: mayúscula, minúscula, número';
    isValid = false;
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
    isValid = false;
  }

  mostrarErrores();
  return isValid;
}

async function registrar() {
  if (!validateForm()) {
    return;
  }

  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const esPremium = document.getElementById('reg-premium')?.checked || false;

  try {
    const res = await fetch(`${API}/api/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, email, username, password, esPremium })
    });

    if (!res.ok) throw new Error((await res.json()).error || 'Error al registrar');

    const data = await res.json();
    mostrarVerify(data.email);
  } catch (err) {
    alert(err.message);
  }
}

async function verificarOTP() {
  const otp = document.getElementById('otp-input').value;
  if (otp.length !== 6) return alert('Ingresa 6 dígitos');
  
  try {
    const res = await fetch(`${API}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, otp })
    });
    
    if (!res.ok) throw new Error((await res.json()).error);
    
    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = 'home.html';
  } catch(err) {
    alert(err.message);
  }
}

async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();

  if (!username || !password) {
    return alert('Completa usuario y contraseña');
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error((await res.json()).error || 'Error al iniciar sesión');

    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = 'home.html';
  } catch (err) {
    alert(err.message);
  }
}

if (token) {
  fetch(`${API}/api/recetas`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => {
      if (!res.ok) localStorage.removeItem('token');
    })
    .catch(() => localStorage.removeItem('token'));
}