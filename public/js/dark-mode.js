/* ================================================================
   ForaneoKitchen — dark-mode.js
   Sistema centralizado de dark mode para todas las páginas
   ================================================================ */

(function () {
  'use strict';

  function applyDark(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
    });
  }

  function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    applyDark(isDark);
  }

  function initDarkMode() {
    const saved = localStorage.getItem('darkMode') === 'true';
    applyDark(saved);
    // Vincular todos los botones toggle de la página
    document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
      btn.removeEventListener('click', toggleDarkMode);
      btn.addEventListener('click', toggleDarkMode);
    });
  }

  // Aplicar inmediatamente para evitar flash
  const savedDark = localStorage.getItem('darkMode') === 'true';
  if (savedDark) document.body.classList.add('dark-mode');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  } else {
    initDarkMode();
  }

  // Exponer globalmente por si alguna página lo llama directamente
  window.toggleDarkMode = toggleDarkMode;
  window.initDarkMode = initDarkMode;
})();