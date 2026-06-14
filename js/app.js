// Main app — router + init
(function() {

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const SCREENS = ['home', 'streaks', 'products', 'journal', 'schedule'];
  const TITLES  = { home: 'Skincare', streaks: 'Streaks', products: 'Products', journal: 'Journal', schedule: 'Schedule' };
  const renderers = {
    home:     () => Home.render(),
    streaks:  () => StreaksScreen.render(),
    products: () => ProductsScreen.render(),
    journal:  () => JournalScreen.render(),
    schedule: () => ScheduleScreen.render()
  };

  function navigate(id) {
    SCREENS.forEach(s => {
      document.getElementById(`screen-${s}`)?.classList.toggle('active', s === id);
      document.getElementById(`nav-${s}`)?.classList.toggle('active', s === id);
    });
    const titleEl = document.getElementById('top-bar-title');
    if (titleEl) titleEl.textContent = TITLES[id] || 'Skincare';
    renderers[id]?.();
  }

  let snackbarTimeout = null;
  function showSnackbar(msg, duration = 2800) {
    const el = document.getElementById('snackbar');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (snackbarTimeout) clearTimeout(snackbarTimeout);
    snackbarTimeout = setTimeout(() => el.classList.remove('show'), duration);
  }

  async function init() {
    await DB.openDB();
    await DB.Schedule.seedDefaults();

    SCREENS.forEach(id => {
      document.getElementById(`nav-${id}`)?.addEventListener('click', () => navigate(id));
    });

    navigate('home');
  }

  window.App = { navigate, showSnackbar };
  init().catch(console.error);
})();
