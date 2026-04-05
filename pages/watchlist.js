'use strict';
/* pages/watchlist.js — Watchlist using localStorage (no auth) */

const WatchlistPage = (() => {
  const STORAGE_KEY = 'qs_watchlist';
  const REFRESH_MS  = 30000;
  let refreshTimer  = null;
  let $ = null;

  /* ── storage helpers ─────────────────────────────── */
  function getList()       { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function saveList(arr)   { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  function addSymbol(sym)  { const l = getList(); if (!l.includes(sym)) { l.push(sym); saveList(l); } }
  function removeSymbol(s) { saveList(getList().filter(x => x !== s)); }

  /* ── init ────────────────────────────────────────── */
  function init() {
    $ = {
      input:       document.getElementById('wl-input'),
      addBtn:      document.getElementById('wl-addBtn'),
      tbody:       document.getElementById('wl-tbody'),
      empty:       document.getElementById('wl-empty'),
      refreshBtn:  document.getElementById('wl-refreshBtn'),
      optimizeBtn: document.getElementById('wl-optimizeBtn'),
      lastUpdated: document.getElementById('wl-lastUpdated'),
      selectAll:   document.getElementById('wl-selectAll'),
    };

    $.addBtn.addEventListener('click', () => addTicker());
    $.input.addEventListener('keydown', e => { if (e.key === 'Enter') addTicker(); });
    $.refreshBtn.addEventListener('click', () => refresh(true));
    $.optimizeBtn.addEventListener('click', optimizeSelected);
    $.selectAll?.addEventListener('change', e => {
      document.querySelectorAll('.wl-check').forEach(c => c.checked = e.target.checked);
    });
    document.querySelectorAll('[data-wl-ticker]').forEach(btn =>
      btn.addEventListener('click', () => addTickerSym(btn.dataset.wlTicker))
    );

    render([]);
    refresh(false);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refresh(false), REFRESH_MS);
  }

  /* ── fetch prices ────────────────────────────────── */
  async function refresh(showFeedback = true) {
    const symbols = getList();
    if (showFeedback) {
      $.refreshBtn.textContent = '↻ Refreshing…';
      $.refreshBtn.disabled    = true;
    }

    if (!symbols.length) {
      render([]);
      if (showFeedback) { $.refreshBtn.textContent = '↻ Refresh'; $.refreshBtn.disabled = false; }
      return;
    }

    try {
      const resp  = await fetch(`/market/quotes?symbols=${symbols.join(',')}`);
      const json  = await resp.json();
      const prices = json.data ?? {};
      render(symbols, prices);
      if ($.lastUpdated) $.lastUpdated.textContent = `Updated just now`;
    } catch {
      render(symbols, {});
    } finally {
      if (showFeedback) { $.refreshBtn.textContent = '↻ Refresh'; $.refreshBtn.disabled = false; }
    }
  }

  /* ── render ──────────────────────────────────────── */
  function render(symbols, prices = {}) {
    if (!$.tbody) return;
    $.empty.hidden  = symbols.length > 0;
    $.tbody.innerHTML = '';

    symbols.forEach(symbol => {
      const info  = prices[symbol] ?? {};
      const price = info.price;
      const chg   = info.changePercent;
      const isUp  = chg > 0, isDown = chg < 0;

      const priceHtml = price
        ? `<strong style="font-variant-numeric:tabular-nums">₹${Number(price).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>`
        : `<span style="color:var(--text-faint)">—</span>`;

      const chgHtml = chg != null
        ? `<span style="color:${isUp ? '#16A34A' : isDown ? '#DC2626' : '#6B7280'};font-weight:600">
            ${isUp ? '▲' : isDown ? '▼' : ''}${isUp ? '+' : ''}${chg.toFixed(2)}%
           </span>`
        : `<span style="color:var(--text-faint)">—</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col--number"><input type="checkbox" class="wl-check" data-sym="${symbol}" aria-label="Select ${symbol}"></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:32px;height:32px;border-radius:6px;background:#EFF6FF;color:#1B64F2;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center">${symbol[0]}</span>
            <span style="font-weight:600">${symbol}</span>
          </div>
        </td>
        <td style="text-align:right">${priceHtml}</td>
        <td style="text-align:right">${chgHtml}</td>
        <td style="color:var(--text-muted);font-size:12px">${price ? 'Live' : 'Pending…'}</td>
        <td style="text-align:right;display:flex;gap:6px;justify-content:flex-end;padding:8px 14px">
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;background:#EFF6FF;color:#1B64F2;border:1px solid #BFDBFE" data-opt="${symbol}">🎯 Plan</button>
          <button class="btn" style="height:28px;padding:0 10px;font-size:12px;border:1px solid var(--border)" data-rm="${symbol}">✕</button>
        </td>`;
      tr.querySelector('[data-rm]').addEventListener('click', () => { removeSymbol(symbol); refresh(false); });
      tr.querySelector('[data-opt]').addEventListener('click', () => {
        localStorage.setItem('qs_planner_prefill', JSON.stringify({ tickers: [symbol] }));
        location.href = '/pages/planner.html';
      });
      $.tbody.appendChild(tr);
    });
  }

  /* ── add / optimize ──────────────────────────────── */
  function addTicker() {
    addTickerSym($.input?.value ?? '');
    if ($.input) $.input.value = '';
  }

  function addTickerSym(raw) {
    const sym = raw.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, '');
    if (!sym || sym.length > 12) return;
    addSymbol(sym);
    refresh(false);
  }

  function optimizeSelected() {
    const checked = [...document.querySelectorAll('.wl-check:checked')].map(el => el.dataset.sym);
    if (!checked.length) { alert('Select at least one ticker first.'); return; }
    localStorage.setItem('qs_planner_prefill', JSON.stringify({ tickers: checked.slice(0, 6) }));
    location.href = '/pages/planner.html';
  }

  return { init };
})();
