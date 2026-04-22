const API = 'http://localhost:3000';

let token = localStorage.getItem('token');
let currentEmail = '';
let resetMode = false;

function hideAll() {
  const loginBox = document.getElementById('login-box');
  const registroBox = document.getElementById('registro-box');
  const forgotBox = document.getElementById('forgot-box');
  const verifyBox = document.getElementById('verify-box');
  const resetBox = document.getElementById('reset-box');
  
  if (loginBox) loginBox.style.display = 'none';
  if (registroBox) registroBox.style.display = 'none';
  if (forgotBox) forgotBox.style.display = 'none';
  if (verifyBox) verifyBox.style.display = 'none';
  if (resetBox) resetBox.style.display = 'none';
}

function mostrarLogin() {
  hideAll();
  resetMode = false;
  const loginBox = document.getElementById('login-box');
  const loginUser = document.getElementById('login-user');
  const loginPass = document.getElementById('login-pass');
  if (loginBox) loginBox.style.display = 'block';
  if (loginUser) loginUser.value = '';
  if (loginPass) loginPass.value = '';
}

function mostrarRegistro() {
  hideAll();
  resetMode = false;
  const registroBox = document.getElementById('registro-box');
  const regNombre = document.getElementById('reg-nombre');
  const regApellido = document.getElementById('reg-apellido');
  const regEmail = document.getElementById('reg-email');
  const regUser = document.getElementById('reg-user');
  const regPass = document.getElementById('reg-pass');
  const regConfirm = document.getElementById('reg-confirm');
  const regFecha = document.getElementById('reg-fecha');
  const regPremium = document.getElementById('reg-premium');
  
  if (registroBox) registroBox.style.display = 'block';
  if (regNombre) regNombre.value = '';
  if (regApellido) regApellido.value = '';
  if (regEmail) regEmail.value = '';
  if (regUser) regUser.value = '';
  if (regPass) regPass.value = '';
  if (regConfirm) regConfirm.value = '';
  if (regFecha) regFecha.value = '';
  if (regPremium) regPremium.checked = false;
}

function mostrarForgot(event) {
  if (event) event.preventDefault();
  hideAll();
  resetMode = true;
  const forgotBox = document.getElementById('forgot-box');
  const forgotEmail = document.getElementById('forgot-email');
  if (forgotBox) forgotBox.style.display = 'block';
  if (forgotEmail) forgotEmail.value = '';
}

function mostrarVerify(email, isReset = false) {
  console.log('mostrarVerify llamada con email:', email);
  currentEmail = email;
  resetMode = isReset;
  hideAll();
  const verifyBox = document.getElementById('verify-box');
  const verifyEmail = document.getElementById('verify-email');
  const otpInput = document.getElementById('otp-input');
  const verifyTitle = document.querySelector('#verify-box h2');
  const verifyButton = document.querySelector('#verify-box button');
  
  if (verifyBox) verifyBox.style.display = 'block';
  if (verifyEmail) verifyEmail.textContent = email;
  if (otpInput) otpInput.value = '';
  
  if (isReset) {
    if (verifyTitle) verifyTitle.textContent = 'Verificar Codigo';
    if (verifyButton) verifyButton.textContent = 'Verificar Codigo';
  } else {
    if (verifyTitle) verifyTitle.textContent = 'Verificar Codigo';
    if (verifyButton) verifyButton.textContent = 'Verificar y Continuar';
  }
}

