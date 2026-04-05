'use strict';
/* pages/solver.js — Manual Algebraic Equation Solver */

const SolverPage = (() => {
  let $ = null;
  let constraints = []; // { varName, max, min }

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
    $.addCon.addEventListener('click', addConstraintRow);
    $.exampleBtns.forEach(btn =>
      btn.addEventListener('click', () => loadExample(btn.dataset.example))
    );
    $.eqInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) solve();
    });
  }

  /* ── constraint rows ─────────────────────────────────── */
  function addConstraintRow(varName = '', maxVal = '', minVal = '') {
    const row = document.createElement('div');
    row.className = 'slv-con-row';
    row.innerHTML = `
      <input class="slv-con-var field-input" placeholder="var (e.g. a)" maxlength="2" value="${varName}" style="width:64px;text-align:center;font-family:monospace;font-weight:700"/>
      <span style="font-size:12px;color:#6B7280">max</span>
      <input class="slv-con-max field-input" placeholder="∞" value="${maxVal}" type="number" min="0" style="width:90px"/>
      <span style="font-size:12px;color:#6B7280">min</span>
      <input class="slv-con-min field-input" placeholder="0" value="${minVal}" type="number" min="0" style="width:90px"/>
      <button class="slv-con-remove" type="button" title="Remove">✕</button>`;
    row.querySelector('.slv-con-remove').addEventListener('click', () => row.remove());
    $.conList.appendChild(row);
  }

  /* ── examples ────────────────────────────────────────── */
  function loadExample(id) {
    $.conList.innerHTML = '';
    constraints = [];
    if (id === 'simple') {
      $.eqInput.value = '2a + 3b = 12';
      addConstraintRow('a', '5', '0');
      addConstraintRow('b', '4', '0');
    } else if (id === 'portfolio') {
      $.eqInput.value = '19689a + 42155b + 1k = 500000';
      addConstraintRow('a', '25', '0');
      addConstraintRow('b', '11', '0');
      addConstraintRow('k', '5000', '0');
    } else if (id === 'three') {
      $.eqInput.value = '3a + 5b + 7c = 30';
      addConstraintRow('a', '10', '0');
      addConstraintRow('b', '6', '0');
      addConstraintRow('c', '4', '0');
    }
  }

  /* ── build constraints object ────────────────────────── */
  function buildConstraints() {
    const con = {};
    $.conList.querySelectorAll('.slv-con-row').forEach(row => {
      const varName = row.querySelector('.slv-con-var').value.trim();
      const maxVal  = row.querySelector('.slv-con-max').value.trim();
      const minVal  = row.querySelector('.slv-con-min').value.trim();
      if (!varName) return;
      con[varName] = {};
      if (maxVal !== '') con[varName].max = parseInt(maxVal);
      if (minVal !== '') con[varName].min = parseInt(minVal);
    });
    return con;
  }

  /* ── solve ───────────────────────────────────────────── */
  async function solve() {
    const equation = $.eqInput.value.trim();
    if (!equation) { setStatus('warn', 'Enter an equation.'); return; }

    const conObj = buildConstraints();
    setStatus('loading', 'Running solver…');
    $.solveBtn.disabled = true;
    $.resultsWrap.hidden = true;

    try {
      const res  = await fetch('/solve/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation, constraints: conObj }),
      });
      const data = await res.json();

      if (!data.ok) {
        setStatus('error', data.message || 'Solver error.');
        return;
      }
      if (!Array.isArray(data.data) || data.data.length === 0) {
        setStatus('warn', 'No solutions found. Try relaxing constraints or adjusting the equation.');
        return;
      }

      renderResults(data.data, equation);
      setStatus('success', `${data.data.length} solution${data.data.length !== 1 ? 's' : ''} found for: ${equation}`);
    } catch (err) {
      setStatus('error', `Request failed: ${err.message}`);
    } finally {
      $.solveBtn.disabled = false;
    }
  }

  /* ── render ──────────────────────────────────────────── */
  function renderResults(solutions, equation) {
    const vars = Object.keys(solutions[0]);
    const MAX_SHOW = 200;

    // Header
    const thead = $.resultTable.querySelector('thead');
    const tbody = $.resultTable.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML  = '';

    const trh = document.createElement('tr');
    ['#', ...vars].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = 'padding:8px 14px;background:#F9FAFB;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#6B7280;border-bottom:1px solid #E5E7EB;white-space:nowrap';
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    solutions.slice(0, MAX_SHOW).forEach((sol, i) => {
      const tr = document.createElement('tr');
      [i + 1, ...vars.map(v => sol[v])].forEach((val, ci) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.cssText = `padding:7px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;${ci === 0 ? 'color:#9CA3AF;font-size:11px' : 'font-variant-numeric:tabular-nums;font-weight:600'}`;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    $.resultMeta.textContent = solutions.length > MAX_SHOW
      ? `Showing ${MAX_SHOW} of ${solutions.length} solutions`
      : `${solutions.length} solution${solutions.length !== 1 ? 's' : ''}`;

    $.resultsWrap.hidden = false;
  }

  /* ── status ──────────────────────────────────────────── */
  function setStatus(type, msg) {
    const colors = { success: '#16A34A', error: '#DC2626', warn: '#D97706', loading: '#1B64F2' };
    $.status.textContent = msg;
    $.status.style.color = colors[type] || '#374151';
  }

  return { init };
})();
