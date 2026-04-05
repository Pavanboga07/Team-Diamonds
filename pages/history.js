'use strict';
/* pages/history.js — Portfolio run history (API-backed) */

const HistoryPage = (() => {
  let $ = null;

  function init() {
    $ = {
      list:     document.getElementById('hist-list'),
      empty:    document.getElementById('hist-empty'),
      clearBtn: document.getElementById('hist-clearBtn'),
    };
    $.clearBtn.addEventListener('click', async () => {
      if (!confirm('Clear all history?')) return;
      await AuthClient.apiFetch('/user/history', { method: 'DELETE' });
      App.updateUsageCounter();
      render([]);
    });
    load();
  }

  async function load() {
    $.list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:13px">Loading…</p>';
    try {
      const resp = await AuthClient.apiFetch('/user/history');
      if (resp.ok) render(resp.data ?? []);
      else $.list.innerHTML = `<p style="padding:16px;color:var(--loss)">Failed to load history.</p>`;
    } catch {
      $.list.innerHTML = `<p style="padding:16px;color:var(--loss)">Network error.</p>`;
    }
  }

  function render(runs) {
    $.empty.hidden = runs.length > 0;
    $.list.innerHTML = '';
    runs.forEach(run => $.list.appendChild(buildCard(run)));
    const countEl = document.getElementById('usageCount');
    if (countEl) countEl.textContent = runs.length;
  }

  function buildCard(run) {
    const wrap = document.createElement('div');
    wrap.className = 'hist-card card';
    wrap.innerHTML = `
      <div class="hist-card__header">
        <div class="hist-card__meta">
          <div class="hist-card__tickers">
            ${run.tickers.map(t => `<span class="ticker-chip" style="display:inline-flex">${t}</span>`).join('')}
          </div>
          <div class="hist-card__stats">
            <span>Budget: <strong>${Format.usd(run.budget)}</strong></span>
            <span>Solutions: <strong>${run.total ?? '—'}</strong></span>
            <span>Best: <strong style="color:var(--gain)">${run.bestPct ?? '—'}% invested</strong></span>
            <span class="badge ${run.source === 'live' ? 'badge--live' : 'badge--live badge--static'}" style="font-size:10px">${run.source === 'live' ? 'Live' : 'Demo'}</span>
          </div>
        </div>
        <div class="hist-card__time">${Format.timeago(run.timestamp * 1000)}<br>
          <small style="color:var(--text-faint)">${Format.datetime(run.timestamp * 1000)}</small>
        </div>
      </div>
      <div class="hist-card__actions">
        <button class="btn btn--primary" style="height:32px;font-size:12px" data-rerun>↻ Re-run</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid var(--border)" data-cmp>⊕ Compare</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid var(--loss-border);color:var(--loss)" data-del>✕ Delete</button>
      </div>`;

    wrap.querySelector('[data-rerun]').addEventListener('click', () => {
      OptimizerPage.loadParams({ tickers: run.tickers, budget: run.budget, maxLeftover: run.maxLeftover });
      App.navigate('optimizer');
    });
    wrap.querySelector('[data-cmp]').addEventListener('click', () => {
      ComparePage.preloadRun(run);
      App.navigate('compare');
    });
    wrap.querySelector('[data-del]').addEventListener('click', async () => {
      await AuthClient.apiFetch(`/user/history/${run.id}`, { method: 'DELETE' });
      App.updateUsageCounter();
      load();
    });
    return wrap;
  }

  return { init, load };
})();
