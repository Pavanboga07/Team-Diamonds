'use strict';
/**
 * Market Data Route — GET /market/quotes?symbols=RELIANCE,TCS,INFY
 * Uses Yahoo Finance with NSE (.NS) suffix for Indian stocks.
 * Falls back to static INR data when Yahoo is unavailable.
 */

const https   = require('https');
const express = require('express');

// ---------------------------------------------------------------------------
// Static fallback — Indian NSE stocks in INR
// ---------------------------------------------------------------------------
const STATIC_QUOTES = {
  RELIANCE:   { symbol: 'RELIANCE',   yf: 'RELIANCE.NS',   price: 2948.50, changePercent:  1.23, name: 'Reliance Industries',  sector: 'Energy',  currency: 'INR', source: 'static' },
  TCS:        { symbol: 'TCS',        yf: 'TCS.NS',        price: 3812.75, changePercent:  0.87, name: 'Tata Consultancy',     sector: 'IT',      currency: 'INR', source: 'static' },
  INFY:       { symbol: 'INFY',       yf: 'INFY.NS',       price: 1782.40, changePercent:  2.15, name: 'Infosys',              sector: 'IT',      currency: 'INR', source: 'static' },
  HDFCBANK:   { symbol: 'HDFCBANK',   yf: 'HDFCBANK.NS',   price: 1662.20, changePercent: -0.42, name: 'HDFC Bank',            sector: 'Banking', currency: 'INR', source: 'static' },
  ICICIBANK:  { symbol: 'ICICIBANK',  yf: 'ICICIBANK.NS',  price: 1248.65, changePercent:  1.05, name: 'ICICI Bank',           sector: 'Banking', currency: 'INR', source: 'static' },
  WIPRO:      { symbol: 'WIPRO',      yf: 'WIPRO.NS',      price:  462.30, changePercent:  1.78, name: 'Wipro',                sector: 'IT',      currency: 'INR', source: 'static' },
  HCLTECH:    { symbol: 'HCLTECH',    yf: 'HCLTECH.NS',    price: 1890.15, changePercent:  0.62, name: 'HCL Technologies',     sector: 'IT',      currency: 'INR', source: 'static' },
  SBIN:       { symbol: 'SBIN',       yf: 'SBIN.NS',       price:  815.40, changePercent: -0.38, name: 'State Bank of India',  sector: 'Banking', currency: 'INR', source: 'static' },
  AXISBANK:   { symbol: 'AXISBANK',   yf: 'AXISBANK.NS',   price: 1142.80, changePercent:  0.95, name: 'Axis Bank',            sector: 'Banking', currency: 'INR', source: 'static' },
  KOTAKBANK:  { symbol: 'KOTAKBANK',  yf: 'KOTAKBANK.NS',  price: 1987.60, changePercent: -0.28, name: 'Kotak Mahindra Bank',  sector: 'Banking', currency: 'INR', source: 'static' },
  BAJFINANCE: { symbol: 'BAJFINANCE', yf: 'BAJFINANCE.NS', price: 7248.50, changePercent:  1.42, name: 'Bajaj Finance',        sector: 'Finance', currency: 'INR', source: 'static' },
  MARUTI:     { symbol: 'MARUTI',     yf: 'MARUTI.NS',     price: 12480.0, changePercent:  0.75, name: 'Maruti Suzuki',        sector: 'Auto',    currency: 'INR', source: 'static' },
  TATAMOTORS: { symbol: 'TATAMOTORS', yf: 'TATAMOTORS.NS', price:  984.65, changePercent:  2.84, name: 'Tata Motors',          sector: 'Auto',    currency: 'INR', source: 'static' },
  ITC:        { symbol: 'ITC',        yf: 'ITC.NS',        price:  462.15, changePercent:  0.32, name: 'ITC Limited',          sector: 'FMCG',    currency: 'INR', source: 'static' },
  HINDUNILVR: { symbol: 'HINDUNILVR', yf: 'HINDUNILVR.NS', price: 2384.30, changePercent: -0.18, name: 'Hindustan Unilever',   sector: 'FMCG',    currency: 'INR', source: 'static' },
  SUNPHARMA:  { symbol: 'SUNPHARMA',  yf: 'SUNPHARMA.NS',  price: 1748.90, changePercent:  1.94, name: 'Sun Pharmaceuticals',  sector: 'Pharma',  currency: 'INR', source: 'static' },
  DRREDDY:    { symbol: 'DRREDDY',    yf: 'DRREDDY.NS',    price: 6284.50, changePercent:  0.88, name: "Dr. Reddy's Labs",     sector: 'Pharma',  currency: 'INR', source: 'static' },
  NTPC:       { symbol: 'NTPC',       yf: 'NTPC.NS',       price:  362.40, changePercent: -0.52, name: 'NTPC Limited',         sector: 'Energy',  currency: 'INR', source: 'static' },
  ONGC:       { symbol: 'ONGC',       yf: 'ONGC.NS',       price:  284.75, changePercent: -1.12, name: 'ONGC',                 sector: 'Energy',  currency: 'INR', source: 'static' },
  TECHM:      { symbol: 'TECHM',      yf: 'TECHM.NS',      price: 1682.55, changePercent:  3.14, name: 'Tech Mahindra',        sector: 'IT',      currency: 'INR', source: 'static' },
};

