(() => {
  const key = 'zoalmon-gringo-theme';
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121a20' : '#f7f8f6');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const english = document.documentElement.lang === 'en';
      toggle.textContent = theme === 'dark' ? (english ? 'Light mode' : 'Modo claro') : (english ? 'Dark mode' : 'Modo oscuro');
      toggle.setAttribute('aria-label', theme === 'dark' ? (english ? 'Switch to light mode' : 'Activar modo claro') : (english ? 'Switch to dark mode' : 'Activar modo oscuro'));
    }
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      apply();
      try { localStorage.setItem(key, theme); } catch {}
    });
  });
})();
