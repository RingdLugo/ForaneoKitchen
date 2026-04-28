// api-config.js - Configuración central de la API

const API_BASE = (() => {
  if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
})();

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (!window.location.pathname.includes('login.html')) {
      alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      window.location.href = 'login.html';
    }
    throw new Error('Sesión expirada');
  }
  return response;
}

window.API_BASE = API_BASE;
window.fetchWithAuth = fetchWithAuth;