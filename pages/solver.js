'use strict';
/* pages/solver.js — Equation Solver with Canvas Chart */

const SolverPage = (() => {
  let $ = null;
  let _lastSolutions = null;

  // Palette for variables
  const COLORS = [
    '#1B64F2','#16A34A','#DC2626','#D97706',
    '#7C3AED','#0891B2','#DB2777','#65A30D',
  ];

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
      tabTable:    document.getElementById('slv-tabTable'),
      tabChart:    document.getElementById('slv-tabChart'),
      viewTable:   document.getElementById('slv-viewTable'),
      viewChart:   document.getElementById('slv-viewChart'),
      canvas:      document.getElementById('slv-canvas'),
      chartTitle:  document.getElementById('slv-chartTitle'),
      chartDesc:   document.getElementById('slv-chartDesc'),
      exampleBtns: document.querySelectorAll('[data-example]'),
    };

    $.solveBtn.addEventListener('click', solve);
    $.addCon.addEventListener('click', () => addConstraintRow());
    $.tabTable.addEventListener('click', () => switchTab('table'));
    $.tabChart.addEventListener('click', () => switchTab('chart'));
    $.exampleBtns.forEach(b =>
      b.addEventListener('click', () => loadExample(b.dataset.example))
    );
    $.eqInput.addEventListener('keydown', e => { if (e.key === 'Enter') solve(); });

    loadExample('simple');
  }

  /* ── tab switching ───────────────────────────────── */
  function switchTab(tab) {
    const isChart = tab === 'chart';
    $.tabTable.classList.toggle('slv-tab--active', !isChart);
    $.tabChart.classList.toggle('slv-tab--active', isChart);
    $.viewTable.hidden = isChart;
    $.viewChart.hidden = !isChart;
    if (isChart && _lastSolutions) renderChart(_lastSolutions);
  }

  /* ── constraint rows ─────────────────────────────── */
  function addConstraintRow(varName = '', minVal = '', maxVal = '') {
    const row = document.createElement('div');
    row.className = 'slv-con-row';
    row.innerHTML = `
      <span style="font-size:11px;color:#6B7280;font-weight:600">var</span>
      <input class="slv-con-var field-input" placeholder="x" maxlength="10" value="${varName}"
        style="width:60px;text-align:center;font-family:monospace;font-weight:700;font-size:14px"/>
      <span style="font-size:12px;color:#9CA3AF">≥</span>
      <input class="slv-con-min field-input" placeholder="0" value="${minVal}" type="number" style="width:80px" title="min"/>
      <span style="font-size:12px;color:#9CA3AF">≤</span>
      <input class="slv-con-max field-input" placeholder="∞" value="${maxVal}" type="number" style="width:80px" title="max"/>
      <button class="slv-con-remove" type="button">✕</button>`;
    row.querySelector('.slv-con-remove').addEventListener('click', () => row.remove());
    $.conList.appendChild(row);
  }

  /* ── examples ────────────────────────────────────── */
  function loadExample(id) {
    $.conList.innerHTML = '';
    $.resultsWrap.hidden = true;
    $.viewChart.hidden = true;
    $.viewTable.hidden = false;
    $.tabTable.classList.add('slv-tab--active');
    $.tabChart.classList.remove('slv-tab--active');
    setStatus('', '');
    _lastSolutions = null;

    ({
      simple:    () => { $.eqInput.value = '50x = 200'; },
      twovars:   () => { $.eqInput.value = '10x + 20y = 100'; },
      fivevars:  () => { $.eqInput.value = '10a + 15b + 20c + 50d + 5e = 1000'; },
      brackets:  () => { $.eqInput.value = '(10x + 20y) * 2 + 5z = 500'; },
      portfolio: () => {
        $.eqInput.value = '2948a + 3812b + 1782c + 1662d = 500000';
        addConstraintRow('a','0','50');
        addConstraintRow('b','0','30');
        addConstraintRow('c','0','80');
        addConstraintRow('d','0','100');
      },
      impossible:() => { $.eqInput.value = '2x + 4y = 3'; },
    }[id] || (() => {}))();
  }

  function buildConstraints() {
    const con = {};
    $.conList.querySelectorAll('.slv-con-row').forEach(row => {
      const v   = row.querySelector('.slv-con-var').value.trim();
      const min = row.querySelector('.slv-con-min').value.trim();
      const max = row.querySelector('.slv-con-max').value.trim();
      if (!v) return;
      con[v] = {};
      if (min !== '') con[v].min = parseInt(min);
      if (max !== '') con[v].max = parseInt(max);
    });
    return con;
  }

  /* ── solve ───────────────────────────────────────── */
  async function solve() {
    const equation = $.eqInput.value.trim();
    if (!equation) { setStatus('warn', '⚠ Enter an equation.'); return; }

    setStatus('loading', '⟳ Solving…');
    $.solveBtn.disabled = true;
    $.resultsWrap.hidden = true;
    _lastSolutions = null;

    try {
      const resp = await fetch('/solve/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation, constraints: buildConstraints() }),
      });
      const data = await resp.json();

      if (!data.ok) { setStatus('error', '✕ ' + (data.message || 'Error')); return; }

      const results = data.data;
      if (typeof results === 'string') { setStatus('warn', '⚠ ' + results); return; }
      if (!Array.isArray(results) || results.length === 0) {
        setStatus('warn', '⚠ No whole-number solutions exist.'); return;
      }

      _lastSolutions = results;
      renderResults(results);
      setStatus('success', `✓ ${results.length} solution${results.length !== 1 ? 's' : ''} found`);

      // Auto-switch to chart for 2-var equations (most visual)
      const vars = Object.keys(results[0]);
      if (vars.length === 2) switchTab('chart');

    } catch (err) {
      setStatus('error', '✕ ' + err.message);
    } finally {
      $.solveBtn.disabled = false;
    }
  }

  /* ── render table ────────────────────────────────── */
  function renderResults(solutions) {
    const vars  = Object.keys(solutions[0]);
    const shown = solutions.slice(0, 200);

    const thead = $.resultTable.querySelector('thead');
    const tbody = $.resultTable.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const trh = document.createElement('tr');
    ['#', ...vars].forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = 'padding:8px 14px;background:#F9FAFB;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;border-bottom:1px solid #E5E7EB;';
      if (i > 0) th.style.fontFamily = 'monospace';
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    shown.forEach((sol, i) => {
      const tr = document.createElement('tr');
      if (i % 2 === 1) tr.style.background = '#F9FAFB';
      [i + 1, ...vars.map(v => sol[v])].forEach((val, ci) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.cssText = 'padding:7px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;';
        if (ci === 0) td.style.color = '#D1D5DB';
        else { td.style.fontFamily = 'monospace'; td.style.fontWeight = '600'; }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    $.resultMeta.textContent = solutions.length > 200
      ? `Showing first 200 of ${solutions.length}` : `${solutions.length} solution${solutions.length !== 1 ? 's' : ''}`;

    $.resultsWrap.hidden = false;
  }

  /* ══════════════════════════════════════════════════
   *  CHART ENGINE — pure Canvas, no external library
   * ══════════════════════════════════════════════════ */
  function renderChart(solutions) {
    if (!solutions || !solutions.length) return;
    const vars = Object.keys(solutions[0]);
    const cvs  = $.canvas;
    const W    = cvs.offsetWidth || 640;
    const H    = vars.length === 2 ? Math.min(W * 0.65, 400) : 280;

    cvs.width  = W * window.devicePixelRatio;
    cvs.height = H * window.devicePixelRatio;
    cvs.style.height = H + 'px';

    const ctx = cvs.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    if (vars.length === 1) renderSingleVar(ctx, solutions, vars[0], W, H);
    else if (vars.length === 2) renderScatter(ctx, solutions, vars, W, H);
    else renderDistribution(ctx, solutions, vars, W, H);
  }

  /* ── 1 variable: number line with dot ───────────── */
  function renderSingleVar(ctx, solutions, varName, W, H) {
    $.chartTitle.textContent = `Single Solution`;
    $.chartDesc.textContent  = `${varName} = ${solutions[0][varName]}`;

    const val  = solutions[0][varName];
    const cx   = W / 2, cy = H / 2;
    const r    = 24;

    ctx.fillStyle = '#EFF6FF';
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1B64F2';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, cx, cy);

    ctx.fillStyle = '#6B7280';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillText(varName, cx, cy + r + 20);
  }

  /* ── 2 variables: scatter plot ───────────────────── */
  function renderScatter(ctx, solutions, vars, W, H) {
    const [xVar, yVar] = vars;
    const xVals = solutions.map(s => s[xVar]);
    const yVals = solutions.map(s => s[yVar]);

    $.chartTitle.textContent = `${xVar} vs ${yVar} — Solution Space`;
    $.chartDesc.textContent  = `Each dot is one integer solution`;

    const PAD = { t: 20, r: 20, b: 48, l: 52 };
    const cW = W - PAD.l - PAD.r;
    const cH = H - PAD.t - PAD.b;

    const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    function toCanvas(x, y) {
      return {
        cx: PAD.l + ((x - xMin) / xRange) * cW,
        cy: PAD.t + (1 - (y - yMin) / yRange) * cH,
      };
    }

    // Grid
    ctx.strokeStyle = '#F3F4F6'; ctx.lineWidth = 1;
    const xTicks = niceTicks(xMin, xMax, 5);
    const yTicks = niceTicks(yMin, yMax, 5);

    xTicks.forEach(v => {
      const { cx } = toCanvas(v, yMin);
      ctx.beginPath(); ctx.moveTo(cx, PAD.t); ctx.lineTo(cx, PAD.t + cH); ctx.stroke();
      ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(v, cx, PAD.t + cH + 6);
    });

    yTicks.forEach(v => {
      const { cy } = toCanvas(xMin, v);
      ctx.beginPath(); ctx.moveTo(PAD.l, cy); ctx.lineTo(PAD.l + cW, cy); ctx.stroke();
      ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(v, PAD.l - 6, cy);
    });

    // Axes
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + cH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t + cH); ctx.lineTo(PAD.l + cW, PAD.t + cH); ctx.stroke();

    // Equation line (continuous)
    // Sort solutions by x and draw a faint line
    const sorted = [...solutions].sort((a, b) => a[xVar] - b[xVar]);
    ctx.strokeStyle = 'rgba(27,100,242,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    sorted.forEach((s, i) => {
      const { cx, cy } = toCanvas(s[xVar], s[yVar]);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Dots
    solutions.forEach(s => {
      const { cx, cy } = toCanvas(s[xVar], s[yVar]);
      ctx.fillStyle = '#1B64F2';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    });

    // Axis labels
    ctx.fillStyle = '#374151'; ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(xVar, PAD.l + cW / 2, H);
    ctx.save(); ctx.translate(14, PAD.t + cH / 2);
    ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(yVar, 0, 0); ctx.restore();
  }

  /* ── 3+ variables: distribution bars ────────────── */
  function renderDistribution(ctx, solutions, vars, W, H) {
    $.chartTitle.textContent = `Variable Distribution across ${solutions.length} Solutions`;
    $.chartDesc.textContent  = `Min / Median / Max range for each variable`;

    const PAD = { t: 20, r: 20, b: 40, l: 80 };
    const cW  = W - PAD.l - PAD.r;
    const cH  = H - PAD.t - PAD.b;
    const rowH = cH / vars.length;
    const BAR_H = Math.min(rowH * 0.5, 18);

    // Compute stats per variable
    const stats = vars.map((v, i) => {
      const vals = solutions.map(s => s[v]).sort((a, b) => a - b);
      const min  = vals[0], max = vals[vals.length - 1];
      const med  = vals[Math.floor(vals.length / 2)];
      return { v, min, max, med, color: COLORS[i % COLORS.length] };
    });

    const globalMin = Math.min(...stats.map(s => s.min));
    const globalMax = Math.max(...stats.map(s => s.max));
    const range     = globalMax - globalMin || 1;

    function toX(val) {
      return PAD.l + ((val - globalMin) / range) * cW;
    }

    // Grid lines
    const ticks = niceTicks(globalMin, globalMax, 5);
    ctx.strokeStyle = '#F3F4F6'; ctx.lineWidth = 1;
    ticks.forEach(v => {
      const x = toX(v);
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + cH); ctx.stroke();
      ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(v, x, PAD.t + cH + 4);
    });

    stats.forEach((s, i) => {
      const cy   = PAD.t + i * rowH + rowH / 2;
      const xMin = toX(s.min), xMax = toX(s.max), xMed = toX(s.med);

      // Variable label
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(s.v, PAD.l - 8, cy);

      // Track line
      ctx.strokeStyle = s.color + '33'; ctx.lineWidth = BAR_H;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xMin, cy); ctx.lineTo(xMax, cy); ctx.stroke();

      // Bar fill min→max
      const grad = ctx.createLinearGradient(xMin, 0, xMax, 0);
      grad.addColorStop(0, s.color + 'AA');
      grad.addColorStop(1, s.color);
      ctx.fillStyle = grad;
      const bh = BAR_H * 0.7;
      const rr = 4;
      roundRect(ctx, xMin, cy - bh/2, Math.max(xMax - xMin, 4), bh, rr);
      ctx.fill();

      // Median dot
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(xMed, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(xMed, cy, 3.5, 0, Math.PI * 2); ctx.fill();

      // Value labels
      ctx.fillStyle = s.color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(s.min, xMin + 2, cy - bh/2 - 5);
      ctx.textAlign = 'right';
      ctx.fillText(s.max, xMax - 2, cy - bh/2 - 5);
    });
  }

  /* ── helpers ─────────────────────────────────────── */
  function niceTicks(min, max, count) {
    const range = max - min;
    const step  = Math.ceil(range / count) || 1;
    const ticks = [];
    const start = Math.floor(min / step) * step;
    for (let v = start; v <= max + step; v += step) {
      if (v >= min && v <= max) ticks.push(v);
    }
    return ticks.length ? ticks : [min, max];
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ── status ──────────────────────────────────────── */
  function setStatus(type, msg) {
    $.status.textContent = msg;
    $.status.style.color = { success:'#16A34A', error:'#DC2626', warn:'#D97706', loading:'#1B64F2', '':'#6B7280' }[type] || '#374151';
  }

  return { init };
})();
