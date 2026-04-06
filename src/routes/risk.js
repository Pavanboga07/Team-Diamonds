'use strict';
/**
 * GET /market/risk?symbols=RELIANCE,TCS,INFY
 * Returns live beta, volatility, expected return, PE for each symbol.
 * Source: Yahoo Finance v7 quote endpoint (same as market.js).
 * Falls back to calibrated estimates if Yahoo is unavailable.
 */

const https   = require('https');
const express = require('express');

/* Baseline estimates (used as fallback + to fill incomplete Yahoo data) */
const STOCK_META = {
  RELIANCE:   { sector:'Energy',   beta:0.90, vol:18, ret:12 },
  TCS:        { sector:'IT',       beta:0.75, vol:16, ret:14 },
  INFY:       { sector:'IT',       beta:0.80, vol:17, ret:13 },
  HDFCBANK:   { sector:'Banking',  beta:1.10, vol:20, ret:11 },
  ICICIBANK:  { sector:'Banking',  beta:1.15, vol:22, ret:13 },
  WIPRO:      { sector:'IT',       beta:0.75, vol:18, ret:12 },
  HCLTECH:    { sector:'IT',       beta:0.80, vol:17, ret:13 },
  SBIN:       { sector:'Banking',  beta:1.25, vol:25, ret:10 },
  AXISBANK:   { sector:'Banking',  beta:1.20, vol:24, ret:12 },
  KOTAKBANK:  { sector:'Banking',  beta:1.05, vol:19, ret:10 },
  BAJFINANCE: { sector:'Finance',  beta:1.35, vol:28, ret:16 },
  MARUTI:     { sector:'Auto',     beta:1.00, vol:20, ret:12 },
  TATAMOTORS: { sector:'Auto',     beta:1.40, vol:32, ret:18 },
  ITC:        { sector:'FMCG',     beta:0.60, vol:14, ret:10 },
  HINDUNILVR: { sector:'FMCG',     beta:0.55, vol:13, ret:9  },
  SUNPHARMA:  { sector:'Pharma',   beta:0.85, vol:19, ret:14 },
  DRREDDY:    { sector:'Pharma',   beta:0.80, vol:18, ret:13 },
  NTPC:       { sector:'Energy',   beta:0.70, vol:15, ret:9  },
  ONGC:       { sector:'Energy',   beta:0.85, vol:20, ret:10 },
  TECHM:      { sector:'IT',       beta:0.90, vol:22, ret:15 },
};

/* In-memory cache — 5 min TTL */
const _cache = new Map();
function getCached(k) {
  const e = _cache.get(k);
  if (!e || Date.now() > e.exp) { _cache.delete(k); return null; }
  return e.data;
}
function setCache(k, d) { _cache.set(k, { data: d, exp: Date.now() + 300_000 }); }

function fetchYFRisk(yfSyms, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const fields = [
      'regularMarketPrice','beta',
      'fiftyTwoWeekHigh','fiftyTwoWeekLow',
      'targetMeanPrice','trailingPE',
    ].join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yfSyms.join(',')}&fields=${fields}`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)?.quoteResponse?.result ?? []); }
        catch { reject(new Error('Parse error')); }
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

function createRiskRouter() {
  const router = express.Router();

  router.get('/market/risk', async (req, res) => {
    const raw = req.query.symbols;
    if (!raw) return res.status(400).json({ ok: false, message: 'symbols param required.' });

    const symbols = raw.toUpperCase().split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
    const cacheKey = symbols.slice().sort().join(',');
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ok: true, data: cached, source: 'cache' });

    /* Build initial result from fallback estimates */
    const result = {};
    for (const sym of symbols) {
      const m = STOCK_META[sym] ?? { sector: 'Other', beta: 1.0, vol: 20, ret: 12 };
      result[sym] = {
        symbol: sym, sector: m.sector,
        beta: m.beta, annualVol: m.vol, expectedReturn: m.ret,
        pe: null, targetPrice: null, currentPrice: null,
        source: 'estimate',
      };
    }

    /* Attempt live enrichment from Yahoo Finance */
    let source = 'estimate';
    try {
      const yfMap = {};
      const yfSyms = symbols.map(s => { const yf = s + '.NS'; yfMap[yf] = s; return yf; });
      const items  = await fetchYFRisk(yfSyms);
      for (const r of items) {
        const sym = yfMap[r.symbol];
        if (!sym) continue;
        const price = r.regularMarketPrice;
        const hi    = r.fiftyTwoWeekHigh;
        const lo    = r.fiftyTwoWeekLow;

        /* Volatility estimate from 52-week range (Parkinson approximation) */
        const volFromRange = (hi && lo && lo > 0)
          ? Math.round(((hi - lo) / lo) * 50)  /* half-range × 100 */
          : result[sym].annualVol;

        /* Expected return from analyst target price */
        const expRet = (typeof r.targetMeanPrice === 'number' && price > 0)
          ? +((r.targetMeanPrice / price - 1) * 100).toFixed(1)
          : result[sym].expectedReturn;

        result[sym] = {
          ...result[sym],
          beta:           typeof r.beta === 'number'  ? +r.beta.toFixed(2)  : result[sym].beta,
          annualVol:      Math.max(5, Math.min(80, volFromRange)),
          expectedReturn: Math.max(-30, Math.min(80, expRet)),
          pe:             typeof r.trailingPE === 'number' ? +r.trailingPE.toFixed(1) : null,
          targetPrice:    typeof r.targetMeanPrice === 'number' ? r.targetMeanPrice : null,
          currentPrice:   typeof price === 'number'  ? price  : null,
          source: 'live',
        };
      }
      source = 'live';
    } catch (e) {
      console.warn('[risk] Yahoo fetch failed, using estimates:', e.message);
    }

    setCache(cacheKey, result);
    res.json({ ok: true, data: result, source, updatedAt: Date.now() });
  });

  return router;
}

module.exports = { createRiskRouter };
