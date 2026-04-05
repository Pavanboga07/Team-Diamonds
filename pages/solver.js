'use strict';
/* pages/solver.js — Universal Equation Solver UI */

const SolverPage = (() => {
  let $   = null;
  let _lastSolutions = null;
  let _currentMode   = 'general'; // 'general' | 'financial' | 'complex'

  const COLORS = [
    '#1B64F2','#16A34A','#DC2626','#D97706',
    '#7C3AED','#0891B2','#DB2777','#65A30D',
  ];

  // ── init ───────────────────────────────────────────────────────────────────
  function init() {
    $ = {
      eqInput:        document.getElementById('slv-equation'),
      solveBtn:       document.getElementById('slv-solveBtn'),
      status:         document.getElementById('slv-status'),
      hint:           document.getElementById('slv-hint'),
      singleWrap:     document.getElementById('slv-single-wrap'),
      systemWrap:     document.getElementById('slv-system-wrap'),
      constraintsWrap:document.getElementById('slv-constraints-wrap'),
      eqList:         document.getElementById('slv-eqList'),
      addEq:          document.getElementById('slv-addEq'),
      addCon:         document.getElementById('slv-addConstraint'),
      conList:        document.getElementById('slv-constraintList'),
      results:        document.getElementById('slv-results'),
      typeBadge:      document.getElementById('slv-type-badge'),
      meta:           document.getElementById('slv-meta'),
      pills:          document.getElementById('slv-pills'),
      pillsInner:     document.getElementById('slv-pills-inner'),
      tableChartWrap: document.getElementById('slv-table-chart-wrap'),
      tabTable:       document.getElementById('slv-tabTable'),
      tabChart:       document.getElementById('slv-tabChart'),
      viewTable:      document.getElementById('slv-viewTable'),
      viewChart:      document.getElementById('slv-viewChart'),
      table:          document.getElementById('slv-table'),
      tableMeta:      document.getElementById('slv-table-meta'),
      canvas:         document.getElementById('slv-canvas'),
      chartTitle:     document.getElementById('slv-chartTitle'),
      chartDesc:      document.getElementById('slv-chartDesc'),
      modeBtns:       document.querySelectorAll('.slv-mode-btn'),
      exampleBtns:    document.querySelectorAll('[data-example]'),
    };

    $.solveBtn.addEventListener('click', solve);
    $.addEq.addEventListener('click', () => addEqRow());
    $.addCon.addEventListener('click', () => addConstraintRow());
    $.tabTable.addEventListener('click', () => switchTab('table'));
    $.tabChart.addEventListener('click', () => switchTab('chart'));
    $.eqInput.addEventListener('keydown', e => { if (e.key === 'Enter') solve(); });

    $.modeBtns.forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    $.exampleBtns.forEach(b => b.addEventListener('click', () => loadExample(b.dataset.example)));

    loadExample('linear');
  }

  // ── mode switching ─────────────────────────────────────────────────────────
  function switchMode(mode) {
    _currentMode = mode;
    $.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    const isSystem    = mode === 'system';
    const isFinancial = mode === 'financial';
    const isComplex   = mode === 'complex';

    $.singleWrap.hidden      = isSystem;
    $.systemWrap.hidden      = !isSystem;
    $.constraintsWrap.hidden = !isFinancial && !isComplex;

    // Update hint text
    const hints = {
      general:   'e.g. x^2 - 5x + 6 = 0',
      financial: 'e.g. 10x + 20y = 100  (non-negative integers)',
      complex:   'e.g. ((x^2 + y^3) * 5)^2 + 250z = 625  (nested · multi-var · integer)',
    };
    if ($.hint) $.hint.textContent = hints[mode] || '';

    resetResults();
  }

  // ── system equation rows ───────────────────────────────────────────────────
  function addEqRow(val = '') {
    const row = document.createElement('div');
    row.className = 'slv-sys-row';
    row.innerHTML = `
      <input type="text" class="field-input slv-sys-eq" value="${escHtml(val)}"
        placeholder="e.g. x + y = 10"
        style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px"
        spellcheck="false" autocomplete="off"/>
      <button class="slv-sys-remove" type="button" title="Remove">✕</button>`;
    row.querySelector('.slv-sys-remove').addEventListener('click', () => {
      row.remove();
    });
    row.querySelector('.slv-sys-eq').addEventListener('keydown', e => {
      if (e.key === 'Enter') solve();
    });
    $.eqList.appendChild(row);
    row.querySelector('.slv-sys-eq').focus();
  }

  // ── constraint rows ────────────────────────────────────────────────────────
  function addConstraintRow(varName = '', minVal = '', maxVal = '') {
    const row = document.createElement('div');
    row.className = 'slv-con-row';
    row.innerHTML = `
      <span style="font-size:11px;color:#6B7280;font-weight:600">var</span>
      <input class="slv-con-var field-input" placeholder="x" maxlength="10" value="${escHtml(varName)}"
        style="width:60px;text-align:center;font-family:monospace;font-weight:700;font-size:14px"/>
      <span style="font-size:12px;color:#9CA3AF">≥</span>
      <input class="slv-con-min field-input" placeholder="0" value="${escHtml(minVal)}" type="number" style="width:80px" title="min"/>
      <span style="font-size:12px;color:#9CA3AF">≤</span>
      <input class="slv-con-max field-input" placeholder="∞" value="${escHtml(maxVal)}" type="number" style="width:80px" title="max"/>
      <button class="slv-con-remove" type="button">✕</button>`;
    row.querySelector('.slv-con-remove').addEventListener('click', () => row.remove());
    $.conList.appendChild(row);
  }

  // ── examples ───────────────────────────────────────────────────────────────
  function loadExample(id) {
    resetResults();
    $.conList.innerHTML  = '';
    $.eqList.innerHTML   = '';
    setStatus('', '');

    const examples = {
      linear:    () => { switchMode('general');   $.eqInput.value = '50x = 200'; },
      twovars:   () => { switchMode('general');   $.eqInput.value = '10x + 20y = 100'; },
      quadratic: () => { switchMode('general');   $.eqInput.value = 'x^2 - 5x + 6 = 0'; },
      cubic:     () => { switchMode('general');   $.eqInput.value = 'x^3 - 6x^2 + 11x - 6 = 0'; },
      nonlinear:  () => {
        switchMode('financial');
        $.eqInput.value = '150x + 200y + 50z + (x^2 + y^2) / 2 = 10000';
        addConstraintRow('x', '0', '60');
        addConstraintRow('y', '0', '50');
        addConstraintRow('z', '0', '200');
      },
      brackets:  () => { switchMode('general');   $.eqInput.value = '(10x + 20y) * 2 + 5z = 500'; },
      complex:   () => {
        switchMode('complex');
        $.eqInput.value = '((x^2 + y^3) * 5)^2 + 250z = 625';
        addConstraintRow('x', '0', '10');
        addConstraintRow('y', '0', '10');
        addConstraintRow('z', '0', '20');
      },
      portfolio: () => {
        switchMode('financial');
        $.eqInput.value = '2948a + 3812b + 1782c + 1662d = 500000';
        addConstraintRow('a', '0', '50');
        addConstraintRow('b', '0', '30');
        addConstraintRow('c', '0', '80');
        addConstraintRow('d', '0', '100');
      },
      impossible:() => { switchMode('general');   $.eqInput.value = '2x + 4y = 3'; },
    };

    (examples[id] || examples.linear)();
  }

  function buildConstraints() {
    const con = {};
    $.conList.querySelectorAll('.slv-con-row').forEach(row => {
      const v   = row.querySelector('.slv-con-var').value.trim();
      const min = row.querySelector('.slv-con-min').value.trim();
      const max = row.querySelector('.slv-con-max').value.trim();
      if (!v) return;
      con[v] = {};
      if (min !== '') con[v].min = parseInt(min, 10);
      if (max !== '') con[v].max = parseInt(max, 10);
    });
    return con;
  }

  // ── solve ──────────────────────────────────────────────────────────────────
  async function solve() {
    const isSystem = _currentMode === 'system';
    let bodyPayload;

    if (isSystem) {
      const equations = [...$.eqList.querySelectorAll('.slv-sys-eq')]
        .map(i => i.value.trim())
        .filter(Boolean);
      if (equations.length === 0) { setStatus('warn', '⚠ Add at least one equation.'); return; }
      bodyPayload = { equations, constraints: {}, mode: 'general' };
    } else {
      const equation = $.eqInput.value.trim();
      if (!equation) { setStatus('warn', '⚠ Enter an equation.'); return; }
      // Map modes to API mode strings
      const modeMap = { general: 'general', financial: 'financial', complex: 'complex' };
      const mode = modeMap[_currentMode] || 'general';
      bodyPayload = { equation, constraints: buildConstraints(), mode };
    }

    setStatus('loading', '⟳ Solving…');
    $.solveBtn.disabled = true;
    resetResults();

    try {
      const resp = await fetch('/solve/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await resp.json();

      if (!data.ok) {
        // Special string messages: infinite / no solution
        const msg = data.message || 'No valid solution exists';
        if (/infinite/i.test(msg)) {
          setStatus('warn', '∞  ' + msg);
        } else {
          setStatus('error', '✕ ' + msg);
        }
        return;
      }

      const results = data.data;
      if (!Array.isArray(results) || results.length === 0) {
        setStatus('warn', '⚠ No solutions exist.'); return;
      }

      _lastSolutions = results;
      renderResults(results, data.meta);
      const typeLabel = detectType(results, isSystem);
      setStatus('success', `✓ ${results.length} solution${results.length !== 1 ? 's' : ''} found`);

    } catch (err) {
      setStatus('error', '✕ ' + err.message);
    } finally {
      $.solveBtn.disabled = false;
    }
  }

  // ── detect equation type for badge ────────────────────────────────────────
  function detectType(results, isSystem) {
    if (isSystem) return 'system';
    if (_currentMode === 'financial') {
      // Check if equation contains ^ (non-linear financial)
      const eqStr = $.eqInput?.value || '';
      if (/\^/.test(eqStr)) return 'nonlinear';
      return 'financial';
    }
    const vars = Object.keys(results[0] || {});
    if (vars.length === 1) {
      if (results.length === 1) return 'linear';
      if (results.length === 2) return 'quadratic';
      return 'polynomial';
    }
    return 'linear';
  }

  // ── render ─────────────────────────────────────────────────────────────────
  function renderResults(solutions, meta) {
    const vars = Object.keys(solutions[0] || {});
    const isSystem = _currentMode === 'system';
    const typeStr  = detectType(solutions, isSystem);
    const modeLabel = _currentMode === 'financial' ? 'financial' : typeStr;

    // Badge
    const badgeLabels = {
      linear:     '📐 Linear',
      quadratic:  '📈 Quadratic',
      polynomial: '🔢 Polynomial',
      nonlinear:  '🔀 Non-linear',
      system:     'Σ System',
      financial:  '💰 Financial',
    };
    $.typeBadge.textContent = badgeLabels[modeLabel] || '📐 Equation';
    $.typeBadge.className   = `result-badge ${modeLabel}`;

    // Meta
    $.meta.textContent = meta?.count != null
      ? `${meta.count} solution${meta.count !== 1 ? 's' : ''}`
      : `${solutions.length} solution${solutions.length !== 1 ? 's' : ''}`;

    const PILL_THRESHOLD = 20;

    if (solutions.length <= PILL_THRESHOLD || vars.length === 1) {
      // Show as pills (nice for quadratic results like x=2, x=3)
      $.pillsInner.innerHTML = '';
      solutions.forEach(sol => {
        const text = vars.map(v => `${v} = ${formatVal(sol[v])}`).join(', ');
        const pill = document.createElement('span');
        pill.className = 'sol-pill';
        pill.textContent = text;
        $.pillsInner.appendChild(pill);
      });
      $.pills.hidden = false;
    }

    if (solutions.length > PILL_THRESHOLD || vars.length > 1) {
      // Show table + chart
      renderTable(solutions, vars);
      $.tableChartWrap.hidden = false;

      // Auto-switch to chart for 2-var
      if (vars.length === 2) switchTab('chart');
    }

    $.results.hidden = false;
  }

  function formatVal(x) {
    if (x == null) return '—';
    if (Number.isInteger(x)) return String(x);
    return Number(x.toPrecision(6)).toString();
  }

  function renderTable(solutions, vars) {
    const shown  = solutions.slice(0, 200);
    const thead  = $.table.querySelector('thead');
    const tbody  = $.table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Header row
    const trh = document.createElement('tr');
    ['#', ...vars].forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h;
      if (i > 0) th.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    // Data rows
    shown.forEach((sol, i) => {
      const tr = document.createElement('tr');
      [i + 1, ...vars.map(v => sol[v])].forEach((val, ci) => {
        const td = document.createElement('td');
        td.textContent = ci === 0 ? val : formatVal(val);
        if (ci === 0) {
          // row number
        } else {
          td.className = 'val-cell';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    $.tableMeta.textContent = solutions.length > 200
      ? `Showing first 200 of ${solutions.length}`
      : `${solutions.length} solution${solutions.length !== 1 ? 's' : ''}`;
  }

  // ── tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab) {
    const isChart = tab === 'chart';
    $.tabTable.classList.toggle('slv-tab--active', !isChart);
    $.tabChart.classList.toggle('slv-tab--active', isChart);
    $.viewTable.hidden = isChart;
    $.viewChart.hidden = !isChart;
    if (isChart && _lastSolutions) renderChart(_lastSolutions);
  }

  // ── reset ──────────────────────────────────────────────────────────────────
  function resetResults() {
    _lastSolutions = null;
    $.results.hidden        = true;
    $.pills.hidden          = true;
    $.tableChartWrap.hidden = true;
    $.viewChart.hidden      = true;
    $.viewTable.hidden      = false;
    $.tabTable.classList.add('slv-tab--active');
    $.tabChart.classList.remove('slv-tab--active');
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

  function renderSingleVar(ctx, solutions, varName, W, H) {
    $.chartTitle.textContent = solutions.length === 1
      ? `Single Solution` : `${solutions.length} Solutions`;
    $.chartDesc.textContent  = solutions.map(s => `${varName} = ${formatVal(s[varName])}`).join(',  ');

    const vals = solutions.map(s => s[varName]);
    const radius = vals.length === 1 ? 24 : Math.max(18, Math.min(32, W / (vals.length * 4)));
    const spacing = Math.min((W - 80) / Math.max(vals.length, 1), 100);
    const startX = W / 2 - (vals.length - 1) * spacing / 2;

    vals.forEach((val, i) => {
      const cx = startX + i * spacing;
      const cy = H / 2;
      ctx.fillStyle = '#EFF6FF';
      ctx.beginPath(); ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(18, radius)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(formatVal(val), cx, cy);
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(varName, cx, cy + radius + 16);
    });
  }

  function renderScatter(ctx, solutions, vars, W, H) {
    const [xVar, yVar] = vars;
    const xVals = solutions.map(s => s[xVar]);
    const yVals = solutions.map(s => s[yVar]);

    $.chartTitle.textContent = `${xVar} vs ${yVar} — Solution Space`;
    $.chartDesc.textContent  = `Each dot is one solution`;

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

    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + cH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t + cH); ctx.lineTo(PAD.l + cW, PAD.t + cH); ctx.stroke();

    // Line
    const sorted = [...solutions].sort((a, b) => a[xVar] - b[xVar]);
    ctx.strokeStyle = 'rgba(27,100,242,0.15)'; ctx.lineWidth = 2;
    ctx.beginPath();
    sorted.forEach((s, i) => {
      const { cx, cy } = toCanvas(s[xVar], s[yVar]);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    solutions.forEach(s => {
      const { cx, cy } = toCanvas(s[xVar], s[yVar]);
      ctx.fillStyle = '#1B64F2';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#374151'; ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(xVar, PAD.l + cW / 2, H);
    ctx.save(); ctx.translate(14, PAD.t + cH / 2);
    ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(yVar, 0, 0); ctx.restore();
  }

  function renderDistribution(ctx, solutions, vars, W, H) {
    $.chartTitle.textContent = `Variable Distribution across ${solutions.length} Solutions`;
    $.chartDesc.textContent  = `Min / Median / Max range for each variable`;

    const PAD = { t: 20, r: 20, b: 40, l: 80 };
    const cW  = W - PAD.l - PAD.r;
    const cH  = H - PAD.t - PAD.b;
    const rowH = cH / vars.length;
    const BAR_H = Math.min(rowH * 0.5, 18);

    const stats = vars.map((v, i) => {
      const vals = solutions.map(s => s[v]).sort((a, b) => a - b);
      const min  = vals[0], max = vals[vals.length - 1];
      const med  = vals[Math.floor(vals.length / 2)];
      return { v, min, max, med, color: COLORS[i % COLORS.length] };
    });

    const globalMin = Math.min(...stats.map(s => s.min));
    const globalMax = Math.max(...stats.map(s => s.max));
    const range     = globalMax - globalMin || 1;

    function toX(val) { return PAD.l + ((val - globalMin) / range) * cW; }

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

      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(s.v, PAD.l - 8, cy);

      ctx.strokeStyle = s.color + '33'; ctx.lineWidth = BAR_H;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xMin, cy); ctx.lineTo(xMax, cy); ctx.stroke();

      const grad = ctx.createLinearGradient(xMin, 0, xMax, 0);
      grad.addColorStop(0, s.color + 'AA');
      grad.addColorStop(1, s.color);
      ctx.fillStyle = grad;
      const bh = BAR_H * 0.7;
      roundRect(ctx, xMin, cy - bh / 2, Math.max(xMax - xMin, 4), bh, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(xMed, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(xMed, cy, 3.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = s.color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(formatVal(s.min), xMin + 2, cy - bh / 2 - 5);
      ctx.textAlign = 'right';
      ctx.fillText(formatVal(s.max), xMax - 2, cy - bh / 2 - 5);
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────
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

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setStatus(type, msg) {
    $.status.textContent = msg;
    $.status.style.color = {
      success:'#16A34A', error:'#DC2626', warn:'#D97706', loading:'#1B64F2', '':'#6B7280'
    }[type] || '#374151';
  }

  return { init };
})();
