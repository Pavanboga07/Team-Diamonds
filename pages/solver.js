'use strict';
/* pages/solver.js — Algebraic Equation Solver UI */

const SolverPage = (() => {
  let $ = null;

  function init() {
    $ = {
      eqInput:     document.getElementById('slv-equation'),
      solveBtn:    document.getElementById('slv-solveBtn'),
      addCon:      document.getElementById('slv-addConstraint'),
      conList:     document.getElementById('slv-constraintList'),
      status:      document.getElementById('slv-status'),
      resultsWrap: document.getElementById('slv-results'),
      resultTable: document.getElementById('slv-table'),
      resultMeta:  document.getElementById('slv-meta'),
      exampleBtns: document.querySelectorAll('[data-example]'),
    };

    $.solveBtn.addEventListener('click', solve);
    $.addCon.addEventListener('click', () => addConstraintRow());
    $.exampleBtns.forEach(btn =>
      btn.addEventListener('click', () => loadExample(btn.dataset.example))
    );
    $.eqInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') solve();
    });

    // Pre-load example 1 for instant wow factor
    loadExample('simple');
  }

  /* ── constraint rows ─────────────────────────────── */
  function addConstraintRow(varName = '', minVal = '', maxVal = '') {
    const row = document.createElement('div');
    row.className = 'slv-con-row';
    row.innerHTML = `
      <span style="font-size:11px;color:#6B7280;font-weight:600">var</span>
      <input class="slv-con-var field-input" placeholder="x" maxlength="10" value="${varName}"
        style="width:60px;text-align:center;font-family:monospace;font-weight:700;font-size:14px"/>
      <span class="slv-con-badge" style="font-size:11px;color:#9CA3AF">≥</span>
      <input class="slv-con-min field-input" placeholder="0" value="${minVal}" type="number"
        style="width:80px" title="Minimum value (≥)"/>
      <span class="slv-con-badge" style="font-size:11px;color:#9CA3AF">≤</span>
      <input class="slv-con-max field-input" placeholder="∞" value="${maxVal}" type="number"
        style="width:80px" title="Maximum value (≤)"/>
      <button class="slv-con-remove" type="button" title="Remove constraint">✕</button>`;
    row.querySelector('.slv-con-remove').addEventListener('click', () => row.remove());
    $.conList.appendChild(row);
  }

  /* ── examples ────────────────────────────────────── */
  function loadExample(id) {
    $.conList.innerHTML = '';
    $.resultsWrap.hidden = true;
    setStatus('', '');

    const examples = {
      simple:    () => { $.eqInput.value = '50x = 200'; },
      twovars:   () => { $.eqInput.value = '10x + 20y = 100'; },
      fivevars:  () => { $.eqInput.value = '10a + 15b + 20c + 50d + 5e = 1000'; },
      brackets:  () => { $.eqInput.value = '(10x + 20y) * 2 + 5z = 500'; },
      portfolio: () => {
        $.eqInput.value = '2948a + 3812b + 1782c + 1662d = 500000';
        addConstraintRow('a', '0', '50');
        addConstraintRow('b', '0', '30');
        addConstraintRow('c', '0', '80');
        addConstraintRow('d', '0', '100');
      },
      impossible:() => { $.eqInput.value = '2x + 4y = 3'; },
    };

    if (examples[id]) examples[id]();
  }

  /* ── build constraints ───────────────────────────── */
  function buildConstraints() {
    const con = {};
    $.conList.querySelectorAll('.slv-con-row').forEach(row => {
      const varName = row.querySelector('.slv-con-var').value.trim();
      const minVal  = row.querySelector('.slv-con-min').value.trim();
      const maxVal  = row.querySelector('.slv-con-max').value.trim();
      if (!varName) return;
      con[varName] = {};
      if (minVal !== '') con[varName].min = parseInt(minVal);
      if (maxVal !== '') con[varName].max = parseInt(maxVal);
    });
    return con;
  }

  /* ── solve ───────────────────────────────────────── */
  async function solve() {
    const equation = $.eqInput.value.trim();
    if (!equation) { setStatus('warn', '⚠ Enter an equation first.'); return; }

    setStatus('loading', '⟳ Solving…');
    $.solveBtn.disabled = true;
    $.resultsWrap.hidden = true;

    const conObj = buildConstraints();

    try {
      const resp = await fetch('/solve/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation, constraints: conObj }),
      });
      const data = await resp.json();

      if (!data.ok) {
        setStatus('error', '✕ ' + (data.message || 'Solver error.'));
        return;
      }

      const results = data.data;

      // String result = no solutions / error message from engine
      if (typeof results === 'string') {
        setStatus('warn', '⚠ ' + results);
        return;
      }

      if (!Array.isArray(results) || results.length === 0) {
        setStatus('warn', '⚠ No whole-number solutions exist.');
        return;
      }

      renderResults(results, equation);
      setStatus('success',
        `✓ ${results.length} solution${results.length !== 1 ? 's' : ''} found`);

    } catch (err) {
      setStatus('error', '✕ Request failed: ' + err.message);
    } finally {
      $.solveBtn.disabled = false;
    }
  }

  /* ── render ──────────────────────────────────────── */
  function renderResults(solutions, equation) {
    const vars    = Object.keys(solutions[0]);
    const MAX_SHOW = 200;
    const shown   = solutions.slice(0, MAX_SHOW);

    const thead = $.resultTable.querySelector('thead');
    const tbody = $.resultTable.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Header
    const trh = document.createElement('tr');
    ['#', ...vars].forEach((h, i) => {
      const th      = document.createElement('th');
      th.textContent = h;
      th.style.cssText = [
        'padding:8px 14px',
        'background:#F9FAFB',
        'font-size:11px',
        'text-transform:uppercase',
        'letter-spacing:0.5px',
        'color:#6B7280',
        'border-bottom:1px solid #E5E7EB',
        'white-space:nowrap',
        i === 0 ? 'width:40px;color:#D1D5DB' : 'font-family:monospace;font-weight:700;color:#111827',
      ].join(';');
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    // Rows
    shown.forEach((sol, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = i % 2 === 0 ? '' : 'background:#F9FAFB';
      [i + 1, ...vars.map(v => sol[v])].forEach((val, ci) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.cssText = [
          'padding:7px 14px',
          'border-bottom:1px solid #F3F4F6',
          'font-size:13px',
          ci === 0
            ? 'color:#D1D5DB;font-size:11px'
            : 'font-variant-numeric:tabular-nums;font-weight:600;font-family:monospace',
        ].join(';');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // Meta
    $.resultMeta.textContent = solutions.length > MAX_SHOW
      ? `Showing first ${MAX_SHOW} of ${solutions.length} solutions`
      : `${solutions.length} solution${solutions.length !== 1 ? 's' : ''}`;

    $.resultsWrap.hidden = false;
  }

  /* ── status ──────────────────────────────────────── */
  function setStatus(type, msg) {
    const colors = {
      success: '#16A34A',
      error:   '#DC2626',
      warn:    '#D97706',
      loading: '#1B64F2',
      '':      '#6B7280',
    };
    $.status.textContent = msg;
    $.status.style.color = colors[type] || '#374151';
  }

  return { init };
})();
