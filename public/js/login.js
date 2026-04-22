const API = 'http://localhost:3000';

let token = localStorage.getItem('token');
let currentEmail = '';
let resetMode = false;

function hideAll() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('registro-box').style.display = 'none';
  document.getElementById('forgot-box').style.display = 'none';
  document.getElementById('verify-box').style.display = 'none';
  document.getElementById('reset-box').style.display = 'none';
}

function mostrarLogin() {
  hideAll();
  resetMode = false;
  document.getElementById('login-box').style.display = 'block';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

function mostrarRegistro() {
  hideAll();
  resetMode = false;
  document.getElementById('registro-box').style.display = 'block';
  document.getElementById('reg-nombre').value = '';
  document.getElementById('reg-apellido').value = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-user').value = '';
  document.getElementById('reg-pass').value = '';
  document.getElementById('reg-confirm').value = '';
  document.getElementById('reg-fecha').value = '';
  document.getElementById('reg-premium').checked = false;
}

function mostrarForgot(event) {
  if (event) event.preventDefault();
  hideAll();
  resetMode = true;
  document.getElementById('forgot-box').style.display = 'block';
  document.getElementById('forgot-email').value = '';
}

function mostrarVerify(email, isReset = false) {
  currentEmail = email;
  resetMode = isReset;
  hideAll();
  document.getElementById('verify-box').style.display = 'block';
  document.getElementById('verify-email').textContent = email;
  document.getElementById('otp-input').value = '';
  
  if (isReset) {
    document.querySelector('#verify-box h2').textContent = '🔐 Verificar Código';
    document.querySelector('#verify-box button').textContent = 'Verificar Código';
  } else {
    document.querySelector('#verify-box h2').textContent = '✅ Verificar Código';
    document.querySelector('#verify-box button').textContent = 'Verificar y Continuar';
  }
}

function mostrarResetPassword(email) {
  currentEmail = email;
  hideAll();
  document.getElementById('reset-box').style.display = 'block';
  document.getElementById('reset-email-display').textContent = email;
  document.getElementById('reset-new-pass').value = '';
  document.getElementById('reset-confirm-pass').value = '';
}

function mostrarMensaje(mensaje, esError = true) {
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) existingAlert.remove();

  const alertDiv = document.createElement('div');
  alertDiv.className = 'custom-alert';
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    background-color: ${esError ? '#f44336' : '#4caf50'};
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  alertDiv.textContent = mensaje;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 4000);
}

async function registrar() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirmPassword = document.getElementById('reg-confirm').value;
  const esPremium = document.getElementById('reg-premium').checked;

  if (!nombre || !apellido || !email || !username || !password || !confirmPassword) {
    mostrarMensaje('❌ Todos los campos con * son obligatorios');
    return;
  }

  if (nombre.length < 2 || nombre.length > 50) {
    mostrarMensaje('❌ El nombre debe tener entre 2 y 50 caracteres');
    return;
  }

  if (apellido.length < 2 || apellido.length > 50) {
    mostrarMensaje('❌ El apellido debe tener entre 2 y 50 caracteres');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('❌ Ingresa un email válido (ejemplo: usuario@gmail.com)');
    return;
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    mostrarMensaje('❌ El username debe tener 3-20 caracteres y solo puede contener letras, números y guión bajo');
    return;
  }

  if (password.length < 8) {
    mostrarMensaje('❌ La contraseña debe tener al menos 8 caracteres');
    return;
  }

  if (password !== confirmPassword) {
    mostrarMensaje('❌ Las contraseñas no coinciden');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, email, username, password, confirmPassword, esPremium })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || '❌ Error en el registro');
      return;
    }

    mostrarMensaje('✅ Código enviado a tu correo', false);
    mostrarVerify(email, false);
  } catch (error) {
    mostrarMensaje('❌ Error de conexión con el servidor');
  }
}

async function verificarOTP() {
  const otp = document.getElementById('otp-input').value.trim();

  if (!otp || otp.length !== 6) {
    mostrarMensaje('❌ Ingresa el código de 6 dígitos que recibiste en tu correo');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, otp })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || '❌ Código incorrecto');
      return;
    }

    if (resetMode) {
      mostrarMensaje('✅ Código verificado. Ahora crea tu nueva contraseña', false);
      mostrarResetPassword(currentEmail);
    } else {
      if (data.token) {
        localStorage.setItem('token', data.token);
        mostrarMensaje('✅ ¡Registro exitoso! Redirigiendo...', false);
        window.location.href = 'home.html';
      } else {
        mostrarMensaje('❌ No se recibió token del servidor');
      }
    }
  } catch (error) {
    mostrarMensaje('❌ Error de conexión con el servidor');
  }
}

async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();

  if (!username || !password) {
    mostrarMensaje('❌ Ingresa usuario y contraseña');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || '❌ Usuario o contraseña incorrectos');
      return;
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      mostrarMensaje('✅ ¡Bienvenido a ForananeoKitchen!', false);
      window.location.href = 'home.html';
    } else {
      mostrarMensaje('❌ No se recibió token del servidor');
    }
  } catch (error) {
    mostrarMensaje('❌ Error de conexión con el servidor');
  }
}

async function forgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();

  if (!email) {
    mostrarMensaje('❌ Ingresa tu email');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('❌ Ingresa un email válido (ejemplo: usuario@gmail.com)');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || '❌ Error al enviar el código');
      return;
    }

    mostrarMensaje('✅ Código enviado a tu correo', false);
    mostrarVerify(email, true);
  } catch (error) {
    mostrarMensaje('❌ Error de conexión con el servidor');
  }
}

async function resetPassword() {
  const newPassword = document.getElementById('reset-new-pass').value;
  const confirmNewPassword = document.getElementById('reset-confirm-pass').value;

  if (!newPassword || !confirmNewPassword) {
    mostrarMensaje('❌ Ambos campos son obligatorios');
    return;
  }

  if (newPassword.length < 8) {
    mostrarMensaje('❌ La nueva contraseña debe tener al menos 8 caracteres');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    mostrarMensaje('❌ Las contraseñas no coinciden');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: currentEmail, 
        newPassword: newPassword,
        confirmNewPassword: confirmNewPassword
      })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || '❌ Error al actualizar la contraseña');
      return;
    }

    mostrarMensaje('✅ ¡Contraseña actualizada correctamente! Redirigiendo...', false);
    window.location.href = 'login.html';
  } catch (error) {
    mostrarMensaje('❌ Error de conexión con el servidor');
  }
}

async function continuarInvitado() {
  localStorage.removeItem('token');
  window.location.href = 'home.html';
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);