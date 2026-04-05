'use strict';
/* pages/history.js — Run history using localStorage (no auth) */

const HistoryPage = (() => {
  const STORAGE_KEY = 'qs_history';
  let $ = null;

  /* ── storage ─────────────────────────────────────── */
  function getAll()    { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function saveAll(a)  { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }
  function deleteRun(id) { saveAll(getAll().filter(r => r.id !== id)); }
  function clearAll()  { localStorage.removeItem(STORAGE_KEY); }

  /* Public: called by planner.js to persist a run */
  function addRun(run) {
    const all = getAll();
    all.unshift({ ...run, id: run.id || Date.now().toString(), timestamp: run.timestamp || Date.now() });
    if (all.length > 50) all.length = 50; // keep max 50
    saveAll(all);
  }

  /* ── init ────────────────────────────────────────── */
  function init() {
    $ = {
      list:     document.getElementById('hist-list'),
      empty:    document.getElementById('hist-empty'),
      clearBtn: document.getElementById('hist-clearBtn'),
    };
    $.clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all history?')) return;
      clearAll();
      render([]);
    });
    render(getAll());
  }

  /* ── render ──────────────────────────────────────── */
  function render(runs) {
    if (!$.list) return;
    $.empty.hidden    = runs.length > 0;
    $.list.innerHTML  = '';
    runs.forEach(run => $.list.appendChild(buildCard(run)));
  }

  function timeago(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
    return new Date(ts).toLocaleDateString('en-IN');
  }

  function fmtInr(n) {
    if (!n && n !== 0) return '—';
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function buildCard(run) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.cssText = 'margin-bottom:10px';

    const invested = run.bestPct != null ? `${run.bestPct}% invested` : '—';
    const srcBadge = run.source === 'live'
      ? `<span style="font-size:10px;background:#DCFCE7;color:#16A34A;padding:1px 6px;border-radius:10px;font-weight:700">LIVE</span>`
      : `<span style="font-size:10px;background:#F3F4F6;color:#6B7280;padding:1px 6px;border-radius:10px;font-weight:700">DEMO</span>`;

    wrap.innerHTML = `
      <div class="card__header" style="align-items:flex-start">
        <div style="flex:1">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            ${(run.tickers || []).map(t => `<span style="background:#EFF6FF;color:#1B64F2;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">${t}</span>`).join('')}
            ${srcBadge}
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:var(--text-muted)">
            <span>Budget: <strong style="color:var(--text-primary)">${fmtInr(run.budget)}</strong></span>
            <span>Solutions: <strong style="color:var(--text-primary)">${run.total ?? '—'}</strong></span>
            <span>Best: <strong style="color:#16A34A">${invested}</strong></span>
          </div>
        </div>
        <div style="text-align:right;font-size:12px;color:var(--text-muted);white-space:nowrap;min-width:80px">
          ${timeago(run.timestamp)}<br>
          <small>${new Date(run.timestamp).toLocaleString('en-IN',{hour12:true,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small>
        </div>
      </div>
      <div style="padding:10px 16px 14px;display:flex;gap:8px">
        <button class="btn btn--primary" style="height:32px;font-size:12px" data-rerun>↻ Re-run</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid var(--border)" data-cmp>⊕ Compare</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid #FCA5A5;color:#DC2626;margin-left:auto" data-del>✕ Delete</button>
      </div>`;

    wrap.querySelector('[data-rerun]').addEventListener('click', () => {
      localStorage.setItem('qs_planner_prefill', JSON.stringify({
        tickers: run.tickers, budget: run.budget, maxLeftover: run.maxLeftover,
      }));
      location.href = '/pages/planner.html';
    });
    wrap.querySelector('[data-cmp]').addEventListener('click', () => {
      localStorage.setItem('qs_compare_prefill', run.id);
      location.href = '/pages/compare.html';
    });
    wrap.querySelector('[data-del]').addEventListener('click', () => {
      deleteRun(run.id);
      render(getAll());
    });

    return wrap;
  }

  return { init, addRun, getAll };
})();
