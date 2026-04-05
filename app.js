'use strict';
/* app.js — SaaS dashboard hash router */

const App = (() => {
  const PAGES = {
    optimizer: { label: 'Portfolio',  initialized: false, init: () => OptimizerPage.init() },
    watchlist: { label: 'Watchlist',  initialized: false, init: () => WatchlistPage.init() },
    history:   { label: 'History',    initialized: false, init: () => HistoryPage.init() },
    compare:   { label: 'Compare',    initialized: false, init: () => ComparePage.init() },
    'api-docs':{ label: 'API Docs',   initialized: false, init: () => ApiDocsPage.init() },
  };
  const DEFAULT = 'optimizer';

  function hashPage() {
    const h = location.hash.slice(1);
    return PAGES[h] ? h : DEFAULT;
  }

  function navigate(page) {
    if (!PAGES[page]) page = DEFAULT;

    // nav highlight
    document.querySelectorAll('.nav-item[data-page]').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page)
    );
    // show panel
    document.querySelectorAll('.page-panel').forEach(el =>
      el.classList.toggle('hidden', el.id !== `panel-${page}`)
    );
    // breadcrumb
    const bc = document.getElementById('topbarBreadcrumb');
    if (bc) bc.textContent = PAGES[page].label;

    // lazy init
    if (!PAGES[page].initialized) {
      PAGES[page].init();
      PAGES[page].initialized = true;
    }
    if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
  }

  function updateUsageCounter() {
    const el = document.getElementById('usageCount');
    if (el) el.textContent = Storage.history.getAll().length;
  }

  function init() {
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
