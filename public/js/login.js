const API = 'http://localhost:3000';
let token = localStorage.getItem('token');

function mostrarRegistro() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('registro-box').style.display = 'block';
}

function mostrarLogin() {
  document.getElementById('registro-box').style.display = 'none';
  document.getElementById('login-box').style.display = 'block';
}

async function registrar() {
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value.trim();
  const esPremium = document.getElementById('reg-premium').checked;

  if (!username || !password) return alert('Completa usuario y contraseña');

  try {
    const res = await fetch(`${API}/api/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, esPremium })
    });

    if (!res.ok) throw new Error((await res.json()).error || 'Error al registrar');

    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = 'home.html';

  } catch (err) {
    alert(err.message);
  }
}

async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();

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