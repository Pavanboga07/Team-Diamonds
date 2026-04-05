'use strict';
/* app.js — SaaS dashboard router + auth guard */

const App = (() => {
  const PAGES = {
    solver:    { label: 'Equation Solver', initialized: false, init: () => SolverPage.init() },
    market:    { label: 'Market',          initialized: false, init: () => MarketPage.init() },
    optimizer: { label: 'Portfolio',       initialized: false, init: () => OptimizerPage.init() },
    watchlist: { label: 'Watchlist',       initialized: false, init: () => WatchlistPage.init() },
    history:   { label: 'History',         initialized: false, init: () => HistoryPage.init() },
    compare:   { label: 'Compare',         initialized: false, init: () => ComparePage.init() },
    'api-docs':{ label: 'API Docs',        initialized: false, init: () => ApiDocsPage.init() },
  };
  const DEFAULT = 'solver';

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

  function init() {
    // ── Nav routing ─────────────────────────────────────
    document.querySelectorAll('.nav-item[data-page]').forEach(el =>
      el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); })
    );
    window.addEventListener('hashchange', () => navigate(hashPage()));
    navigate(hashPage());
  }

  return { init, navigate };
})();

document.addEventListener('DOMContentLoaded', App.init);
