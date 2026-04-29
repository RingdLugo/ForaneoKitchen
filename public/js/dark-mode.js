/* ForaneoKitchen — dark-mode.js */
(function () {
  function apply(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    document.querySelectorAll('.dark-mode-toggle').forEach(b => {
      b.textContent = isDark ? '☀️' : '🌙';
      b.title = isDark ? 'Modo claro' : 'Modo oscuro';
    });
  }
  function toggle() {
    const d = !document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', d);
    apply(d);
  }
  function init() {
    apply(localStorage.getItem('darkMode') === 'true');
    document.querySelectorAll('.dark-mode-toggle').forEach(b => {
      b.removeEventListener('click', toggle);
      b.addEventListener('click', toggle);
    });
  }
  // Aplicar sin flash
  if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.toggleDarkMode = toggle;
})();