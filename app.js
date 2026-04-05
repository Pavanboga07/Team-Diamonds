'use strict';
/* app.js — SaaS dashboard router + auth guard */

const App = (() => {
  const PAGES = {
    market:    { label: 'Market',    initialized: false, init: () => MarketPage.init() },
    optimizer: { label: 'Portfolio', initialized: false, init: () => OptimizerPage.init() },
    watchlist: { label: 'Watchlist', initialized: false, init: () => WatchlistPage.init() },
    history:   { label: 'History',   initialized: false, init: () => HistoryPage.init() },
    compare:   { label: 'Compare',   initialized: false, init: () => ComparePage.init() },
    'api-docs':{ label: 'API Docs',  initialized: false, init: () => ApiDocsPage.init() },
  };
  const DEFAULT = 'market';

  function hashPage() {
    const h = location.hash.slice(1);
    return PAGES[h] ? h : DEFAULT;
  }

  function navigate(page) {
    if (!PAGES[page]) page = DEFAULT;
    document.querySelectorAll('.nav-item[data-page]').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page)
    );
    document.querySelectorAll('.page-panel').forEach(el =>
      el.classList.toggle('hidden', el.id !== `panel-${page}`)
    );
    const bc = document.getElementById('topbarBreadcrumb');
    if (bc) bc.textContent = PAGES[page].label;
    if (!PAGES[page].initialized) {
      PAGES[page].init();
      PAGES[page].initialized = true;
    }
    if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
  }

  function updateUsageCounter() {
    // usage count comes from history API — refreshed when history page loads
    const el = document.getElementById('usageCount');
    if (el) {
      AuthClient.apiFetch('/user/history').then(resp => {
        if (resp.ok) el.textContent = resp.data.length;
      }).catch(() => {});
    }
  }

  async function init() {
    // ── Auth guard ──────────────────────────────────────
    const user = await AuthClient.requireAuth();
    if (!user) return; // requireAuth already redirected

    // ── Show user in topbar ─────────────────────────────
    const avatarEl = document.getElementById('userAvatar');
    const nameEl   = document.getElementById('userName');
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    if (nameEl)   nameEl.textContent   = user.name;

    // ── Logout button ───────────────────────────────────
    document.getElementById('logoutBtn')?.addEventListener('click', () => AuthClient.logout());

    // ── Nav routing ─────────────────────────────────────
    document.querySelectorAll('.nav-item[data-page]').forEach(el =>
      el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); })
    );
    window.addEventListener('hashchange', () => navigate(hashPage()));
    navigate(hashPage());
    updateUsageCounter();
  }

  return { init, navigate, updateUsageCounter };
})();

document.addEventListener('DOMContentLoaded', App.init);
