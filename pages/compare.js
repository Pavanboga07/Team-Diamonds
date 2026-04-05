'use strict';
/* pages/compare.js — Side-by-side portfolio comparison (localStorage) */

const ComparePage = (() => {
  const HISTORY_KEY = 'qs_history';
  let $ = null;

  function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }

  function fmtInr(n) {
    if (!n && n !== 0) return '—';
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function init() {
    $ = {
      pickerA:    document.getElementById('cmp-picker-a'),
      pickerB:    document.getElementById('cmp-picker-b'),
      result:     document.getElementById('cmp-result'),
      compareBtn: document.getElementById('cmp-compareBtn'),
      tableWrap:  document.getElementById('cmp-table-wrap'),
    };
    $.compareBtn.addEventListener('click', runCompare);
    renderPickers();

    // Pre-select a run if navigated from history
    const prefillId = localStorage.getItem('qs_compare_prefill');
    if (prefillId) {
      localStorage.removeItem('qs_compare_prefill');
      setTimeout(() => setPickerValue('a', prefillId), 50);
    }
  }

  function renderPickers() {
    const runs   = getHistory();
    const noData = `<p style="color:var(--text-muted);padding:16px;font-size:13px">No history yet — run the Stock Budget Planner first.</p>`;
    [$.pickerA, $.pickerB].forEach((el, idx) => {
      if (!el) return;
      el.innerHTML = runs.length ? '' : noData;
      runs.forEach(run => {
        const label = document.createElement('label');
        label.className = 'cmp-option';
        const name = idx === 0 ? 'cmp-run-a' : 'cmp-run-b';
        label.innerHTML = `
          <input type="radio" name="${name}" value="${run.id}">
          <span class="cmp-option__inner">
            <span style="font-weight:600">${(run.tickers || []).join(' + ')}</span>
            <span style="font-size:11px;color:var(--text-muted)">${fmtInr(run.budget)} · ${run.total ?? '?'} solutions · ${run.bestPct ?? '?'}% invested</span>
          </span>`;
        el.appendChild(label);
      });
    });
  }

  function setPickerValue(side, id) {
    const radio = document.querySelector(`input[name="cmp-run-${side}"][value="${id}"]`);
    if (radio) radio.checked = true;
  }

  function getSelected(side) {
    const radio = document.querySelector(`input[name="cmp-run-${side}"]:checked`);
    if (!radio) return null;
    return getHistory().find(r => r.id === radio.value) || null;
  }

  function runCompare() {
    const a = getSelected('a');
    const b = getSelected('b');
    if (!a || !b) { alert('Select a run for both sides.'); return; }
    if (a.id === b.id) { alert('Select two different runs.'); return; }
    $.result.hidden   = false;
    $.tableWrap.innerHTML = buildTable(a, b);
  }

  function buildTable(a, b) {
    const VARS = ['a','b','c','d','e','f'];
    const allTickers = [...new Set([...(a.tickers || []), ...(b.tickers || [])])];

    const rows = [
      ['Budget',            fmtInr(a.budget),      fmtInr(b.budget)],
      ['Max Leftover',      fmtInr(a.maxLeftover),  fmtInr(b.maxLeftover)],
      ['Solutions Found',   String(a.total ?? '—'), String(b.total ?? '—')],
      ['Best % Invested',   `${a.bestPct ?? '—'}%`, `${b.bestPct ?? '—'}%`],
      ['Source',            a.source ?? '—',        b.source ?? '—'],
    ];

    if (a.portfolios?.[0] && b.portfolios?.[0]) {
      const aRow = a.portfolios[0], bRow = b.portfolios[0];
      allTickers.forEach(t => {
        const ai = (a.tickers || []).indexOf(t), bi = (b.tickers || []).indexOf(t);
        const aS = ai >= 0 ? (aRow[VARS[ai]] ?? '—') : '—';
        const bS = bi >= 0 ? (bRow[VARS[bi]] ?? '—') : '—';
        rows.push([`${t} Shares (best)`, String(aS), String(bS)]);
      });
    }

    const hA = `${(a.tickers||[]).join('+')} @ ${fmtInr(a.budget)}`;
    const hB = `${(b.tickers||[]).join('+')} @ ${fmtInr(b.budget)}`;

    const rowHtml = rows.map(([label, va, vb], i) => `
      <tr style="${i%2===0?'':'background:#F9FAFB'}">
        <td style="padding:8px 14px;color:var(--text-muted);font-size:12px;font-weight:500">${label}</td>
        <td style="padding:8px 14px;text-align:center;font-weight:600;color:#1B64F2">${va}</td>
        <td style="padding:8px 14px;text-align:center;font-weight:600;color:#16A34A">${vb}</td>
      </tr>`).join('');

    return `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="padding:10px 14px;background:#F9FAFB;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase">Metric</th>
        <th style="padding:10px 14px;background:#EFF6FF;text-align:center;color:#1B64F2;font-size:12px">${hA}</th>
        <th style="padding:10px 14px;background:#F0FDF4;text-align:center;color:#16A34A;font-size:12px">${hB}</th>
      </tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>`;
  }

  return { init };
})();
