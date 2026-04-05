'use strict';
/* pages/history.js — Portfolio run history */

const HistoryPage = (() => {
  let $ = null;

  function init() {
    $ = {
      list:     document.getElementById('hist-list'),
      empty:    document.getElementById('hist-empty'),
      clearBtn: document.getElementById('hist-clearBtn'),
    };
    $.clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all history?')) return;
      Storage.history.clear();
      App.updateUsageCounter();
      render();
    });
    render();
  }

  function render() {
    const runs = Storage.history.getAll();
    $.empty.hidden = runs.length > 0;
    $.list.innerHTML = '';
    runs.forEach(run => $.list.appendChild(buildCard(run)));
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
            <span>Solutions: <strong>${run.total}</strong></span>
            <span>Best: <strong style="color:var(--gain)">${run.bestPct}% invested</strong></span>
            <span class="hist-card__source badge ${run.source === 'live' ? 'badge--live' : 'badge--live badge--static'}" style="font-size:10px">${run.source === 'live' ? 'Live' : 'Demo'}</span>
          </div>
        </div>
        <div class="hist-card__time">${Format.timeago(run.timestamp)}<br><small style="color:var(--text-faint)">${Format.datetime(run.timestamp)}</small></div>
      </div>
      <div class="hist-card__actions">
        <button class="btn btn--primary" style="height:32px;font-size:12px" data-rerun>↻ Re-run</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid var(--border)" data-compare>⊕ Compare</button>
        <button class="btn" style="height:32px;font-size:12px;border:1px solid var(--loss-border);color:var(--loss)" data-delete>✕ Delete</button>
      </div>`;

    wrap.querySelector('[data-rerun]').addEventListener('click', () => {
      OptimizerPage.loadParams({ tickers: run.tickers, budget: run.budget, maxLeftover: run.maxLeftover });
      App.navigate('optimizer');
    });
    wrap.querySelector('[data-compare]').addEventListener('click', () => {
      ComparePage.preload(run.id);
      App.navigate('compare');
    });
    wrap.querySelector('[data-delete]').addEventListener('click', () => {
      Storage.history.remove(run.id);
      App.updateUsageCounter();
      render();
    });
    return wrap;
  }

  return { init, render };
})();
