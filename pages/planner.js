'use strict';
/* pages/planner.js — Stock Budget Planner logic */

const PlannerPage = (() => {
  const VARS     = ['a','b','c','d','e','f'];
  const COLORS   = ['#1B64F2','#16A34A','#DC2626','#D97706','#7C3AED','#0891B2'];
  const HISTORY_KEY = 'qs_history';

  // Popular NSE stocks with fallback data
  const STOCKS = [
    { sym:'RELIANCE',  name:'Reliance Industries', sector:'Energy',    price:2948.50 },
    { sym:'TCS',       name:'Tata Consultancy',    sector:'IT',        price:3812.75 },
    { sym:'INFY',      name:'Infosys',             sector:'IT',        price:1782.40 },
    { sym:'HDFCBANK',  name:'HDFC Bank',           sector:'Banking',   price:1662.20 },
    { sym:'ICICIBANK', name:'ICICI Bank',          sector:'Banking',   price:1248.65 },
    { sym:'SBIN',      name:'State Bank of India', sector:'Banking',   price:812.30  },
    { sym:'WIPRO',     name:'Wipro',               sector:'IT',        price:480.10  },
    { sym:'TATAMOTORS',name:'Tata Motors',         sector:'Auto',      price:762.55  },
    { sym:'AXISBANK',  name:'Axis Bank',           sector:'Banking',   price:1098.40 },
    { sym:'BAJFINANCE',name:'Bajaj Finance',       sector:'Finance',   price:7124.80 },
    { sym:'MARUTI',    name:'Maruti Suzuki',       sector:'Auto',      price:12456.30},
    { sym:'SUNPHARMA', name:'Sun Pharmaceuticals', sector:'Pharma',    price:1684.25 },
    { sym:'TECHM',     name:'Tech Mahindra',       sector:'IT',        price:1512.75 },
    { sym:'LTIM',      name:'LTIMindtree',         sector:'IT',        price:5234.60 },
    { sym:'ONGC',      name:'ONGC',                sector:'Energy',    price:268.40  },
    { sym:'NTPC',      name:'NTPC',                sector:'Energy',    price:358.90  },
    { sym:'POWERGRID', name:'Power Grid Corp',     sector:'Energy',    price:312.75  },
    { sym:'COALINDIA', name:'Coal India',          sector:'Energy',    price:398.60  },
    { sym:'ULTRACEMCO',name:'UltraTech Cement',    sector:'Cement',    price:10892.40},
    { sym:'ASIANPAINT',name:'Asian Paints',        sector:'Consumer',  price:2654.30 },
    { sym:'TITAN',     name:'Titan Company',       sector:'Consumer',  price:3312.80 },
    { sym:'NESTLEIND', name:'Nestlé India',        sector:'Consumer',  price:2256.40 },
  ];

  let selected  = new Set();
  let liveData  = {}; // sym → { price, changePercent }
  let filteredStocks = [...STOCKS];
  let $ = null;

  /* ─── init ──────────────────────────────────────── */
  function init() {
    $ = {
      grid:          document.getElementById('planner-stockGrid'),
      search:        document.getElementById('planner-search'),
      clearSel:      document.getElementById('planner-clearSel'),
      selCount:      document.getElementById('planner-selectedCount'),
      selHint:       document.getElementById('planner-selectionHint'),
      slider:        document.getElementById('planner-slider'),
      budgetDisplay: document.getElementById('planner-budgetDisplay'),
      maxLeftover:   document.getElementById('planner-maxLeftover'),
      runBtn:        document.getElementById('planner-runBtn'),
      status:        document.getElementById('planner-status'),
      kpi:           document.getElementById('planner-kpi'),
      kpiBudget:     document.getElementById('kpi-budget'),
      kpiInvested:   document.getElementById('kpi-invested'),
      kpiCash:       document.getElementById('kpi-cash'),
      kpiCount:      document.getElementById('kpi-count'),
      allocCard:     document.getElementById('planner-allocCard'),
      allocBars:     document.getElementById('planner-allocBars'),
      exportBtn:     document.getElementById('planner-exportBtn'),
      resultsCard:   document.getElementById('planner-resultsCard'),
      resultsList:   document.getElementById('planner-resultsList'),
      resultMeta:    document.getElementById('planner-resultMeta'),
      empty:         document.getElementById('planner-empty'),
    };

    $.search.addEventListener('input', () => filterGrid($.search.value));
    $.clearSel.addEventListener('click', () => { selected.clear(); updateSelectionUI(); renderGrid(); });
    $.slider.addEventListener('input', onSliderChange);
    $.runBtn.addEventListener('click', run);
    $.exportBtn?.addEventListener('click', exportCSV);

    document.querySelectorAll('[data-budget]').forEach(btn =>
      btn.addEventListener('click', () => { $.slider.value = btn.dataset.budget; onSliderChange(); })
    );

    // Load prefill from watchlist/history navigation
    const prefill = localStorage.getItem('qs_planner_prefill');
    if (prefill) {
      localStorage.removeItem('qs_planner_prefill');
      try {
        const { tickers, budget, maxLeftover } = JSON.parse(prefill);
        (tickers || []).forEach(t => selected.add(t));
        if (budget)      { $.slider.value = budget; onSliderChange(); }
        if (maxLeftover) { $.maxLeftover.value = maxLeftover; }
      } catch {}
    }

    onSliderChange();
    renderGrid();
    fetchLivePrices();
  }

  /* ─── slider ─────────────────────────────────────── */
  function onSliderChange() {
    const val = Number($.slider.value);
    const pct = ((val - 10000) / (10000000 - 10000)) * 100;
    $.slider.style.setProperty('--pct', pct + '%');
    $.budgetDisplay.textContent = '₹' + val.toLocaleString('en-IN');
  }

  /* ─── stock grid ─────────────────────────────────── */
  function filterGrid(query) {
    const q = query.toUpperCase().trim();
    filteredStocks = q
      ? STOCKS.filter(s => s.sym.includes(q) || s.name.toUpperCase().includes(q) || s.sector.toUpperCase().includes(q))
      : [...STOCKS];
    renderGrid();
  }

  function renderGrid() {
    $.grid.innerHTML = '';
    filteredStocks.forEach(s => {
      const live  = liveData[s.sym];
      const price = live?.price ?? s.price;
      const chg   = live?.changePercent ?? null;
      const isUp  = chg > 0, isDown = chg < 0;

      const card = document.createElement('div');
      card.className = 'stock-card' + (selected.has(s.sym) ? ' selected' : '');
      card.innerHTML = `
        <div class="stock-card__check">✓</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="stock-card__avatar">${s.sym[0]}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${s.sym}</div>
            <div class="stock-card__name">${s.name}</div>
          </div>
        </div>
        <div class="stock-card__price">₹${price.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        ${chg != null
          ? `<div class="stock-card__chg" style="color:${isUp?'#16A34A':isDown?'#DC2626':'#6B7280'}">${isUp?'▲':isDown?'▼':''}${isUp?'+':''}${chg.toFixed(2)}%</div>`
          : `<div class="stock-card__chg" style="color:var(--text-faint)">—</div>`}
        <div style="font-size:10px;margin-top:4px;color:var(--text-faint)">${s.sector}</div>`;

      card.addEventListener('click', () => {
        if (selected.has(s.sym)) {
          selected.delete(s.sym);
        } else {
          if (selected.size >= 6) { $.selHint.textContent = 'Maximum 6 stocks selected.'; return; }
          selected.add(s.sym);
        }
        updateSelectionUI();
        renderGrid();
      });
      $.grid.appendChild(card);
    });
  }

  function updateSelectionUI() {
    const n = selected.size;
    $.selCount.textContent = `${n} selected`;
    $.selHint.textContent  = n < 2 ? (n === 0 ? '' : 'Select at least 2 stocks.') : n > 6 ? 'Max 6.' : '';
    $.selCount.style.color = n >= 2 && n <= 6 ? '#16A34A' : n > 6 ? '#DC2626' : '#6B7280';
  }

  /* ─── fetch live prices ──────────────────────────── */
  async function fetchLivePrices() {
    const syms = STOCKS.map(s => s.sym);
    try {
      const resp = await fetch(`/market/quotes?symbols=${syms.join(',')}`);
      const json = await resp.json();
      const data = json.data ?? {};
      for (const [sym, info] of Object.entries(data)) {
        if (info.price) liveData[sym] = info;
      }
      renderGrid();
    } catch { /* use fallback prices */ }
  }

  /* ─── run solver ─────────────────────────────────── */
  async function run() {
    if (selected.size < 2) { $.selHint.textContent = 'Select at least 2 stocks.'; return; }
    if (selected.size > 6) { $.selHint.textContent = 'Maximum 6 stocks.'; return; }

    const tickers    = [...selected];
    const budget     = Number($.slider.value);
    const maxLeftover= Number($.maxLeftover.value) || 500;

    // Build prices map
    const prices = {};
    tickers.forEach(sym => {
      const live = liveData[sym];
      const fb   = STOCKS.find(s => s.sym === sym);
      prices[sym] = live?.price ?? fb?.price ?? 1000;
    });

    // Build equation: sum(price_i * var_i) + r = budget
    // 'r' = remainder/cash leftover — always a single letter, never conflicts with a-f
    const priceFactors = tickers.map((sym, i) => `${Math.round(prices[sym])}${VARS[i]}`).join(' + ');
    const equation     = `${priceFactors} + r = ${budget}`;

    const constraints = {};
    tickers.forEach((sym, i) => {
      constraints[VARS[i]] = { min: 0, max: Math.floor(budget / Math.round(prices[sym])) };
    });
    constraints['r'] = { min: 0, max: maxLeftover };

    setStatus('loading', '⟳ Solving… this may take a moment');
    $.runBtn.disabled = true;
    $.kpi.hidden = true; $.allocCard.hidden = true; $.resultsCard.hidden = true; $.empty.hidden = true;

    try {
      const resp = await fetch('/solve/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation, constraints }),
      });
      const json = await resp.json();

      if (!json.ok) { setStatus('error', '✕ ' + json.message); $.empty.hidden = false; return; }

      const results = json.data;
      if (typeof results === 'string') { setStatus('warn', '⚠ ' + results); $.empty.hidden = false; return; }
      if (!Array.isArray(results) || results.length === 0) {
        setStatus('warn', '⚠ No valid allocations found. Try increasing the budget or max leftover.');
        $.empty.hidden = false; return;
      }

      // Sort by cash leftover ascending (most invested first)
      results.sort((a, b) => (a['r'] ?? 0) - (b['r'] ?? 0));
      const best = results[0];
      const bestInvested = budget - (best['r'] ?? 0);
      const bestPct      = ((bestInvested / budget) * 100).toFixed(1);

      // KPIs
      $.kpi.hidden = false;
      $.kpiBudget.textContent   = fmtInr(budget);
      $.kpiInvested.textContent = fmtInr(bestInvested);
      $.kpiCash.textContent     = fmtInr(best['r'] ?? 0);
      $.kpiCount.textContent    = results.length;

      // Allocation bars for best result
      renderAllocBars(best, tickers, prices, budget);

      // Results list
      renderResultsList(results, tickers, prices, budget);

      setStatus('success', `✓ Found ${results.length} valid allocation${results.length !== 1 ? 's' : ''}`);

      // Save to history
      saveHistory({ tickers, budget, maxLeftover, total: results.length, bestPct: parseFloat(bestPct),
        source: 'live', portfolios: results.slice(0, 10) });

    } catch (err) {
      setStatus('error', '✕ ' + err.message);
      $.empty.hidden = false;
    } finally {
      $.runBtn.disabled = false;
    }
  }

  /* ─── alloc bars ────────────────────────────────── */
  function renderAllocBars(best, tickers, prices, budget) {
    $.allocCard.hidden = false;
    $.allocBars.innerHTML = '';

    const cashLeft = best['r'] ?? 0;
    const invested = budget - cashLeft;

    tickers.forEach((sym, i) => {
      const shares = best[VARS[i]] ?? 0;
      const value  = shares * Math.round(prices[sym]);
      const pct    = budget > 0 ? ((value / budget) * 100).toFixed(1) : 0;
      const color  = COLORS[i % COLORS.length];

      const row = document.createElement('div');
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0"></div>
            <span style="font-weight:600;font-size:14px">${sym}</span>
            <span style="font-size:12px;color:var(--text-muted)">${shares} share${shares!==1?'s':''}</span>
          </div>
          <div style="text-align:right">
            <span style="font-weight:700">${fmtInr(value)}</span>
            <span style="font-size:11px;color:var(--text-faint);margin-left:6px">${pct}%</span>
          </div>
        </div>
        <div style="height:8px;border-radius:4px;background:#F3F4F6;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 600ms ease"></div>
        </div>`;
      $.allocBars.appendChild(row);
    });

    // Cash row
    const cashPct = budget > 0 ? ((cashLeft / budget) * 100).toFixed(1) : 0;
    if (cashLeft > 0) {
      const cashRow = document.createElement('div');
      cashRow.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;margin-top:4px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:12px;height:12px;border-radius:3px;background:#E5E7EB;flex-shrink:0"></div>
            <span style="font-weight:600;font-size:14px;color:var(--text-muted)">Cash Left</span>
          </div>
          <div><span style="font-weight:600;color:var(--text-muted)">${fmtInr(cashLeft)}</span>
            <span style="font-size:11px;color:var(--text-faint);margin-left:6px">${cashPct}%</span>
          </div>
        </div>
        <div style="height:8px;border-radius:4px;background:#F3F4F6;overflow:hidden">
          <div style="height:100%;width:${cashPct}%;background:#E5E7EB;border-radius:4px"></div>
        </div>`;
      $.allocBars.appendChild(cashRow);
    }
  }

  /* ─── results list ──────────────────────────────── */
  function renderResultsList(results, tickers, prices, budget) {
    $.resultsCard.hidden = false;
    const shown = results.slice(0, 100);
    $.resultMeta.textContent = results.length > 100 ? `Showing first 100 of ${results.length}` : `${results.length} combination${results.length!==1?'s':''}`;
    $.resultsList.innerHTML = '';

    shown.forEach((row, i) => {
      const cashLeft = row['r'] ?? 0;
      const invested = budget - cashLeft;
      const pct      = ((invested / budget) * 100).toFixed(1);

      const card = document.createElement('div');
      card.className = 'result-card' + (i === 0 ? ' best' : '');
      card.innerHTML = `
        <div class="result-rank ${i === 0 ? 'gold' : ''}">${i === 0 ? '🥇' : i + 1}</div>
        <div style="flex:1">
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px">
            ${tickers.map((sym, si) => {
              const shares = row[VARS[si]] ?? 0;
              return `<span><strong style="font-family:monospace">${shares}</strong> <span style="color:var(--text-muted)">${sym}</span></span>`;
            }).join('')}
          </div>
          <div class="alloc-bar" style="margin-top:6px">
            ${tickers.map((sym, si) => {
              const shares = row[VARS[si]] ?? 0;
              const val = shares * Math.round(prices[sym]);
              const w = budget > 0 ? ((val / budget) * 100).toFixed(1) : 0;
              return `<div style="width:${w}%;height:100%;background:${COLORS[si%COLORS.length]}" title="${sym}: ₹${val.toLocaleString('en-IN')}"></div>`;
            }).join('')}
          </div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div style="font-weight:700;font-size:13px;color:${i===0?'#1B64F2':'var(--text-primary)'}">${pct}%</div>
          <div style="font-size:11px;color:var(--text-faint)">₹${cashLeft.toLocaleString('en-IN')} left</div>
        </div>`;
      $.resultsList.appendChild(card);
    });
  }

  /* ─── history ────────────────────────────────────── */
  function saveHistory(run) {
    try {
      const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      all.unshift({ ...run, id: Date.now().toString(), timestamp: Date.now() });
      if (all.length > 50) all.length = 50;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch {}
  }

  /* ─── export CSV ─────────────────────────────────── */
  function exportCSV() {
    const tickers = [...selected];
    const rows    = $.resultsList.querySelectorAll('.result-card');
    if (!rows.length) return;

    const budget = Number($.slider.value);
    const headers = ['Rank', ...tickers, 'Cash Left (₹)', '% Invested'];
    const lines = [headers.join(',')];

    rows.forEach((card, i) => {
      const cells = card.querySelectorAll('strong');
      const shares = tickers.map((_, si) => {
        const el = card.querySelector(`strong`);
        return el ? el.textContent : 0;
      });
      lines.push([i + 1, ...shares, '', ''].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `quantsolve-plan-${budget}.csv`;
    a.click();
  }

  /* ─── helpers ────────────────────────────────────── */
  function fmtInr(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function setStatus(type, msg) {
    $.status.textContent = msg;
    $.status.style.color = { success:'#16A34A', error:'#DC2626', warn:'#D97706', loading:'#1B64F2' }[type] || '#374151';
  }

  return { init };
})();
