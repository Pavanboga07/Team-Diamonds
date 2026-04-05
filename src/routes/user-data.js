'use strict';
/* src/routes/user-data.js — per-user watchlist + history (requires JWT) */

const express      = require('express');
const db           = require('../db/db');
const { authenticate } = require('../middleware/authenticate');

function createUserDataRouter() {
  const router = express.Router();
  router.use(authenticate); // all routes below require a valid token

  /* ── Watchlist ──────────────────────────────────────────── */

  router.get('/user/watchlist', (req, res) => {
    const items = db
      .prepare('SELECT symbol, added_at as addedAt FROM watchlist WHERE user_id = ? ORDER BY added_at DESC')
      .all(req.user.id);
    res.json({ ok: true, data: items });
  });

  router.post('/user/watchlist', (req, res) => {
    const { symbol } = req.body ?? {};
    if (!symbol || typeof symbol !== 'string')
      return res.status(400).json({ ok: false, message: 'symbol is required.' });
    const sym = symbol.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, '');
    if (!sym) return res.status(400).json({ ok: false, message: 'Invalid symbol.' });
    try {
      db.prepare('INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)').run(req.user.id, sym);
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  router.delete('/user/watchlist/:symbol', (req, res) => {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND symbol = ?').run(req.user.id, req.params.symbol);
    res.status(204).end();
  });

  router.delete('/user/watchlist', (req, res) => {
    db.prepare('DELETE FROM watchlist WHERE user_id = ?').run(req.user.id);
    res.status(204).end();
  });

  /* ── History ────────────────────────────────────────────── */

  router.get('/user/history', (req, res) => {
    const runs = db.prepare(`
      SELECT id, tickers, budget, max_leftover AS maxLeftover,
             equation, source, total, best_pct AS bestPct, portfolios,
             created_at AS timestamp
      FROM history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id).map(r => ({
      ...r,
      tickers:    JSON.parse(r.tickers    ?? '[]'),
      portfolios: JSON.parse(r.portfolios ?? '[]'),
    }));
    res.json({ ok: true, data: runs });
  });

  router.post('/user/history', (req, res) => {
    const run = req.body;
    if (!run?.id || !run?.tickers)
      return res.status(400).json({ ok: false, message: 'Invalid run data.' });
    try {
      db.prepare(`
        INSERT OR REPLACE INTO history
          (id, user_id, tickers, budget, max_leftover, equation, source, total, best_pct, portfolios)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        run.id, req.user.id,
        JSON.stringify(run.tickers),
        run.budget, run.maxLeftover,
        run.equation, run.source,
        run.total, run.bestPct,
        JSON.stringify((run.portfolios ?? []).slice(0, 10))
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  router.delete('/user/history/:id', (req, res) => {
    db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.status(204).end();
  });

  router.delete('/user/history', (req, res) => {
    db.prepare('DELETE FROM history WHERE user_id = ?').run(req.user.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createUserDataRouter };
