'use strict';
/* pages/watchlist.js — Watchlist (API-backed) */

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
    load();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, REFRESH_MS);
  }

  async function load() {
    const resp = await AuthClient.apiFetch('/user/watchlist').catch(() => null);
    const list = resp?.data ?? [];
    renderRows(list, {});
    if (list.length) fetchPrices(list.map(i => i.symbol));
  }

  async function fetchPrices(symbols) {
    try {
      const resp = await MarketClient.fetchQuotes(symbols);
      const list = (await AuthClient.apiFetch('/user/watchlist').catch(() => null))?.data ?? [];
      renderRows(list, resp.data ?? {});
      if ($.lastUpdated) $.lastUpdated.textContent = `Updated ${Format.timeago(Date.now())}`;
    } catch {}
  }

  function renderRows(list, prices) {
    $.empty.hidden = list.length > 0;
    $.tbody.innerHTML = '';
    list.forEach(({ symbol }) => {
      const info   = prices[symbol];
      const price  = info?.price;
      const chg    = info?.changePercent;
      const isUp   = chg > 0, isDown = chg < 0;
      const chgStr = chg != null
        ? `<span style="color:${isUp ? '#16A34A' : isDown ? '#DC2626' : '#6B7280'};font-weight:600;font-size:13px">${isUp ? '+' : ''}${chg.toFixed(2)}%</span>`
        : '<span style="color:var(--text-faint)">—</span>';
      const tr    = document.createElement('tr');
      tr.innerHTML = `
        <td class="col--number"><input type="checkbox" class="wl-check" data-sym="${symbol}" aria-label="Select ${symbol}"></td>
        <td><span class="ticker-chip" style="display:inline-flex">${symbol}</span></td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">
          ${price ? Format.usd(price) : '<span style="color:var(--text-faint)">—</span>'}
        </td>
        <td style="text-align:right">${chgStr}</td>
        <td style="color:var(--text-muted);font-size:12px">${price ? 'Live' : 'Pending…'}</td>
        <td style="text-align:right">
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-border)" data-opt="${symbol}">→ Optimize</button>
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;border:1px solid var(--border);margin-left:4px" data-rm="${symbol}">✕</button>
        </td>`;
      tr.querySelector(`[data-rm]`).addEventListener('click', () => removeTicker(symbol));
      tr.querySelector(`[data-opt]`).addEventListener('click', () => {
        OptimizerPage.loadParams({ tickers: [symbol] });
        App.navigate('optimizer');
      });
      $.tbody.appendChild(tr);
    });
  }

  function addTicker() {
    addTickerSym($.input?.value ?? '');
    if ($.input) $.input.value = '';
  }

  async function addTickerSym(raw) {
    const sym = raw.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, '');
    if (!sym || sym.length > 10) return;
    await AuthClient.apiFetch('/user/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol: sym }),
    });
    load();
  }

  async function removeTicker(sym) {
    await AuthClient.apiFetch(`/user/watchlist/${sym}`, { method: 'DELETE' });
    load();
  }

  async function refresh() {
    $.refreshBtn.textContent = '↻ Refreshing…';
    $.refreshBtn.disabled    = true;
    const resp = await AuthClient.apiFetch('/user/watchlist').catch(() => null);
    const list = resp?.data ?? [];
    if (list.length) await fetchPrices(list.map(i => i.symbol));
    $.refreshBtn.textContent = '↻ Refresh';
    $.refreshBtn.disabled    = false;
  }

  function optimizeSelected() {
    const checked = [...document.querySelectorAll('.wl-check:checked')].map(el => el.dataset.sym);
    if (!checked.length) { alert('Select at least one ticker.'); return; }
    OptimizerPage.loadParams({ tickers: checked.slice(0, 6) });
    App.navigate('optimizer');
  }

  return { init };
})();