// ---------------------------------------------------------------------------
// Cache (30-second TTL)
// ---------------------------------------------------------------------------
const cache = new Map();
function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data, ttlMs = 30000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Symbol validation
// ---------------------------------------------------------------------------
const SYMBOL_RE = /^[A-Z0-9.\-]{1,12}$/;
function validateSymbols(raw) {
  if (!raw || typeof raw !== 'string')
    return { ok: false, message: 'symbols query param is required.' };
  const symbols = raw.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0) return { ok: false, message: 'At least one symbol is required.' };
  if (symbols.length > 6)  return { ok: false, message: 'Maximum 6 symbols allowed.' };
  for (const s of symbols)
    if (!SYMBOL_RE.test(s)) return { ok: false, message: `Invalid symbol: ${s}` };
  return { ok: true, symbols };
}

// ---------------------------------------------------------------------------
// Yahoo Finance fetch — maps NSE symbol → Yahoo .NS suffix
// ---------------------------------------------------------------------------
function fetchYahooQuotes(symbols, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    // Map each symbol to its Yahoo Finance NSE format
    const yfMap = {};
    const yfSymbols = symbols.map(s => {
      const yf = STATIC_QUOTES[s]?.yf || (s + '.NS'); // default .NS suffix
      yfMap[yf] = s;
      return yf;
    });

    const csv = yfSymbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${csv}&fields=regularMarketPrice,regularMarketChangePercent,longName,currency`;

    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(raw)?.quoteResponse?.result;
          if (!Array.isArray(result) || result.length === 0)
            return reject(new Error('Yahoo returned empty result.'));

          const data = {};
          for (const item of result) {
            const yfSym  = item.symbol;
            const origSym = yfMap[yfSym] || yfSym.replace('.NS', '');
            const price   = item.regularMarketPrice;
            if (!origSym || typeof price !== 'number') continue;
            data[origSym] = {
              symbol:        origSym,
              price,
              changePercent: item.regularMarketChangePercent ?? 0,
              name:          item.longName || item.shortName || origSym,
              currency:      'INR',
              source:        'live',
            };
          }
          if (Object.keys(data).length === 0)
            return reject(new Error('No valid price data from Yahoo.'));
          resolve(data);
        } catch { reject(new Error('Failed to parse Yahoo response.')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Static fallback
// ---------------------------------------------------------------------------
function getStaticFallback(symbols) {
  const data = {}, missing = [];
  for (const sym of symbols) {
    if (STATIC_QUOTES[sym]) data[sym] = STATIC_QUOTES[sym];
    else missing.push(sym);
  }
  return { data, missing };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function createMarketRouter() {
  const router = express.Router();

  router.get('/market/quotes', async (req, res) => {
    const requestId = req.requestId || null;
    const validation = validateSymbols(req.query.symbols);
    if (!validation.ok)
      return res.status(400).json({ ok: false, requestId, data: null, message: validation.message });

    const { symbols } = validation;
    const cacheKey = symbols.slice().sort().join(',');
    const cached = getCached(cacheKey);
    if (cached)
      return res.json({ ok: true, requestId, ...cached });

    let finalData = {}, source = 'live', warning = null;

    try {
      const liveData = await fetchYahooQuotes(symbols);
      const missing  = symbols.filter(s => !liveData[s]);
      if (missing.length > 0) {
        const { data: staticData, missing: still } = getStaticFallback(missing);
        if (still.length > 0)
          return res.status(422).json({ ok: false, requestId, data: null,
            message: `No price data for: ${still.join(', ')}. Try: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN.` });
        finalData = { ...liveData, ...staticData };
        warning = `Demo prices for: ${missing.join(', ')}`;
        source  = 'mixed';
      } else {
        finalData = liveData;
      }
    } catch (err) {
      console.warn('[market] Yahoo unavailable:', err.message);
      const { data: staticData, missing: still } = getStaticFallback(symbols);
      if (still.length > 0)
        return res.status(422).json({ ok: false, requestId, data: null,
          message: `No data for: ${still.join(', ')}. Supported: ${Object.keys(STATIC_QUOTES).join(', ')}` });
      finalData = staticData;
      source    = 'static';
      warning   = 'Live data unavailable, showing last-close prices.';
    }

    const payload = { data: finalData, source, cachedAt: Date.now() };
    setCache(cacheKey, payload);
    return res.json({ ok: true, requestId, ...payload, warning: warning || null });
  });

  return router;
}

module.exports = { createMarketRouter };
