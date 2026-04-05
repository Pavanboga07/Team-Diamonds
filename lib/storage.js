'use strict';
/* lib/storage.js — localStorage persistence layer */

const Storage = (() => {
  const KEYS = { WATCHLIST: 'qs_watchlist_v1', HISTORY: 'qs_history_v1' };
  const MAX_HISTORY = 50;

  function _read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  }
  function _write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  const watchlist = {
    get()         { return _read(KEYS.WATCHLIST, []); },
    add(symbol)   {
      const list = watchlist.get();
      if (!list.find(i => i.symbol === symbol)) {
        list.push({ symbol, addedAt: Date.now() });
        _write(KEYS.WATCHLIST, list);
      }
    },
    remove(symbol){ _write(KEYS.WATCHLIST, watchlist.get().filter(i => i.symbol !== symbol)); },
    has(symbol)   { return watchlist.get().some(i => i.symbol === symbol); },
    clear()       { _write(KEYS.WATCHLIST, []); },
  };

  const history = {
    getAll()  { return _read(KEYS.HISTORY, []); },
    getById(id){ return history.getAll().find(r => r.id === id) ?? null; },
    save(run) {
      const list = [run, ...history.getAll().filter(r => r.id !== run.id)].slice(0, MAX_HISTORY);
      _write(KEYS.HISTORY, list);
    },
    clear()   { _write(KEYS.HISTORY, []); },
    remove(id){ _write(KEYS.HISTORY, history.getAll().filter(r => r.id !== id)); },
  };

  return { watchlist, history };
})();
