'use strict';
/* pages/optimizer.js — Portfolio Optimizer feature */

const OptimizerPage = (() => {
  const MAX_TICKERS      = 6;
  const MIN_TICKERS      = 2;
  const MAX_RESULTS_SHOW = 100;
  const MAX_SHARES_CAP   = 500;
  const TICKER_VARS      = ['a','b','c','d','e','f'];
  const CASH_VAR         = 'k';
  const API_SOLVE        = '/solve/v2';

  let selectedTickers = [];
  let liveQuotes      = {};
  let lastRun         = null;
  let $ = null;

  /* ── init ─────────────────────────────────────────────────────── */
  function init() {
    $ = {
      tickerInput:        document.getElementById('tickerInput'),
      tickerTags:         document.getElementById('tickerTags'),
      budgetInput:        document.getElementById('budgetInput'),
      maxLeftoverInput:   document.getElementById('maxLeftoverInput'),
      generateBtn:        document.getElementById('generateBtn'),
      statusDot:          document.getElementById('statusDot'),
      statusText:         document.getElementById('statusText'),
      statusMeta:         document.getElementById('statusMeta'),
      statusRequestId:    document.getElementById('statusRequestId'),
      liveBadge:          document.getElementById('liveBadge'),
      kpiStrip:           document.getElementById('kpiStrip'),
      kpiBudget:          document.getElementById('kpiBudget'),
      kpiInvested:        document.getElementById('kpiInvested'),
      kpiCash:            document.getElementById('kpiCash'),
      kpiCount:           document.getElementById('kpiCount'),
      resultsCard:        document.getElementById('resultsCard'),
      portfolioThead:     document.getElementById('portfolioThead'),
      portfolioTbody:     document.getElementById('portfolioTbody'),
      exportCsvBtn:       document.getElementById('exportCsvBtn'),
      emptyState:         document.getElementById('emptyState'),
      solverMath:         document.getElementById('solverMath'),
      equationDisplay:    document.getElementById('equationDisplay'),
      constraintsDisplay: document.getElementById('constraintsDisplay'),
      pricesDisplay:      document.getElementById('pricesDisplay'),
    };
    $.generateBtn.addEventListener('click', generatePortfolios);
    $.tickerInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTicker($.tickerInput.value.trim()); closeAutocomplete(); }
      if (e.key === 'Escape') closeAutocomplete();
    });
    $.tickerInput.addEventListener('input', () => showAutocomplete($.tickerInput.value));
    $.tickerInput.addEventListener('blur', () => setTimeout(closeAutocomplete, 150));
    document.querySelectorAll('.quick-ticker[data-ticker]').forEach(btn =>
      btn.addEventListener('click', () => addTicker(btn.dataset.ticker))
    );
    $.exportCsvBtn?.addEventListener('click', exportCSV);
    document.getElementById('shareBtn')?.addEventListener('click', sharePortfolio);
    setStatus('idle', 'Select tickers and a budget to generate portfolios.');
    $.kpiStrip.hidden    = true;
    $.resultsCard.hidden = true;
  }

  /* ── ticker management ────────────────────────────────────────── */
  const toVarName = idx => TICKER_VARS[idx];

  function addTicker(raw) {
    const sym = raw.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, '');
    if (!sym) return;
    if (sym.length > 10)                     { setStatus('warn', `Symbol "${sym}" is too long.`); return; }
    if (selectedTickers.includes(sym))       { $.tickerInput.value = ''; return; }
    if (selectedTickers.length >= MAX_TICKERS){ setStatus('warn', `Max ${MAX_TICKERS} tickers.`); return; }
    selectedTickers = [...selectedTickers, sym];
    $.tickerInput.value = '';
    closeAutocomplete();
    renderChips();
  }

  function removeTicker(sym) { selectedTickers = selectedTickers.filter(t => t !== sym); renderChips(); }

  function renderChips() {
    $.tickerTags.innerHTML = '';
    for (const sym of selectedTickers) {
      const chip = document.createElement('span');
      chip.className = 'ticker-chip';
      const lbl = document.createElement('span'); lbl.textContent = sym;
      const rm  = document.createElement('button');
      rm.className = 'ticker-chip__remove'; rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${sym}`); rm.textContent = '×';
      rm.addEventListener('click', () => removeTicker(sym));
      chip.appendChild(lbl); chip.appendChild(rm); $.tickerTags.appendChild(chip);
    }
    document.querySelectorAll('.quick-ticker[data-ticker]').forEach(btn => {
      const t = btn.dataset.ticker;
      if (selectedTickers.includes(t))           { btn.classList.add('is-active'); btn.disabled = true; }
      else if (selectedTickers.length >= MAX_TICKERS) { btn.classList.remove('is-active'); btn.disabled = true; }
      else                                        { btn.classList.remove('is-active'); btn.disabled = false; }
    });
  }

  /* ── autocomplete ─────────────────────────────────────────────── */
  function showAutocomplete(q) {
    const dropdown = document.getElementById('tickerDropdown');
    if (!dropdown) return;
    const results = tickerSearch(q);
    if (!results.length || !q.trim()) { closeAutocomplete(); return; }
    dropdown.innerHTML = '';
    results.forEach(item => {
      const opt = document.createElement('button');
      opt.className = 'autocomplete-opt';
      opt.type = 'button';
      const color = SECTOR_COLORS[item.sector] || '#6B7280';
      opt.innerHTML = `
        <span class="autocomplete-opt__sym" style="color:${color}">${item.symbol}</span>
        <span class="autocomplete-opt__name">${item.name}</span>
        <span class="autocomplete-opt__sector" style="background:${color}20;color:${color}">${item.sector}</span>`;
      opt.addEventListener('mousedown', e => { e.preventDefault(); addTicker(item.symbol); });
      dropdown.appendChild(opt);
    });
    dropdown.hidden = false;
  }
  function closeAutocomplete() {
    const d = document.getElementById('tickerDropdown'); if (d) d.hidden = true;
  }

  /* ── status helpers ───────────────────────────────────────────── */
  function setStatus(state, msg) {
    $.statusDot.className  = `status-dot status-dot--${state}`;
    $.statusText.textContent = msg;
  }
  function setRequestId(id) {
    $.statusMeta.hidden = !id;
    $.statusRequestId.textContent = id ? `req-${id}` : '';
  }
  function setLoading(on, msg = 'Solving…') {
    $.generateBtn.disabled = $.tickerInput.disabled = $.budgetInput.disabled = $.maxLeftoverInput.disabled = on;
    $.generateBtn.classList.toggle('is-loading', on);
    $.generateBtn.querySelector('.btn__text').textContent = on ? msg : 'Generate Portfolios';
  }
  function updateBadge(source) {
    if (!$.liveBadge) return;
    const isLive = source === 'live';
    $.liveBadge.className = `badge badge--live${isLive ? '' : ' badge--static'}`;
    $.liveBadge.innerHTML = `<span class="badge__dot"></span>${isLive ? 'Live Data' : source === 'static' ? 'Demo Prices' : 'Mixed'}`;
  }

  /* ── validation ───────────────────────────────────────────────── */
  function validateInputs() {
    if (selectedTickers.length < MIN_TICKERS) return { ok: false, message: `Add at least ${MIN_TICKERS} tickers.` };
    if (selectedTickers.length > MAX_TICKERS) return { ok: false, message: `Max ${MAX_TICKERS} tickers.` };
    const b = parseFloat($.budgetInput.value);
    if (!Number.isFinite(b) || b < 1)  return { ok: false, message: 'Enter a valid budget (≥ $1).' };
    if (b > 999_999)                   return { ok: false, message: 'Budget must be under $999,999.' };
    const l = parseFloat($.maxLeftoverInput.value);
    if (!Number.isFinite(l) || l < 0) return { ok: false, message: 'Max leftover must be ≥ $0.' };
    if (l >= b)                        return { ok: false, message: 'Max leftover must be less than budget.' };
    return { ok: true, budgetUsd: b, maxLeftoverUsd: l };
  }

  /* ── equation builder ─────────────────────────────────────────── */
  function buildPayload(tickers, quotes, budgetUsd, maxLeftoverUsd) {
    const budgetCents      = Math.round(budgetUsd * 100);
    const maxLeftoverCents = Math.round(maxLeftoverUsd * 100);
    const parts = []; const constraints = {}; const priceMap = {};
    tickers.forEach((ticker, idx) => {
      const price      = quotes[ticker].price;
      const priceCents = Math.round(price * 100);
      const varName    = toVarName(idx);
      if (priceCents <= 0) throw new Error(`Invalid price for ${ticker}: $${price}`);
      parts.push(`${priceCents}${varName}`);
      const maxShares = Math.min(Math.floor(budgetCents / priceCents), MAX_SHARES_CAP);
      constraints[varName] = { max: maxShares };
      priceMap[ticker] = { varName, priceCents, maxShares };
    });
    parts.push(`1${CASH_VAR}`);
    constraints[CASH_VAR] = { max: maxLeftoverCents };
    return { equation: `${parts.join(' + ')} = ${budgetCents}`, constraints, budgetCents, maxLeftoverCents, priceMap };
  }

  /* ── sort ─────────────────────────────────────────────────────── */
  function sortPortfolios(list, budgetCents) {
    return list.slice().sort((a, b) => {
      const cA = a[CASH_VAR] ?? 0, cB = b[CASH_VAR] ?? 0;
      const iA = budgetCents - cA,  iB = budgetCents - cB;
      if (iB !== iA) return iB - iA;
      if (cA !== cB) return cA - cB;
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
  }

  /* ── render KPIs ──────────────────────────────────────────────── */
  function renderKPIs(budgetUsd, sorted, budgetCents, total) {
    const bestCash = sorted[0]?.[CASH_VAR] ?? budgetCents;
    $.kpiBudget.textContent   = Format.usd(budgetUsd);
    $.kpiInvested.textContent = Format.usd((budgetCents - bestCash) / 100);
    $.kpiCash.textContent     = Format.usd(bestCash / 100);
    $.kpiCount.textContent    = String(total);
    $.kpiStrip.hidden = false;
  }

  /* ── render table ─────────────────────────────────────────────── */
  function renderTable(tickers, sorted, budgetCents) {
    $.portfolioThead.innerHTML = $.portfolioTbody.innerHTML = '';
    const trh = document.createElement('tr');
    [{ t: '#', c: 'col--number' }, ...tickers.map(t => ({ t: `${t} Shares`, c: 'col--shares' })),
     { t: 'Invested', c: 'col--money' }, { t: 'Cash Left', c: 'col--money' }, { t: '% Invested', c: 'col--pct' }]
      .forEach(({ t, c }) => { const th = document.createElement('th'); th.className = c; th.textContent = t; trh.appendChild(th); });
    $.portfolioThead.appendChild(trh);

    sorted.slice(0, MAX_RESULTS_SHOW).forEach((row, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.classList.add('row--best');
      const cashC    = row[CASH_VAR] ?? 0;
      const invested = budgetCents - cashC;
      const pct      = budgetCents > 0 ? (invested / budgetCents) * 100 : 0;

      const cells = [{ t: String(i + 1), c: 'col--number' }];
      tickers.forEach((_, idx) => cells.push({ t: String(row[toVarName(idx)] ?? 0), c: 'col--shares' }));
      cells.push({ t: Format.usd(invested / 100), c: 'col--money td--invested' });
      cells.push({ t: Format.usd(cashC / 100),    c: 'col--money td--cash' });
      cells.forEach(({ t, c }) => { const td = document.createElement('td'); td.className = c; td.textContent = t; tr.appendChild(td); });

      const tdPct = document.createElement('td'); tdPct.className = 'col--pct td--pct';
      tdPct.innerHTML = `<div class="pct-bar"><div class="pct-bar__track"><div class="pct-bar__fill" style="width:${Math.min(pct,100).toFixed(1)}%"></div></div><span class="pct-text">${Format.pct(pct)}</span></div>`;
      tr.appendChild(tdPct);
      $.portfolioTbody.appendChild(tr);
    });

    const meta = document.getElementById('tableMetaText');
    if (meta) meta.textContent = sorted.length > MAX_RESULTS_SHOW
      ? `Showing top ${MAX_RESULTS_SHOW} of ${sorted.length} portfolios`
      : `${sorted.length} portfolio${sorted.length !== 1 ? 's' : ''} found`;
    $.resultsCard.hidden = false;
    $.emptyState.hidden  = true;
    renderChart(tickers, sorted[0], budgetCents);
    renderSectorWarning(tickers);
  }

  /* ── donut chart ──────────────────────────────────────────────── */
  const CHART_COLORS = ['#1B64F2','#16A34A','#D97706','#7C3AED','#DB2777','#EA580C'];

  function renderChart(tickers, bestRow, budgetCents) {
    const chartEl = document.getElementById('allocationChart');
    if (!chartEl) return;
    const cashC = bestRow[CASH_VAR] ?? 0;
    const slices = tickers.map((t, idx) => ({
      label: t,
      value: (bestRow[toVarName(idx)] ?? 0) * (liveQuotes[t]?.price ?? 0),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    })).filter(s => s.value > 0);
    slices.push({ label: 'Cash', value: cashC / 100, color: '#E5E7EB' });

    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total <= 0) { chartEl.parentElement.hidden = true; return; }
    chartEl.parentElement.hidden = false;

    const cx = 80, cy = 80, rO = 68, rI = 42;
    let angle = -Math.PI / 2;
    const paths = slices.map(sl => {
      const sweep = (sl.value / total) * 2 * Math.PI;
      const x1 = cx + rO * Math.cos(angle),      y1 = cy + rO * Math.sin(angle);
      const x2 = cx + rO * Math.cos(angle+sweep), y2 = cy + rO * Math.sin(angle+sweep);
      const ix1= cx + rI * Math.cos(angle),       iy1= cy + rI * Math.sin(angle);
      const ix2= cx + rI * Math.cos(angle+sweep),  iy2= cy + rI * Math.sin(angle+sweep);
      const lg = sweep > Math.PI ? 1 : 0;
      const d = `M${x1},${y1} A${rO},${rO} 0 ${lg} 1 ${x2},${y2} L${ix2},${iy2} A${rI},${rI} 0 ${lg} 0 ${ix1},${iy1}Z`;
      angle += sweep;
      return { d, ...sl };
    });

    const pctInvested = ((budgetCents - cashC) / budgetCents * 100).toFixed(1);
    chartEl.innerHTML = `
      <svg viewBox="0 0 160 160" style="width:160px;height:160px;flex-shrink:0">
        ${paths.map((p,i) => `<path d="${p.d}" fill="${p.color}" stroke="#fff" stroke-width="1.5"><title>${p.label}: ${Format.usd(p.value)}</title></path>`).join('')}
        <text x="80" y="74" text-anchor="middle" font-size="14" font-weight="700" fill="#111827" font-family="Inter">${pctInvested}%</text>
        <text x="80" y="90" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="Inter">invested</text>
      </svg>
      <div class="chart-legend">
        ${paths.filter(p=>p.label!=='Cash').map(p=>
          `<div class="chart-legend__item">
            <span class="chart-legend__dot" style="background:${p.color}"></span>
            <span class="chart-legend__label">${p.label}</span>
            <span class="chart-legend__val">${Format.usd(p.value)}</span>
          </div>`).join('')}
        <div class="chart-legend__item">
          <span class="chart-legend__dot" style="background:#E5E7EB"></span>
          <span class="chart-legend__label">Cash</span>
          <span class="chart-legend__val">${Format.usd(cashC / 100)}</span>
        </div>
      </div>`;
  }

  /* ── sector concentration warning ────────────────────────────── */
  function renderSectorWarning(tickers) {
    const el = document.getElementById('sectorWarning');
    if (!el) return;
    const sectors = tickers.map(t => {
      const found = (typeof TICKER_LIST !== 'undefined' ? TICKER_LIST : []).find(x => x.symbol === t);
      return found?.sector || 'Other';
    });
    const counts = {};
    sectors.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const domSector = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const domPct = Math.round(domSector[1] / tickers.length * 100);
    if (domPct >= 60) {
      el.hidden = false;
      el.textContent = `⚠ Concentration risk: ${domPct}% of your portfolio is ${domSector[0]}. Consider adding tickers from other sectors.`;
    } else {
      el.hidden = true;
    }
  }

  /* ── math panel ───────────────────────────────────────────────── */
  function renderMathPanel(equation, constraints, priceMap, tickers) {
    $.equationDisplay.textContent    = equation;
    $.constraintsDisplay.textContent = JSON.stringify(constraints, null, 2);
    const lines = tickers.map((t, idx) => {
      const pm = priceMap[t]; const v = toVarName(idx);
      return `${v} = ${t}  →  $${liveQuotes[t]?.price?.toFixed(2)} = ${pm.priceCents} cents  [max ${pm.maxShares} shares]`;
    });
    lines.push(`${CASH_VAR} = cash  [max ${constraints[CASH_VAR]?.max ?? 0} cents leftover]`);
    $.pricesDisplay.textContent = lines.join('\n');
  }

  /* ── CSV export ───────────────────────────────────────────────── */
  function exportCSV() {
    if (!lastRun) return;
    const { tickers, sorted, budgetCents } = lastRun;
    const header = ['#', ...tickers.map(t => `${t} Shares`), 'Invested ($)', 'Cash Left ($)', '% Invested'].join(',');
    const rows = sorted.slice(0, MAX_RESULTS_SHOW).map((row, i) => {
      const cashC    = row[CASH_VAR] ?? 0;
      const invested = ((budgetCents - cashC) / 100).toFixed(2);
      const cash     = (cashC / 100).toFixed(2);
      const pct      = budgetCents > 0 ? ((budgetCents - cashC) / budgetCents * 100).toFixed(1) : '0.0';
      const shares   = tickers.map((_, idx) => row[toVarName(idx)] ?? 0).join(',');
      return `${i + 1},${shares},${invested},${cash},${pct}`;
    });
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `quantsolve-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── share portfolio ──────────────────────────────────────────── */
  function sharePortfolio() {
    if (!lastRun) return;
    const { tickers, sorted, budgetCents, source } = lastRun;
    const best = sorted[0];
    const cashC = best[CASH_VAR] ?? 0;
    const invested = (budgetCents - cashC) / 100;
    const pct = (invested / (budgetCents / 100) * 100).toFixed(1);
    const lines = [
      `📊 QuantSolve Portfolio (${source === 'live' ? 'Live prices' : 'Demo prices'})`,
      `Budget: ${Format.usd(budgetCents / 100)}  |  Invested: ${Format.usd(invested)} (${pct}%)`,
      '',
      ...tickers.map((t, idx) => {
        const shares = best[toVarName(idx)] ?? 0;
        const val    = shares * (liveQuotes[t]?.price ?? 0);
        return `${t}: ${shares} share${shares !== 1 ? 's' : ''} ≈ ${Format.usd(val)} @ ${Format.usd(liveQuotes[t]?.price ?? 0)}/share`;
      }),
      '',
      `Cash remaining: ${Format.usd(cashC / 100)}`,
      `Generated by QuantSolve — ${window.location.origin}`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const btn = document.getElementById('shareBtn');
      if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '↗ Share', 1800); }
    }).catch(() => alert(lines.join('\n')));
  }

  /* ── main generate flow ───────────────────────────────────────── */
  async function generatePortfolios() {
    const v = validateInputs();
    if (!v.ok) { setStatus('warn', v.message); return; }
    const { budgetUsd, maxLeftoverUsd } = v;

    $.resultsCard.hidden = $.kpiStrip.hidden = true;
    $.emptyState.hidden  = true;
    setRequestId(null);
    setLoading(true, 'Fetching live prices…');
    setStatus('loading', `Fetching quotes for ${selectedTickers.join(', ')}…`);

    let source = 'static', warning = '';
    try {
      const resp = await MarketClient.fetchQuotes(selectedTickers);
      liveQuotes = resp.data;
      source     = resp.source;
      warning    = resp.warning || '';
      updateBadge(source);
    } catch (err) {
      setStatus('error', `Price fetch failed: ${err.message}`);
      setLoading(false);
      return;
    }

    const missing = selectedTickers.filter(t => !liveQuotes[t]?.price);
    if (missing.length) { setStatus('error', `No price data for: ${missing.join(', ')}`); setLoading(false); return; }

    let equation, constraints, budgetCents, maxLeftoverCents, priceMap;
    try {
      ({ equation, constraints, budgetCents, maxLeftoverCents, priceMap } =
        buildPayload(selectedTickers, liveQuotes, budgetUsd, maxLeftoverUsd));
    } catch (err) { setStatus('error', err.message); setLoading(false); return; }

    setStatus('loading', 'Running integer-linear solver…');
    setLoading(true, 'Thinking…');

    const priceStr = selectedTickers.map(t => `${t} ${Format.usd(liveQuotes[t].price)}`).join(' · ');
    renderMathPanel(equation, constraints, priceMap, selectedTickers);

    let solveResp;
    try {
      const res = await fetch(API_SOLVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation, constraints }),
      });
      solveResp = await res.json();
      setRequestId(solveResp.requestId || null);
    } catch (err) { setStatus('error', `Solver unreachable: ${err.message}`); setLoading(false); return; }

    setLoading(false);

    if (!solveResp.ok) {
      const msg = solveResp.message || 'Solver returned an error.';
      setStatus('error', msg);
      $.emptyState.hidden = false;
      $.emptyState.querySelector('.empty-state__desc').textContent = msg;
      return;
    }

    if (!Array.isArray(solveResp.data) || solveResp.data.length === 0) {
      setStatus('warn', 'No feasible portfolios found. Try increasing budget or max cash leftover.');
      $.emptyState.hidden = false;
      $.emptyState.querySelector('.empty-state__desc').textContent =
        `No whole-share portfolios fit. Equation: ${equation}`;
      return;
    }

    const total  = solveResp.data.length;
    const sorted = sortPortfolios(solveResp.data, budgetCents);
    lastRun = { tickers: selectedTickers, sorted, budgetCents, equation, priceMap, source };

    renderKPIs(budgetUsd, sorted, budgetCents, total);
    renderTable(selectedTickers, sorted, budgetCents);

    const bestCash    = sorted[0][CASH_VAR] ?? 0;
    const investedStr = Format.usd((budgetCents - bestCash) / 100);
    const warnNote    = warning ? ` ⚠ ${warning}` : '';
    setStatus(warning ? 'warn' : 'success',
      `${total} portfolio${total !== 1 ? 's' : ''} found · Best: ${investedStr} invested · ${priceStr}${warnNote}`);

    // persist to history
    const run = {
      id:          Format.nanoid(),
      timestamp:   Date.now(),
      tickers:     selectedTickers,
      budget:      budgetUsd,
      maxLeftover: maxLeftoverUsd,
      equation,
      constraints,
      priceMap,
      source,
      total,
      bestPct:     budgetCents > 0 ? +((budgetCents - bestCash) / budgetCents * 100).toFixed(1) : 0,
      portfolios:  sorted,
    };
    // persist to server (per-user DB) + local copy for compare page
    AuthClient.apiFetch('/user/history', {
      method: 'POST',
      body: JSON.stringify(run),
    }).then(() => App.updateUsageCounter()).catch(() => {});
    Storage.history.save(run);
  }

  /* ── public API ───────────────────────────────────────────────── */
  function loadParams({ tickers = [], budget, maxLeftover }) {
    selectedTickers = [];
    tickers.forEach(t => { if (selectedTickers.length < MAX_TICKERS) selectedTickers.push(t); });
    renderChips();
    if (budget      != null) $.budgetInput.value      = budget;
    if (maxLeftover != null) $.maxLeftoverInput.value = maxLeftover;
    setStatus('idle', `Loaded: ${tickers.join(', ')} — click Generate to re-run.`);
    $.kpiStrip.hidden = $.resultsCard.hidden = true;
  }

  return { init, loadParams };
})();
