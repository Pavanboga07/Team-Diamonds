'use strict';
/* pages/market.js — Live Indian Market Dashboard */

const MarketPage = (() => {
  const REFRESH_MS = 15000;
  let timer = null;
  let data  = null;

  const SECTOR_COLOR = {
    'IT':      '#1B64F2', 'Banking': '#16A34A', 'Finance':  '#7C3AED',
    'Energy':  '#EA580C', 'Auto':    '#D97706',  'FMCG':     '#DB2777',
    'Pharma':  '#0891B2', 'Index':   '#6B7280',
  };

  function sectorColor(s) { return SECTOR_COLOR[s] || '#6B7280'; }

  /* ── init ───────────────────────────────────────────── */
  function init() {
    document.getElementById('mkt-refreshBtn')?.addEventListener('click', load);
    load();
    if (timer) clearInterval(timer);
    timer = setInterval(load, REFRESH_MS);
  }

  /* ── fetch ──────────────────────────────────────────── */
  async function load() {
    try {
      const resp = await AuthClient.apiFetch('/market/india');
      if (!resp.ok) return;
      const prev = data;
      data = resp;
      render(prev);
      document.getElementById('mkt-updated').textContent = `Updated ${Format.timeago(resp.updatedAt)}`;
      const badge = document.getElementById('mkt-sourceBadge');
      if (badge) {
        badge.className = `badge badge--live${resp.source === 'live' ? '' : ' badge--static'}`;
        badge.innerHTML = `<span class="badge__dot"></span>${resp.source === 'live' ? 'Live NSE' : 'Demo Prices'}`;
      }
    } catch { /* silently */ }
  }

  /* ── render ─────────────────────────────────────────── */
  function render(prev) {
    renderIndices(prev);
    renderTicker(data.indices, data.gainers);
    renderStocksTable(prev);
    renderMovers();
    renderSectors();
  }

  function chg(val, dec = 2) {
    const pos = val >= 0;
    return `<span class="chg ${pos ? 'chg--up' : 'chg--down'}">${pos ? '▲' : '▼'} ${Math.abs(val).toFixed(dec)}%</span>`;
  }
  function inr(val) {
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* indices bar */
  function renderIndices(prev) {
    const wrap = document.getElementById('mkt-indices');
    if (!wrap || !data.indices) return;
    wrap.innerHTML = data.indices.map(idx => {
      const up = idx.changePercent >= 0;
      const prevPrice = prev?.indices?.find(i => i.symbol === idx.symbol)?.price;
      const flash = prevPrice && prevPrice !== idx.price ? (idx.price > prevPrice ? ' flash-up' : ' flash-down') : '';
      return `<div class="idx-card${flash}">
        <div class="idx-card__name">${idx.symbol}</div>
        <div class="idx-card__price ${up ? 'price--up' : 'price--down'}">${idx.price.toLocaleString('en-IN')}</div>
        <div class="idx-card__chg">${chg(idx.changePercent)}</div>
      </div>`;
    }).join('');
  }

  /* scrolling ticker */
  function renderTicker(indices, gainers) {
    const el = document.getElementById('mkt-ticker-inner');
    if (!el) return;
    const items = [...(indices || []), ...(gainers || [])];
    const text = items.map(s => {
      const up = s.changePercent >= 0;
      return `<span class="ticker-item">
        <strong>${s.symbol}</strong>
        <span class="${up ? 'ticker-up' : 'ticker-down'}">${s.price.toLocaleString('en-IN')} ${up ? '▲' : '▼'}${Math.abs(s.changePercent).toFixed(2)}%</span>
      </span>`;
    }).join(' &nbsp;&bull;&nbsp; ');
    el.innerHTML = text + ' &nbsp;&bull;&nbsp; ' + text; // doubled for seamless loop
  }

  /* stocks table */
  function renderStocksTable(prev) {
    const tbody = document.getElementById('mkt-tbody');
    if (!tbody || !data.stocks) return;
    tbody.innerHTML = data.stocks.map(s => {
      const up  = s.changePercent >= 0;
      const prevPrice = prev?.stocks?.find(x => x.symbol === s.symbol)?.price;
      const flash = prevPrice && prevPrice !== s.price ? (s.price > prevPrice ? 'flash-up' : 'flash-down') : '';
      const vol = s.volume > 0 ? (s.volume / 1e5).toFixed(1) + ' L' : '—';
      const color = sectorColor(s.sector);
      return `<tr class="${flash}">
        <td><div style="display:flex;align-items:center;gap:8px">
          <div class="stk-avatar" style="background:${color}20;color:${color}">${s.symbol.charAt(0)}</div>
          <div><div class="stk-sym">${s.symbol}</div><div class="stk-name">${s.name}</div></div>
        </div></td>
        <td><span class="sector-tag" style="background:${color}15;color:${color}">${s.sector}</span></td>
        <td class="num ${up ? 'price--up' : 'price--down'}">${inr(s.price)}</td>
        <td class="num">${chg(s.changePercent)}</td>
        <td class="num muted">${vol}</td>
      </tr>`;
    }).join('');
  }

  /* gainers / losers */
  function renderMovers() {
    const gEl = document.getElementById('mkt-gainers');
    const lEl = document.getElementById('mkt-losers');
    if (gEl) gEl.innerHTML = (data.gainers || []).map(s => moverRow(s, true)).join('');
    if (lEl) lEl.innerHTML = (data.losers  || []).map(s => moverRow(s, false)).join('');
  }
  function moverRow(s, gain) {
    return `<div class="mover-row">
      <span class="mover-sym">${s.symbol}</span>
      <span class="mover-name">${s.name.split(' ').slice(0,2).join(' ')}</span>
      <span class="mover-chg ${gain ? 'price--up' : 'price--down'}">${gain ? '+' : ''}${s.changePercent.toFixed(2)}%</span>
    </div>`;
  }

  /* sector bars */
  function renderSectors() {
    const el = document.getElementById('mkt-sectors');
    if (!el || !data.sectors) return;
    const max = Math.max(...data.sectors.map(s => Math.abs(s.avgChange)), 1);
    el.innerHTML = data.sectors.map(s => {
      const up    = s.avgChange >= 0;
      const color = sectorColor(s.name);
      const w     = Math.abs(s.avgChange) / max * 100;
      return `<div class="sector-row">
        <div class="sector-row__name" style="color:${color}">${s.name}</div>
        <div class="sector-row__bar-wrap">
          <div class="sector-row__bar" style="width:${w.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="sector-row__chg ${up ? 'price--up' : 'price--down'}">${up ? '+' : ''}${s.avgChange.toFixed(2)}%</div>
      </div>`;
    }).join('');
  }

  return { init };
})();
