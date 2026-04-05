'use strict';
/* pages/watchlist.js — Watchlist feature */

const WatchlistPage = (() => {
  const REFRESH_MS = 30000;
  let refreshTimer = null;
  let $ = null;

  function init() {
    $ = {
      input:       document.getElementById('wl-input'),
      addBtn:      document.getElementById('wl-addBtn'),
      tbody:       document.getElementById('wl-tbody'),
      empty:       document.getElementById('wl-empty'),
      refreshBtn:  document.getElementById('wl-refreshBtn'),
      optimizeBtn: document.getElementById('wl-optimizeBtn'),
      lastUpdated: document.getElementById('wl-lastUpdated'),
    };
    $.addBtn.addEventListener('click', () => addTicker());
    $.input.addEventListener('keydown', e => { if (e.key === 'Enter') addTicker(); });
    $.refreshBtn.addEventListener('click', () => refresh());
    $.optimizeBtn.addEventListener('click', optimizeSelected);
    document.querySelectorAll('.quick-ticker[data-wl-ticker]').forEach(btn =>
      btn.addEventListener('click', () => addTickerSym(btn.dataset.wlTicker))
    );
    render();
    refresh();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, REFRESH_MS);
  }

  function addTicker() {
    addTickerSym($.input?.value ?? '');
    if ($.input) $.input.value = '';
  }

  function addTickerSym(raw) {
    const sym = raw.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, '');
    if (!sym || sym.length > 10) return;
    Storage.watchlist.add(sym);
    render();
    refresh();
  }

  function removeTicker(sym) { Storage.watchlist.remove(sym); render(); }

  function render(prices = {}) {
    const list = Storage.watchlist.get();
    $.empty.hidden  = list.length > 0;
    $.tbody.innerHTML = '';
    if (!list.length) return;

    list.forEach(({ symbol, addedAt }) => {
      const info  = prices[symbol];
      const price = info?.price;
      const tr    = document.createElement('tr');
      tr.innerHTML = `
        <td class="col--number"><input type="checkbox" class="wl-check" data-sym="${symbol}" aria-label="Select ${symbol}"></td>
        <td><span class="ticker-chip" style="display:inline-flex">${symbol}</span></td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">
          ${price ? Format.usd(price) : '<span style="color:var(--text-faint)">—</span>'}
        </td>
        <td style="color:var(--text-muted);font-size:12px">${price ? 'Just now' : 'Pending…'}</td>
        <td style="text-align:right">
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-border)" data-opt-ticker="${symbol}">→ Optimize</button>
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;border:1px solid var(--border);margin-left:4px" data-rm-ticker="${symbol}">✕</button>
        </td>`;
      tr.querySelector(`[data-rm-ticker]`).addEventListener('click', () => removeTicker(symbol));
      tr.querySelector(`[data-opt-ticker]`).addEventListener('click', () => {
        OptimizerPage.loadParams({ tickers: [symbol], budget: null, maxLeftover: null });
        App.navigate('optimizer');
      });
      $.tbody.appendChild(tr);
    });
  }

  async function refresh() {
    const list = Storage.watchlist.get();
    if (!list.length) return;
    $.refreshBtn.textContent = '↻ Refreshing…';
    $.refreshBtn.disabled    = true;
    try {
      const resp   = await MarketClient.fetchQuotes(list.map(i => i.symbol));
      render(resp.data);
      if ($.lastUpdated) $.lastUpdated.textContent = `Updated ${Format.timeago(Date.now())}`;
    } catch { /* silently fail */ }
    $.refreshBtn.textContent = '↻ Refresh';
    $.refreshBtn.disabled    = false;
  }

  function optimizeSelected() {
    const checked = [...document.querySelectorAll('.wl-check:checked')].map(el => el.dataset.sym);
    if (!checked.length) { alert('Select at least one ticker.'); return; }
    OptimizerPage.loadParams({ tickers: checked.slice(0, 6), budget: null, maxLeftover: null });
    App.navigate('optimizer');
  }

  return { init };
})();
