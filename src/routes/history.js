'use strict';
/**
 * GET /market/history?symbols=RELIANCE,TCS&range=1y
 * Returns 1 year of daily closing prices for each symbol + NIFTY 50 benchmark.
 * Source: Yahoo Finance v8 chart API (free, no key).
 * Cache TTL: 1 hour (historical data doesn't change intraday).
 */

const https   = require('https');
const express = require('express');

/* 1-hour cache */
const _cache = new Map();
function getCached(k) {
  const e = _cache.get(k);
  if (!e || Date.now() > e.exp) { _cache.delete(k); return null; }
  return e.data;
}
function setCache(k, d) { _cache.set(k, { data: d, exp: Date.now() + 3_600_000 }); }

/** Fetch daily OHLCV from Yahoo Finance chart API. Returns [[ts_ms, close], ...] */
function fetchChart(yfSym, range = '1y', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=${range}`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(raw)?.chart?.result?.[0];
          if (!result) return reject(new Error(`No chart data for ${yfSym}`));
          const ts     = result.timestamp ?? [];
          const closes = result.indicators?.quote?.[0]?.close ?? [];
          const pairs  = ts
            .map((t, i) => [t * 1000, closes[i]])
            .filter(([, p]) => typeof p === 'number' && p > 0);
          if (pairs.length < 10) return reject(new Error(`Insufficient data for ${yfSym}`));
          resolve(pairs);
        } catch (e) { reject(e); }
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

/**
 * Align all series to common timestamps.
 * Returns { RELIANCE: [p0,p1,...], TCS: [p0,p1,...], NIFTY: [...], _dates: [ts,...] }
 */
function alignSeries(seriesMap) {
  const syms  = Object.keys(seriesMap);
  const sets  = syms.map(s => new Set(seriesMap[s].map(([t]) => t)));
  /* intersection of all date sets */
  const common = [...sets[0]]
    .filter(t => sets.every(s => s.has(t)))
    .sort((a, b) => a - b);

  if (common.length < 30) return null; /* too few common dates → fail */

  const aligned = { _dates: common };
  for (const sym of syms) {
    const pmap = new Map(seriesMap[sym]);
    aligned[sym] = common.map(t => pmap.get(t) ?? null);
  }
  return aligned;
}

function createHistoryRouter() {
  const router = express.Router();

  router.get('/market/history', async (req, res) => {
    const raw = req.query.symbols;
    if (!raw) return res.status(400).json({ ok: false, message: 'symbols param required.' });

    const symbols  = raw.toUpperCase().split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
    const cacheKey = symbols.slice().sort().join(',');
    const cached   = getCached(cacheKey);
    if (cached) return res.json({ ok: true, ...cached, source: 'cache' });

    /* Fetch all symbols + NIFTY 50 benchmark in parallel */
    const yfSyms = [...symbols.map(s => s + '.NS'), '^NSEI'];
    const fetched = await Promise.all(
      yfSyms.map(yf => fetchChart(yf).catch(e => {
        console.warn(`[history] Failed ${yf}:`, e.message);
        return null;
      }))
    );

    const seriesMap = {};
    symbols.forEach((sym, i) => { if (fetched[i]) seriesMap[sym] = fetched[i]; });
    if (fetched[fetched.length - 1]) seriesMap['NIFTY'] = fetched[fetched.length - 1];

    const stocksFetched = Object.keys(seriesMap).filter(k => k !== 'NIFTY').length;
    if (stocksFetched === 0) {
      return res.status(502).json({ ok: false, message: 'Could not fetch any historical price data from Yahoo Finance.' });
    }

    const aligned = alignSeries(seriesMap);
    if (!aligned) {
      return res.status(502).json({ ok: false, message: 'Could not align price series across symbols and dates.' });
    }

    const payload = {
      prices:      aligned,           /* { RELIANCE: [p,...], TCS: [...], NIFTY: [...] } */
      dates:       aligned._dates,    /* [timestamp_ms, ...] */
      tradingDays: aligned._dates.length,
      symbols,
    };
    delete payload.prices._dates;

    setCache(cacheKey, payload);
    res.json({ ok: true, ...payload, source: 'live' });
  });

  return router;
}

module.exports = { createHistoryRouter };
