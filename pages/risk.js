'use strict';
/* pages/risk.js — Professional Risk Analysis with real 1-year market data */

const RiskPage = (() => {

  /* ── State ──────────────────────────────────────────────────────────────── */
  const sel     = new Set();
  let _budget   = 50000;
  let _analyzed = [];
  let _prices   = {};        // current prices
  let _histPrices = {};      // { RELIANCE: [p,...], NIFTY: [p,...] } aligned
  let _histDates  = [];      // [timestamp_ms, ...]
  let _stockStats = {};      // per-stock: { beta, alpha, vol, mdd, var95, sortino }
  let _corrMatrix = {};      // { RELIANCE: { TCS: 0.62, ... }, ... }
  let _dotPos     = [];      // scatter hover
  let _sortKey    = 'risk';
  let _sortAsc    = true;

  const STOCKS = [
    {sym:'RELIANCE',   name:'Reliance',     sector:'Energy' },
    {sym:'TCS',        name:'TCS',          sector:'IT'     },
    {sym:'INFY',       name:'Infosys',      sector:'IT'     },
    {sym:'HDFCBANK',   name:'HDFC Bank',    sector:'Banking'},
    {sym:'ICICIBANK',  name:'ICICI Bank',   sector:'Banking'},
    {sym:'SBIN',       name:'SBI',          sector:'Banking'},
    {sym:'WIPRO',      name:'Wipro',        sector:'IT'     },
    {sym:'HCLTECH',    name:'HCL Tech',     sector:'IT'     },
    {sym:'AXISBANK',   name:'Axis Bank',    sector:'Banking'},
    {sym:'KOTAKBANK',  name:'Kotak Bank',   sector:'Banking'},
    {sym:'BAJFINANCE', name:'Bajaj Finance',sector:'Finance'},
    {sym:'MARUTI',     name:'Maruti',       sector:'Auto'   },
    {sym:'TATAMOTORS', name:'Tata Motors',  sector:'Auto'   },
    {sym:'ITC',        name:'ITC',          sector:'FMCG'   },
    {sym:'HINDUNILVR', name:'HUL',          sector:'FMCG'   },
    {sym:'SUNPHARMA',  name:'Sun Pharma',   sector:'Pharma' },
    {sym:'DRREDDY',    name:'Dr. Reddy\'s', sector:'Pharma' },
    {sym:'NTPC',       name:'NTPC',         sector:'Energy' },
    {sym:'ONGC',       name:'ONGC',         sector:'Energy' },
    {sym:'TECHM',      name:'Tech Mahindra',sector:'IT'     },
  ];

  const SEC_COLORS = {Energy:'#F59E0B',IT:'#3B82F6',Banking:'#8B5CF6',Finance:'#EC4899',Auto:'#10B981',FMCG:'#F97316',Pharma:'#06B6D4',Other:'#64748B'};

  /* ── Risk meta (sector info for weight-based sector breakdown) ────────── */
  const SECTOR_MAP = {};
  STOCKS.forEach(s => { SECTOR_MAP[s.sym] = s.sector; });

  /* ── DOM refs ────────────────────────────────────────────────────────────── */
  let $;
  function init() {
    $ = {
      chips:      document.getElementById('rsk-chips'),
      selcount:   document.getElementById('rsk-selcount'),
      clearBtn:   document.getElementById('rsk-clearBtn'),
      slider:     document.getElementById('rsk-slider'),
      input:      document.getElementById('rsk-input'),
      bamt:       document.getElementById('rsk-bamt'),
      goBtn:      document.getElementById('rsk-goBtn'),
      status:     document.getElementById('rsk-status'),
      results:    document.getElementById('rsk-results'),
      empty:      document.getElementById('rsk-empty'),
      source:     document.getElementById('rsk-source'),
      // KPIs
      kCombos:    document.getElementById('k-combos'),
      kRet:       document.getElementById('k-ret'),
      kSortino:   document.getElementById('k-sortino'),
      kVar:       document.getElementById('k-var'),
      // Summary
      badge:      document.getElementById('rsk-badge'),
      gFill:      document.getElementById('g-fill'),
      gScore:     document.getElementById('g-score'),
      gLabel:     document.getElementById('g-label'),
      mBeta:      document.getElementById('m-beta'),
      mVol:       document.getElementById('m-vol'),
      mRet:       document.getElementById('m-ret'),
      mMdd:       document.getElementById('m-mdd'),
      mVar:       document.getElementById('m-var'),
      mSortino:   document.getElementById('m-sortino'),
      secs:       document.getElementById('rsk-secs'),
      alerts:     document.getElementById('rsk-alerts'),
      // Charts
      scatter:    document.getElementById('rsk-scatter'),
      tt:         document.getElementById('rsk-tt'),
      perf:       document.getElementById('rsk-perf'),
      corr:       document.getElementById('rsk-corr'),
      // Tables
      stockBody:  document.getElementById('rsk-stock-body'),
      tmeta:      document.getElementById('rsk-tmeta'),
      abody:      document.getElementById('rsk-abody'),
    };

    buildChips();
    syncBudget(50000);
    $.slider.addEventListener('input',  () => syncBudget(+$.slider.value));
    $.input.addEventListener('change',  () => syncBudget(+$.input.value || 50000));
    $.goBtn.addEventListener('click',   runAnalysis);
    $.clearBtn.addEventListener('click', () => { sel.clear(); updateChips(); });
    $.scatter.addEventListener('mousemove',  onScatterHover);
    $.scatter.addEventListener('mouseleave', () => { $.tt.style.display='none'; });
    document.querySelectorAll('.rsk-tbl th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        _sortKey = k; _sortAsc = _sortKey !== k ? true : !_sortAsc;
        document.querySelectorAll('#rsk-alloc-tbl th[data-sort]').forEach(t => {
          t.className = t.dataset.sort === k ? 'sorted' : '';
          t.textContent = t.textContent.replace(/[▲▼↕]/,'') + (t.dataset.sort === k ? (_sortAsc?'▲':'▼') : '↕');
        });
        renderAllocTable();
      });
    });
  }

  function syncBudget(v) {
    _budget = Math.max(1000, Math.min(10_000_000, v));
    $.slider.value = Math.min(_budget, 500000);
    $.input.value  = _budget;
    $.bamt.textContent = '₹' + _budget.toLocaleString('en-IN');
  }

  /* ── Chip grid ───────────────────────────────────────────────────────────── */
  function buildChips() {
    $.chips.innerHTML = '';
    for (const s of STOCKS) {
      const div = document.createElement('div');
      div.className = 'rsk-chip'; div.dataset.sym = s.sym;
      div.innerHTML = `<div><div>${s.sym}</div><div class="rsk-chip__sec">${s.sector}</div></div><span class="rsk-chip__chk">✓</span>`;
      div.addEventListener('click', () => {
        if (sel.has(s.sym)) sel.delete(s.sym);
        else if (sel.size < 5) sel.add(s.sym);
        else { setStatus('warn','⚠ Max 5 stocks.'); return; }
        updateChips();
      });
      $.chips.appendChild(div);
    }
  }
  function updateChips() {
    $.chips.querySelectorAll('.rsk-chip').forEach(c => c.classList.toggle('sel', sel.has(c.dataset.sym)));
    $.selcount.textContent = `(${sel.size} selected)`;
    $.clearBtn.hidden = sel.size === 0;
    setStatus('','');
  }

  /* ── Status ──────────────────────────────────────────────────────────────── */
  function setStatus(type, msg) {
    const c = {warn:'#D97706',error:'#DC2626',ok:'#16A34A',loading:'#1B64F2'}[type]||'#64748B';
    $.status.style.color = c; $.status.textContent = msg;
  }

  /* ── Main flow ───────────────────────────────────────────────────────────── */
  async function runAnalysis() {
    const syms = [...sel];
    if (syms.length < 2) { setStatus('warn','⚠ Select at least 2 stocks.'); return; }

    $.goBtn.disabled = true;
    $.results.hidden = $.empty.hidden = true;

    try {
      /* Step 1: current prices */
      setStatus('loading','⟳ Step 1/4 — Fetching current prices…');
      const pResp = await fetch(`/market/quotes?symbols=${syms.join(',')}`);
      const pData = await pResp.json();
      if (!pData.ok) throw new Error(pData.message || 'Price fetch failed');
      _prices = {};
      for (const [s, info] of Object.entries(pData.data)) _prices[s] = info.price;

      /* Step 2: 1-year historical data */
      setStatus('loading','⟳ Step 2/4 — Downloading 1-year price history…');
      const hResp = await fetch(`/market/history?symbols=${syms.join(',')}`);
      const hData = await hResp.json();
      if (!hData.ok) throw new Error('Historical data unavailable: ' + (hData.message || ''));
      _histPrices = hData.prices;
      _histDates  = hData.dates;
      $.source.textContent = hData.source === 'live' ? `🟢 Live data (${hData.tradingDays} trading days)` : '🟡 Cached data';

      /* Step 3: compute per-stock stats & correlation */
      setStatus('loading','⟳ Step 3/4 — Computing risk statistics…');
      const nifty = _histPrices['NIFTY'] ?? null;
      _stockStats = {};
      const vols = {};
      for (const sym of syms) {
        const p = _histPrices[sym];
        if (!p || p.length < 20) continue;
        _stockStats[sym] = {
          beta:    nifty ? Stats.beta(p, nifty)         : null,
          alpha:   nifty ? Stats.alpha(p, nifty)        : null,
          vol:     Stats.annualizedVol(p),
          ret:     Stats.annualizedReturn(p),
          mdd:     Stats.maxDrawdown(p),
          var95:   Stats.var95(p),
          sortino: Stats.sortino(p),
          calmar:  Stats.calmar(p),
        };
        vols[sym] = _stockStats[sym].vol ?? 20;
      }
      /* Correlation matrix (exclude NIFTY from matrix) */
      const stockPricesOnly = {};
      for (const sym of syms) { if (_histPrices[sym]) stockPricesOnly[sym] = _histPrices[sym]; }
      _corrMatrix = Stats.correlationMatrix(stockPricesOnly);

      /* Step 4: solve allocations */
      setStatus('loading','⟳ Step 4/4 — Solving all valid allocations…');
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const varMap = {}, symMap = {};
      syms.forEach((sym, i) => { varMap[letters[i]] = sym; symMap[sym] = letters[i]; });
      const terms    = syms.map(sym => `${Math.round(_prices[sym])}${symMap[sym]}`);
      const equation = terms.join(' + ') + ` = ${_budget}`;
      const constraints = {};
      for (const sym of syms) constraints[symMap[sym]] = { min:0, max: Math.min(50, Math.floor(_budget/_prices[sym])) };

      const sResp = await fetch('/solve/v2', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ equation, constraints, mode:'financial'}),
      });
      const sData = await sResp.json();
      if (!sData.ok || !sData.data?.length) {
        setStatus('warn','⚠ No valid allocations found. Try a larger budget.');
        $.empty.hidden = false; return;
      }

      /* Map letter keys → stock symbols */
      const rawAllocs = sData.data.map(raw => {
        const m = {};
        for (const [l, n] of Object.entries(raw)) { const s = varMap[l]; if (s) m[s] = n; }
        return m;
      });

      /* Compute full risk profile for each allocation */
      _analyzed = rawAllocs.map(a => buildPortfolioStats(a, syms, vols)).filter(Boolean);
      _analyzed.sort((a, b) => b.sortino - a.sortino); /* best = highest Sortino */

      /* Render */
      renderKPIs();
      renderSummary(_analyzed[0]);
      drawScatter();
      drawPerfChart(_analyzed[0]);
      drawCorrHeatmap();
      renderStockTable(syms);
      renderAllocTable();
      $.results.hidden = false; $.empty.hidden = true;
      setStatus('ok', `✓ ${_analyzed.length} allocations analysed with real 1-year data`);

    } catch (err) {
      setStatus('error','✕ ' + err.message);
      $.empty.hidden = false;
      console.error('[RiskPage]', err);
    } finally {
      $.goBtn.disabled = false;
    }
  }

  /* ── Portfolio stats builder ────────────────────────────────────────────── */
  function buildPortfolioStats(allocation, syms, vols) {
    const symbols = syms.filter(s => (allocation[s] ?? 0) > 0);
    if (!symbols.length) return null;

    /* Weights */
    const invested = {}, weights = {};
    let total = 0;
    for (const s of symbols) { invested[s] = (allocation[s]??0)*(_prices[s]??0); total += invested[s]; }
    if (total <= 0) return null;
    for (const s of symbols) weights[s] = invested[s] / total;

    /* Portfolio vol using correlation matrix (truest estimate) */
    const portVol = Stats.portfolioVolFromCorr(weights, vols, _corrMatrix);
    /* Portfolio weighted return */
    const portRet = symbols.reduce((r, s) => r + (weights[s]??0)*(_stockStats[s]?.ret??0), 0);
    /* Portfolio beta */
    const portBeta = symbols.reduce((b, s) => b + (weights[s]??0)*(_stockStats[s]?.beta??1), 0);
    /* Portfolio max drawdown (weighted average — simplified) */
    const portMDD  = symbols.reduce((d, s) => d + (weights[s]??0)*(_stockStats[s]?.mdd??15), 0);
    /* Portfolio VaR (weighted) */
    const portVar  = symbols.reduce((v, s) => v + (weights[s]??0)*(_stockStats[s]?.var95??1.5), 0);

    /* Sortino using actual portfolio daily returns */
    let portSortino = null;
    if (_histPrices && Object.keys(_histPrices).length > 0) {
      const portRetSeries = Stats.portfolioReturns(_histPrices, weights);
      if (portRetSeries.length > 20) {
        const annRet = Stats.mean(portRetSeries) * 252;
        const downR  = portRetSeries.filter(r => r < 0);
        if (downR.length) {
          const downDev = Math.sqrt(downR.reduce((s,r)=>s+r*r,0)/portRetSeries.length) * Math.sqrt(252);
          portSortino = downDev > 0 ? +((annRet - 0.065) / downDev).toFixed(2) : null;
        }
      }
    }

    /* Risk score 0–100 (same formula, but now with real vol) */
    const betaNorm = Math.min(100, ((portBeta<0?0:portBeta)/2)*100);
    const volNorm  = Math.min(100, (portVol/40)*100);
    /* Concentration HHI */
    const hhi = Object.values(weights).reduce((s,w)=>s+w*w,0);
    const n   = symbols.length;
    const concN = n>1 ? Math.min(100, ((hhi-1/n)/(1-1/n))*100) : 100;
    const riskScore = Math.round(0.35*betaNorm + 0.40*volNorm + 0.25*concN);
    const riskLevel = riskScore < 35 ? 'low' : riskScore < 65 ? 'medium' : 'high';

    /* Sector weights */
    const sectorW = {};
    for (const s of symbols) { const sec = SECTOR_MAP[s]||'Other'; sectorW[sec] = (sectorW[sec]??0)+weights[s]; }

    /* Sharpe proxy & Calmar */
    const sharpeProxy = portVol > 0 ? +((portRet/100 - 0.065)/(portVol/100)).toFixed(2) : 0;
    const calmar      = portMDD > 0  ? +((portRet/portMDD)).toFixed(2) : 0;

    /* Alerts */
    const alerts = [];
    if (portBeta > 1.3) alerts.push({type:'high',   msg:`High market sensitivity — β=${portBeta.toFixed(2)} amplifies NIFTY moves`});
    if (portVol  > 25)  alerts.push({type:'high',   msg:`Elevated volatility ${portVol.toFixed(1)}%/yr — expect large price swings`});
    if (portMDD  > 30)  alerts.push({type:'high',   msg:`Heavy historical drawdown — portfolio fell ${portMDD.toFixed(1)}% peak-to-trough`});
    if (portVar  > 2)   alerts.push({type:'medium', msg:`VaR 95%: worst daily loss ~${portVar.toFixed(1)}% (value at risk)`});
    if (hhi > 0.5)      alerts.push({type:'medium', msg:`Concentrated — top stock is ${(Math.max(...Object.values(weights))*100).toFixed(0)}% of portfolio`});
    if (n < 3)          alerts.push({type:'medium', msg:'Low diversification — fewer than 3 stocks'});
    const domSec = Object.entries(sectorW).sort((a,b)=>b[1]-a[1])[0];
    if (domSec && domSec[1] > 0.55) alerts.push({type:'medium',msg:`${(domSec[1]*100).toFixed(0)}% in ${domSec[0]} sector — sector concentration risk`});
    if ((portSortino??999) < 0.5 && portSortino !== null) alerts.push({type:'info', msg:`Low Sortino ratio (${portSortino?.toFixed(2)}) — poor return per unit of downside risk`});

    return {
      allocation, symbols, invested, weights, total,
      riskScore, riskLevel,
      portBeta: +portBeta.toFixed(2), portVol, portRet: +portRet.toFixed(1),
      portMDD: +portMDD.toFixed(1), portVar: +portVar.toFixed(2),
      sortino: portSortino, sharpeProxy, calmar,
      sectorW, hhi: +hhi.toFixed(3), alerts,
    };
  }

  /* ── KPI strip ───────────────────────────────────────────────────────────── */
  function renderKPIs() {
    const n       = _analyzed.length;
    const bestRet = Math.max(..._analyzed.map(a => a.portRet));
    const bestSrt = Math.max(..._analyzed.filter(a=>a.sortino!==null).map(a=>a.sortino??-99));
    const bestVar = _analyzed[_analyzed.findIndex(a=>a.sortino===bestSrt)]?.portVar ?? 0;

    $.kCombos.textContent  = n.toLocaleString();
    $.kRet.textContent     = bestRet.toFixed(1) + '%';
    $.kSortino.textContent = isFinite(bestSrt) ? bestSrt.toFixed(2) : '—';
    $.kVar.textContent     = bestVar ? bestVar.toFixed(1)+'%/day' : '—';
  }

  /* ── Risk Summary card ───────────────────────────────────────────────────── */
  function riskColor(l)  { return l==='low'?'#16A34A':l==='medium'?'#D97706':'#DC2626'; }
  function riskBg(l)     { return l==='low'?'#F0FDF4':l==='medium'?'#FFFBEB':'#FEF2F2'; }
  function riskBorder(l) { return l==='low'?'#BBF7D0':l==='medium'?'#FDE68A':'#FECACA'; }
  function riskEmoji(l)  { return l==='low'?'🟢':l==='medium'?'🟡':'🔴'; }
  function riskLabel(l)  { return l==='low'?'Low Risk':l==='medium'?'Medium Risk':'High Risk'; }

  function colorMetric(el, val, goodBelow, badAbove) {
    if (val === null) { el.textContent='—'; el.style.color=''; return; }
    el.style.color = val < goodBelow ? '#16A34A' : val > badAbove ? '#DC2626' : '#0F172A';
  }

  function renderSummary(a) {
    /* Gauge */
    const arcLen = 201, fillLen = (a.riskScore/100)*arcLen;
    $.gFill.setAttribute('stroke-dasharray', `${fillLen} ${arcLen}`);
    $.gFill.setAttribute('stroke', riskColor(a.riskLevel));
    $.gScore.textContent = a.riskScore; $.gScore.style.color = riskColor(a.riskLevel);
    $.gLabel.textContent = riskLabel(a.riskLevel);
    $.gLabel.style.cssText = `background:${riskBg(a.riskLevel)};color:${riskColor(a.riskLevel)};border:1px solid ${riskBorder(a.riskLevel)}`;
    $.badge.textContent  = `${riskEmoji(a.riskLevel)} ${a.riskLevel.charAt(0).toUpperCase()+a.riskLevel.slice(1)}`;
    $.badge.className    = `rbadge rbadge--${a.riskLevel}`;

    /* Metrics */
    $.mBeta.textContent = a.portBeta ?? '—'; colorMetric($.mBeta, a.portBeta, 0.8, 1.25);
    $.mVol.textContent  = a.portVol ? a.portVol.toFixed(1)+'%' : '—'; colorMetric($.mVol, a.portVol, 15, 26);
    $.mRet.textContent  = a.portRet ? a.portRet.toFixed(1)+'%' : '—'; colorMetric($.mRet, a.portRet, -999, 5);
    $.mMdd.textContent  = a.portMDD ? '-'+a.portMDD.toFixed(1)+'%' : '—'; colorMetric($.mMdd, a.portMDD, 15, 30);
    $.mVar.textContent  = a.portVar ? a.portVar.toFixed(2)+'%/d' : '—'; colorMetric($.mVar, a.portVar, 1.2, 2);
    $.mSortino.textContent = a.sortino !== null ? a.sortino.toFixed(2) : '—';
    $.mSortino.style.color = a.sortino > 0.6 ? '#16A34A' : a.sortino < 0.3 ? '#DC2626' : '#0F172A';

    /* Sector bars */
    $.secs.innerHTML = '';
    for (const [sec, w] of Object.entries(a.sectorW).sort((x,y)=>y[1]-x[1])) {
      const pct = Math.round(w*100);
      const div = document.createElement('div'); div.className='rsk-secrow';
      div.innerHTML = `<span class="rsk-secname">${sec}</span><div class="rsk-sectrack"><div class="rsk-secfill" style="width:${pct}%;background:${SEC_COLORS[sec]||'#64748B'}"></div></div><span class="rsk-secpct">${pct}%</span>`;
      $.secs.appendChild(div);
    }

    /* Alerts */
    $.alerts.innerHTML = '';
    if (!a.alerts.length) { $.alerts.innerHTML='<div style="font-size:11px;color:#94A3B8;padding:6px 0">✓ No major risk alerts.</div>'; }
    else for (const al of a.alerts) {
      const d = document.createElement('div'); d.className=`rsk-al rsk-al--${al.type}`;
      d.innerHTML=`<span style="flex-shrink:0">${al.type==='high'?'⚠':al.type==='medium'?'⚡':'ℹ'}</span><span>${al.msg}</span>`;
      $.alerts.appendChild(d);
    }
  }

  /* ── Scatter chart ─────────────────────────────────────────────────────── */
  function drawScatter() {
    const canvas = $.scatter, ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width||600)*dpr; canvas.height = 380*dpr;
    ctx.scale(dpr,dpr);
    const W=canvas.width/dpr, H=canvas.height/dpr;
    const pad={top:36,right:24,bottom:54,left:58};
    const pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;

    const xs = _analyzed.map(a=>a.riskScore);
    const ys = _analyzed.map(a=>a.portRet);
    const xMin=0,xMax=100, yMin=Math.min(...ys)-3, yMax=Math.max(...ys)+4;
    const tx=v=>pad.left+((v-xMin)/(xMax-xMin))*pw;
    const ty=v=>pad.top+((yMax-v)/(yMax-yMin))*ph;

    ctx.clearRect(0,0,W,H);

    /* Quadrant shading */
    const mx=tx(50),my=ty((yMin+yMax)/2);
    [[`rgba(220,252,231,.3)`,pad.left,pad.top,mx-pad.left,my-pad.top],
     [`rgba(254,249,195,.3)`,pad.left,my,mx-pad.left,pad.top+ph-my],
     [`rgba(254,226,226,.3)`,mx,pad.top,pad.left+pw-mx,my-pad.top],
     [`rgba(254,226,226,.5)`,mx,my,pad.left+pw-mx,pad.top+ph-my]
    ].forEach(([c,...r])=>{ctx.fillStyle=c;ctx.fillRect(...r);});

    /* Grid */
    ctx.strokeStyle='#E2E8F0';ctx.lineWidth=0.8;
    for(let x=0;x<=100;x+=25){const cx=tx(x);ctx.beginPath();ctx.moveTo(cx,pad.top);ctx.lineTo(cx,pad.top+ph);ctx.stroke();}

    /* Axes */
    ctx.strokeStyle='#94A3B8';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(pad.left,pad.top);ctx.lineTo(pad.left,pad.top+ph);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad.left,pad.top+ph);ctx.lineTo(pad.left+pw,pad.top+ph);ctx.stroke();

    /* Labels */
    ctx.fillStyle='#64748B';ctx.font='11px Inter,sans-serif';ctx.textAlign='center';
    for(let x=0;x<=100;x+=25) ctx.fillText(x,tx(x),pad.top+ph+17);
    ctx.fillStyle='#94A3B8';ctx.font='10px Inter,sans-serif';
    ctx.fillText('Risk Score →',pad.left+pw/2,pad.top+ph+34);
    ctx.textAlign='right';ctx.fillStyle='#64748B';ctx.font='11px Inter,sans-serif';
    for(let i=0;i<=4;i++){const yv=yMin+i*(yMax-yMin)/4;ctx.fillText(yv.toFixed(0)+'%',pad.left-7,ty(yv)+4);}
    ctx.save();ctx.translate(14,pad.top+ph/2);ctx.rotate(-Math.PI/2);
    ctx.textAlign='center';ctx.fillStyle='#94A3B8';ctx.font='10px Inter,sans-serif';
    ctx.fillText('Actual 1Y Return →',0,0);ctx.restore();

    /* Quadrant labels */
    ctx.font='bold 9px Inter,sans-serif';ctx.fillStyle='rgba(100,116,139,.65)';
    ctx.textAlign='left'; ctx.fillText('🌟 Safe Zone',pad.left+5,pad.top+13);
    ctx.textAlign='right';ctx.fillText('High Return ⚡',pad.left+pw-4,pad.top+13);
    ctx.textAlign='left'; ctx.fillText('Low Risk / Low Return 💤',pad.left+5,pad.top+ph-6);
    ctx.textAlign='right';ctx.fillText('Danger Zone 🚨',pad.left+pw-4,pad.top+ph-6);

    /* Dots */
    _dotPos = [];
    _analyzed.forEach((a,i)=>{
      const cx=tx(a.riskScore),cy=ty(a.portRet),isBest=i===0,r=isBest?8:5;
      const col = riskColor(a.riskLevel);
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle=isBest?'#1B64F2':col+'CC';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=isBest?2:1;ctx.stroke();
      if(isBest){ctx.fillStyle='#1B64F2';ctx.font='bold 9px Inter,sans-serif';ctx.textAlign='center';ctx.fillText('★ Best',cx,cy-r-4);}
      _dotPos.push({cx,cy,r:r+5,data:a});
    });
  }

  function onScatterHover(e) {
    const rect=$.scatter.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const sx=$.scatter.width/rect.width/dpr, sy=$.scatter.height/rect.height/dpr;
    const mx=(e.clientX-rect.left)*sx, my=(e.clientY-rect.top)*sy;
    const hit = _dotPos.find(d=>Math.hypot(d.cx-mx,d.cy-my)<=d.r);
    if(!hit){$.tt.style.display='none';return;}
    const a=hit.data;
    const chips=a.symbols.map(s=>`${s}×${a.allocation[s]}`).join(', ');
    $.tt.innerHTML=`<strong>${chips}</strong><br/>
      ${riskEmoji(a.riskLevel)} Risk: <strong>${a.riskScore}/100</strong><br/>
      Return: <strong>${a.portRet}%</strong> Beta: <strong>${a.portBeta}</strong><br/>
      Vol: <strong>${a.portVol}%</strong> MaxDD: <strong>-${a.portMDD}%</strong><br/>
      VaR 95%: <strong>${a.portVar}%/day</strong> Sortino: <strong>${a.sortino?.toFixed(2)??'—'}</strong>`;
    $.tt.style.display='block';
    const tx=e.clientX-rect.left+14, ty2=e.clientY-rect.top-10;
    $.tt.style.left=Math.min(tx,rect.width-240)+'px';$.tt.style.top=Math.max(ty2,4)+'px';
  }

  /* ── Historical Performance Chart ─────────────────────────────────────── */
  function drawPerfChart(a) {
    if (!a || !_histPrices || !_histDates.length) return;
    const canvas=$.perf, ctx=canvas.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=(rect.width||800)*dpr; canvas.height=220*dpr;
    ctx.scale(dpr,dpr);
    const W=canvas.width/dpr,H=canvas.height/dpr;
    const pad={top:16,right:20,bottom:36,left:58};
    const pw=W-pad.left-pad.right,ph=H-pad.top-pad.bottom;

    /* Compute portfolio cumulative return */
    const weights=a.weights;
    const portRets = Stats.portfolioReturns(_histPrices, weights);
    /* Reconstruct cumulative price series from returns */
    const portCum=[0], niftyCum=[0];
    const niftyRets = _histPrices['NIFTY'] ? Stats.logReturns(_histPrices['NIFTY']) : [];
    const minLen = Math.min(portRets.length, niftyRets.length, _histDates.length-1);

    for(let i=0;i<minLen;i++){
      portCum.push(+((portCum[portCum.length-1] + portRets[portRets.length-minLen+i]*100)).toFixed(3));
      niftyCum.push(+((niftyCum[niftyCum.length-1] + niftyRets[niftyRets.length-minLen+i]*100)).toFixed(3));
    }

    const allVals=[...portCum,...niftyCum];
    const yMin=Math.min(...allVals)-2, yMax=Math.max(...allVals)+2;
    const tx=i=>pad.left+(i/(portCum.length-1))*pw;
    const ty=v=>pad.top+((yMax-v)/(yMax-yMin))*ph;

    ctx.clearRect(0,0,W,H);

    /* Zero line */
    ctx.strokeStyle='#E2E8F0';ctx.lineWidth=1;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(pad.left,ty(0));ctx.lineTo(pad.left+pw,ty(0));ctx.stroke();
    ctx.setLineDash([]);

    /* NIFTY line */
    ctx.beginPath();ctx.strokeStyle='#CBD5E1';ctx.lineWidth=1.5;
    niftyCum.forEach((v,i)=>{if(i===0)ctx.moveTo(tx(i),ty(v));else ctx.lineTo(tx(i),ty(v));});
    ctx.stroke();

    /* Portfolio fill */
    ctx.beginPath();ctx.strokeStyle='#1B64F2';ctx.lineWidth=2;
    portCum.forEach((v,i)=>{if(i===0)ctx.moveTo(tx(i),ty(v));else ctx.lineTo(tx(i),ty(v));});
    ctx.stroke();
    /* Gradient fill */
    const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
    grad.addColorStop(0,'rgba(27,100,242,.15)');grad.addColorStop(1,'rgba(27,100,242,0)');
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.moveTo(tx(0),ty(portCum[0]));
    portCum.forEach((v,i)=>ctx.lineTo(tx(i),ty(v)));
    ctx.lineTo(tx(portCum.length-1),ty(yMin));ctx.lineTo(tx(0),ty(yMin));ctx.closePath();ctx.fill();

    /* Y labels */
    ctx.fillStyle='#64748B';ctx.font='11px Inter,sans-serif';ctx.textAlign='right';
    for(let i=0;i<=4;i++){const yv=yMin+i*(yMax-yMin)/4;ctx.fillText(yv.toFixed(0)+'%',pad.left-7,ty(yv)+4);}
    /* X labels (month marks) */
    ctx.textAlign='center';ctx.fillStyle='#94A3B8';ctx.font='10px Inter,sans-serif';
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const n=portCum.length;
    [0,.25,.5,.75,1].forEach(frac=>{
      const i=Math.floor(frac*(n-1));
      const ts=_histDates[Math.max(0,_histDates.length-n+i)];
      const label=ts?new Date(ts).toLocaleDateString('en-IN',{month:'short'}):months[Math.floor(frac*11)];
      ctx.fillText(label,tx(i),H-8);
    });
    /* Final values */
    const pFinal=portCum[portCum.length-1], nFinal=niftyCum[niftyCum.length-1];
    ctx.font='bold 10px Inter,sans-serif';ctx.textAlign='left';
    ctx.fillStyle='#1B64F2';ctx.fillText(`+${pFinal.toFixed(1)}%`,pad.left+pw+4,ty(pFinal)+4);
  }

  /* ── Correlation Heatmap ────────────────────────────────────────────────── */
  function drawCorrHeatmap() {
    const syms=Object.keys(_corrMatrix);
    if(!syms.length) return;
    const canvas=$.corr, cell=52, fs=11;
    const size=syms.length*cell+80;
    canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,size,size);

    function corrColor(v) {
      /* red→white→green: v=-1 red, v=0 white, v=1 green */
      if(v>=0) { const t=v; return `rgb(${Math.round(240*(1-t))},${Math.round(240)},${Math.round(240*(1-t))})`; }
      else { const t=-v; return `rgb(${Math.round(240)},${Math.round(240*(1-t))},${Math.round(240*(1-t))})`; }
    }

    const offX=60, offY=60;
    syms.forEach((a,i)=>{
      /* Row label */
      ctx.fillStyle='#334155';ctx.font=`bold ${fs}px Inter,sans-serif`;ctx.textAlign='right';
      ctx.fillText(a,offX-6,offY+i*cell+cell/2+4);
      /* Col label */
      ctx.save();ctx.translate(offX+i*cell+cell/2,offY-6);ctx.rotate(-Math.PI/4);
      ctx.textAlign='right';ctx.fillText(a,0,0);ctx.restore();

      syms.forEach((b,j)=>{
        const v=_corrMatrix[a]?.[b]??0;
        ctx.fillStyle=corrColor(v);
        ctx.fillRect(offX+j*cell,offY+i*cell,cell-2,cell-2);
        ctx.fillStyle=Math.abs(v)>0.6?'#fff':'#334155';
        ctx.font=`bold ${fs}px JetBrains Mono,monospace`;ctx.textAlign='center';
        ctx.fillText(v.toFixed(2),offX+j*cell+cell/2,offY+i*cell+cell/2+4);
      });
    });
  }

  /* ── Per-stock table ─────────────────────────────────────────────────────── */
  function renderStockTable(syms) {
    $.stockBody.innerHTML='';
    for(const sym of syms) {
      const s=_stockStats[sym];
      if(!s) continue;
      const tr=document.createElement('tr');
      const betaCol = s.beta!==null?(s.beta>1.2?'#DC2626':s.beta<0.8?'#16A34A':'#0F172A'):'';
      const alphaCol= s.alpha!==null?(s.alpha>2?'#16A34A':s.alpha<-2?'#DC2626':'#0F172A'):'';
      tr.innerHTML=`
        <td><strong>${sym}</strong></td>
        <td style="color:${betaCol};font-weight:700">${s.beta?.toFixed(2)??'—'}</td>
        <td style="color:${alphaCol};font-weight:700">${s.alpha!==null?(s.alpha>0?'+':'')+s.alpha.toFixed(2)+'%':'—'}</td>
        <td>${s.vol?.toFixed(1)??'—'}%</td>
        <td style="color:#DC2626">${s.mdd!==null?'-'+s.mdd.toFixed(1)+'%':'—'}</td>
        <td style="color:${(s.sortino??0)>0.5?'#16A34A':'#D97706'}">${s.sortino?.toFixed(2)??'—'}</td>
        <td>${s.var95?.toFixed(2)??'—'}%</td>`;
      $.stockBody.appendChild(tr);
    }
  }

  /* ── Allocations table ───────────────────────────────────────────────────── */
  function sortedAllocs() {
    const kFn={risk:a=>a.riskScore,ret:a=>a.portRet,vol:a=>a.portVol,mdd:a=>a.portMDD,var:a=>a.portVar,sortino:a=>a.sortino??-99};
    return [..._analyzed].sort((a,b)=>_sortAsc?(kFn[_sortKey]?.(a)??0)-(kFn[_sortKey]?.(b)??0):(kFn[_sortKey]?.(b)??0)-(kFn[_sortKey]?.(a)??0));
  }

  function renderAllocTable() {
    const data=sortedAllocs();
    $.tmeta.textContent=`${data.length} allocation${data.length!==1?'s':''}`;
    $.abody.innerHTML='';
    const best=_analyzed[0];
    data.slice(0,100).forEach((a,i)=>{
      const isBest=a===best;
      const chips=a.symbols.sort((x,y)=>(a.allocation[y]??0)-(a.allocation[x]??0))
        .map(s=>`<span class="achip">${s}×${a.allocation[s]}</span>`).join('');
      const tr=document.createElement('tr');
      if(isBest) tr.className='best';
      tr.innerHTML=`
        <td style="font-weight:700;color:#94A3B8">${i+1}${isBest?' ★':''}</td>
        <td><div class="achips">${chips}</div></td>
        <td><strong style="color:${riskColor(a.riskLevel)}">${a.riskScore}</strong></td>
        <td style="color:${a.portRet>10?'#16A34A':a.portRet<0?'#DC2626':'#0F172A'};font-weight:700">${a.portRet.toFixed(1)}%</td>
        <td>${a.portVol.toFixed(1)}%</td>
        <td style="color:#DC2626">-${a.portMDD.toFixed(1)}%</td>
        <td>${a.portVar.toFixed(2)}%</td>
        <td style="font-weight:700">${a.sortino?.toFixed(2)??'—'}</td>
        <td><span class="rbadge rbadge--${a.riskLevel}">${riskEmoji(a.riskLevel)} ${a.riskLevel}</span></td>`;
      tr.addEventListener('click',()=>{ renderSummary(a); drawPerfChart(a); });
      $.abody.appendChild(tr);
    });
  }

  return { init };
})();
