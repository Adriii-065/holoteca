(function () {
  var STORAGE_KEY = 'holoteca_theme';

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Se ejecuta enseguida (este script no es "defer"), antes de pintar la pagina.
  applyTheme(getPreferredTheme());

  function updateToggleIcons(theme) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function (btn) {
      var sun = btn.querySelector('.icon-sun');
      var moon = btn.querySelector('.icon-moon');
      if (!sun || !moon) return;
      if (theme === 'dark') {
        sun.style.display = '';
        moon.style.display = 'none';
        btn.setAttribute('aria-label', 'Cambiar a modo claro');
      } else {
        sun.style.display = 'none';
        moon.style.display = '';
        btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
      }
    });
  }

  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    updateToggleIcons(theme);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    updateToggleIcons(current);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
      });
    });
  });
})();
