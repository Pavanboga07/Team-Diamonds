'use strict';
/* pages/compare.js — Side-by-side portfolio comparison */

const ComparePage = (() => {
  let preloadId = null;
  let $ = null;

  function init() {
    $ = {
      pickerA:   document.getElementById('cmp-picker-a'),
      pickerB:   document.getElementById('cmp-picker-b'),
      result:    document.getElementById('cmp-result'),
      compareBtn:document.getElementById('cmp-compareBtn'),
      tableWrap: document.getElementById('cmp-table-wrap'),
    };
    $.compareBtn.addEventListener('click', runCompare);
    renderPickers();
    if (preloadId) { setPickerValue('a', preloadId); preloadId = null; }
  }

  function preload(id) { preloadId = id; }

  function renderPickers() {
    const runs   = Storage.history.getAll();
    const noData = `<p style="color:var(--text-muted);padding:16px;font-size:13px">No history yet — run some portfolios first.</p>`;
    [$.pickerA, $.pickerB].forEach((el, idx) => {
      if (!el) return;
      el.innerHTML = runs.length ? '' : noData;
      runs.forEach(run => {
        const opt = document.createElement('label');
        opt.className = 'cmp-option';
        opt.innerHTML = `
          <input type="radio" name="cmp-run-${idx === 0 ? 'a' : 'b'}" value="${run.id}">
          <span class="cmp-option__inner">
            <span>${run.tickers.join(', ')}</span>
            <span style="font-size:11px;color:var(--text-muted)">${Format.usd(run.budget)} · ${run.total} solutions · ${Format.timeago(run.timestamp)}</span>
          </span>`;
        el.appendChild(opt);
      });
    });
  }

  function setPickerValue(side, id) {
    const name = `cmp-run-${side}`;
    const radio = document.querySelector(`input[name="${name}"][value="${id}"]`);
    if (radio) radio.checked = true;
  }

  function getSelected(side) {
    const name  = `cmp-run-${side}`;
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? Storage.history.getById(radio.value) : null;
  }

  function runCompare() {
    const a = getSelected('a');
    const b = getSelected('b');
    if (!a || !b) { alert('Please select a run for both sides.'); return; }
    if (a.id === b.id) { alert('Please select two different runs.'); return; }
    $.result.hidden = false;
    $.tableWrap.innerHTML = buildComparisonTable(a, b);
  }

  function buildComparisonTable(a, b) {
    const CASH_VAR = 'k';
    const allTickers = [...new Set([...a.tickers, ...b.tickers])];

    const rows = [
      ['Budget',       Format.usd(a.budget),     Format.usd(b.budget)],
      ['Max Leftover', Format.usd(a.maxLeftover), Format.usd(b.maxLeftover)],
      ['Solutions',    String(a.total),            String(b.total)],
      ['Best % Invested', `${a.bestPct}%`,         `${b.bestPct}%`],
      ['Source',       a.source,                   b.source],
      ['Run time',     Format.datetime(a.timestamp), Format.datetime(b.timestamp)],
    ];

    if (a.portfolios?.[0] && b.portfolios?.[0]) {
      const aRow = a.portfolios[0]; const bRow = b.portfolios[0];
      const aCash = aRow[CASH_VAR] ?? 0; const bCash = bRow[CASH_VAR] ?? 0;
      rows.push(['Best — Cash Left', Format.usd(aCash / 100), Format.usd(bCash / 100)]);
      allTickers.forEach(t => {
        const aIdx = a.tickers.indexOf(t); const bIdx = b.tickers.indexOf(t);
        const aShares = aIdx >= 0 ? (aRow[['a','b','c','d','e','f'][aIdx]] ?? 0) : '—';
        const bShares = bIdx >= 0 ? (bRow[['a','b','c','d','e','f'][bIdx]] ?? 0) : '—';
        rows.push([`Best — ${t} Shares`, String(aShares), String(bShares)]);
      });
    }

    const headerA = `${a.tickers.join('+')} @ ${Format.usd(a.budget)}`;
    const headerB = `${b.tickers.join('+')} @ ${Format.usd(b.budget)}`;

    return `<table class="portfolio-table" style="font-size:13px">
      <thead><tr>
        <th style="text-align:left">Metric</th>
        <th style="text-align:center;color:var(--primary)">${headerA}</th>
        <th style="text-align:center;color:var(--gain)">${headerB}</th>
      </tr></thead>
      <tbody>${rows.map(([label, va, vb]) => `
        <tr>
          <td style="color:var(--text-muted);font-size:12px">${label}</td>
          <td style="text-align:center;font-weight:600">${va}</td>
          <td style="text-align:center;font-weight:600">${vb}</td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  return { init, preload };
})();