function mostrarResetPassword(email) {
  currentEmail = email;
  hideAll();
  const resetBox = document.getElementById('reset-box');
  const resetEmailDisplay = document.getElementById('reset-email-display');
  const resetNewPass = document.getElementById('reset-new-pass');
  const resetConfirmPass = document.getElementById('reset-confirm-pass');
  
  if (resetBox) resetBox.style.display = 'block';
  if (resetEmailDisplay) resetEmailDisplay.textContent = email;
  if (resetNewPass) resetNewPass.value = '';
  if (resetConfirmPass) resetConfirmPass.value = '';
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
    mostrarMensaje('Todos los campos con * son obligatorios');
    return;
  }

  if (nombre.length < 2 || nombre.length > 50) {
    mostrarMensaje('El nombre debe tener entre 2 y 50 caracteres');
    return;
  }

  if (apellido.length < 2 || apellido.length > 50) {
    mostrarMensaje('El apellido debe tener entre 2 y 50 caracteres');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('Ingresa un email valido');
    return;
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    mostrarMensaje('El username debe tener 3-20 caracteres y solo puede contener letras, numeros y guion bajo');
    return;
  }

  if (password.length < 8) {
    mostrarMensaje('La contrasena debe tener al menos 8 caracteres');
    return;
  }

  if (password !== confirmPassword) {
    mostrarMensaje('Las contrasenas no coinciden');
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
      mostrarMensaje(data.error || 'Error en el registro');
      return;
    }

    console.log('Registro exitoso, email:', email);
    mostrarMensaje('Codigo enviado a tu correo', false);
    mostrarVerify(email, false);
    
  } catch (error) {
    console.error('Error en registro:', error);
    mostrarMensaje('Error de conexion con el servidor');
  }
}

async function verificarOTP() {
  const otp = document.getElementById('otp-input').value.trim();

  if (!otp || otp.length !== 6) {
    mostrarMensaje('Ingresa el codigo de 6 digitos que recibiste en tu correo');
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
      mostrarMensaje(data.error || 'Codigo incorrecto');
      return;
    }

    if (resetMode) {
      mostrarMensaje('Codigo verificado. Ahora crea tu nueva contrasena', false);
      mostrarResetPassword(currentEmail);
    } else {
      if (data.token) {
        localStorage.setItem('token', data.token);
        mostrarMensaje('Registro exitoso. Redirigiendo...', false);
        setTimeout(() => {
          window.location.href = 'home.html';
        }, 1000);
      } else {
        mostrarMensaje('No se recibio token del servidor');
      }
    }
  } catch (error) {
    console.error('Error en verificarOTP:', error);
    mostrarMensaje('Error de conexion con el servidor');
  }
}

async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();

  if (!username || !password) {
    mostrarMensaje('Ingresa usuario y contrasena');
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
      mostrarMensaje(data.error || 'Usuario o contrasena incorrectos');
      return;
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      mostrarMensaje('Bienvenido a ForananeoKitchen', false);
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 500);
    } else {
      mostrarMensaje('No se recibio token del servidor');
    }
  } catch (error) {
    console.error('Error en login:', error);
    mostrarMensaje('Error de conexion con el servidor');
  }
}

async function forgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();

  if (!email) {
    mostrarMensaje('Ingresa tu email');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('Ingresa un email valido');
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
      mostrarMensaje(data.error || 'Error al enviar el codigo');
      return;
    }

    mostrarMensaje('Codigo enviado a tu correo', false);
    mostrarVerify(email, true);
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    mostrarMensaje('Error de conexion con el servidor');
  }
}

async function resetPassword() {
  const newPassword = document.getElementById('reset-new-pass').value;
  const confirmNewPassword = document.getElementById('reset-confirm-pass').value;

  if (!newPassword || !confirmNewPassword) {
    mostrarMensaje('Ambos campos son obligatorios');
    return;
  }

  if (newPassword.length < 8) {
    mostrarMensaje('La nueva contrasena debe tener al menos 8 caracteres');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    mostrarMensaje('Las contrasenas no coinciden');
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
      mostrarMensaje(data.error || 'Error al actualizar la contrasena');
      return;
    }

    mostrarMensaje('Contrasena actualizada correctamente. Redirigiendo...', false);
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  } catch (error) {
    console.error('Error en resetPassword:', error);
    mostrarMensaje('Error de conexion con el servidor');
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