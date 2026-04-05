'use strict';
/* src/routes/india-market.js — Live Indian market data via Yahoo Finance NSE */

const https   = require('https');
const express = require('express');

const NSE_STOCKS = [
  { symbol: 'RELIANCE',   yf: 'RELIANCE.NS',   name: 'Reliance Industries', sector: 'Energy'     },
  { symbol: 'TCS',        yf: 'TCS.NS',         name: 'Tata Consultancy',    sector: 'IT'         },
  { symbol: 'INFY',       yf: 'INFY.NS',        name: 'Infosys',             sector: 'IT'         },
  { symbol: 'HDFCBANK',   yf: 'HDFCBANK.NS',    name: 'HDFC Bank',           sector: 'Banking'    },
  { symbol: 'ICICIBANK',  yf: 'ICICIBANK.NS',   name: 'ICICI Bank',          sector: 'Banking'    },
  { symbol: 'WIPRO',      yf: 'WIPRO.NS',        name: 'Wipro',               sector: 'IT'         },
  { symbol: 'HCLTECH',    yf: 'HCLTECH.NS',     name: 'HCL Technologies',    sector: 'IT'         },
  { symbol: 'SBIN',       yf: 'SBIN.NS',        name: 'State Bank of India', sector: 'Banking'    },
  { symbol: 'AXISBANK',   yf: 'AXISBANK.NS',    name: 'Axis Bank',           sector: 'Banking'    },
  { symbol: 'KOTAKBANK',  yf: 'KOTAKBANK.NS',   name: 'Kotak Mahindra Bank', sector: 'Banking'    },
  { symbol: 'BAJFINANCE', yf: 'BAJFINANCE.NS',  name: 'Bajaj Finance',       sector: 'Finance'    },
  { symbol: 'MARUTI',     yf: 'MARUTI.NS',      name: 'Maruti Suzuki',       sector: 'Auto'       },
  { symbol: 'TATAMOTORS', yf: 'TATAMOTORS.NS',  name: 'Tata Motors',         sector: 'Auto'       },
  { symbol: 'ITC',        yf: 'ITC.NS',         name: 'ITC Limited',         sector: 'FMCG'       },
  { symbol: 'HINDUNILVR', yf: 'HINDUNILVR.NS',  name: 'Hindustan Unilever',  sector: 'FMCG'       },
  { symbol: 'SUNPHARMA',  yf: 'SUNPHARMA.NS',   name: 'Sun Pharmaceuticals', sector: 'Pharma'     },
  { symbol: 'DRREDDY',    yf: 'DRREDDY.NS',     name: "Dr. Reddy's Labs",    sector: 'Pharma'     },
  { symbol: 'NTPC',       yf: 'NTPC.NS',        name: 'NTPC Limited',        sector: 'Energy'     },
  { symbol: 'ONGC',       yf: 'ONGC.NS',        name: 'ONGC',                sector: 'Energy'     },
  { symbol: 'TECHM',      yf: 'TECHM.NS',       name: 'Tech Mahindra',       sector: 'IT'         },
];

const NSE_INDICES = [
  { symbol: 'NIFTY 50',   yf: '^NSEI',    name: 'Nifty 50'   },
  { symbol: 'SENSEX',     yf: '^BSESN',   name: 'Sensex'     },
  { symbol: 'BANK NIFTY', yf: '^NSEBANK', name: 'Bank Nifty' },
  { symbol: 'NIFTY IT',   yf: '^CNXIT',   name: 'Nifty IT'   },
];

/* Static fallback prices (in INR) */
const STATIC = {
  'RELIANCE':   { price: 2948.50, changePercent:  1.23, volume: 4820000 },
  'TCS':        { price: 3812.75, changePercent:  0.87, volume: 1230000 },
  'INFY':       { price: 1782.40, changePercent:  2.15, volume: 5640000 },
  'HDFCBANK':   { price: 1662.20, changePercent: -0.42, volume: 7320000 },
  'ICICIBANK':  { price: 1248.65, changePercent:  1.05, volume: 8150000 },
  'WIPRO':      { price:  462.30, changePercent:  1.78, volume: 3240000 },
  'HCLTECH':    { price: 1890.15, changePercent:  0.62, volume: 2180000 },
  'SBIN':       { price:  815.40, changePercent: -0.38, volume: 9870000 },
  'AXISBANK':   { price: 1142.80, changePercent:  0.95, volume: 4620000 },
  'KOTAKBANK':  { price: 1987.60, changePercent: -0.28, volume: 2340000 },
  'BAJFINANCE': { price: 7248.50, changePercent:  1.42, volume: 1890000 },
  'MARUTI':     { price: 12480.0, changePercent:  0.75, volume:  562000 },
  'TATAMOTORS': { price:  984.65, changePercent:  2.84, volume: 6720000 },
  'ITC':        { price:  462.15, changePercent:  0.32, volume: 8940000 },
  'HINDUNILVR': { price: 2384.30, changePercent: -0.18, volume: 1240000 },
  'SUNPHARMA':  { price: 1748.90, changePercent:  1.94, volume: 2180000 },
  'DRREDDY':    { price: 6284.50, changePercent:  0.88, volume:  548000 },
  'NTPC':       { price:  362.40, changePercent: -0.52, volume: 6420000 },
  'ONGC':       { price:  284.75, changePercent: -1.12, volume: 9820000 },
  'TECHM':      { price: 1682.55, changePercent:  3.14, volume: 3120000 },
  'NIFTY 50':   { price: 22502.0, changePercent:  0.84, volume: 0 },
  'SENSEX':     { price: 74119.0, changePercent:  0.72, volume: 0 },
  'BANK NIFTY': { price: 48221.0, changePercent:  0.61, volume: 0 },
  'NIFTY IT':   { price: 38142.0, changePercent:  1.92, volume: 0 },
};

/* In-memory cache — 15s TTL */
let cache = null, cacheAt = 0;
const CACHE_TTL = 15000;

function fetchYF(symbols, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const csv = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${csv}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume,longName`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(raw)?.quoteResponse?.result ?? [];
          resolve(result);
        } catch { reject(new Error('Parse error')); }
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

function createIndiaMarketRouter() {
  const router = express.Router();

  router.get('/market/india', async (req, res) => {
    if (cache && Date.now() - cacheAt < CACHE_TTL) return res.json(cache);

    const allStocks  = [...NSE_STOCKS, ...NSE_INDICES];
    const yfSymbols  = allStocks.map(s => s.yf);
    let   source = 'static';

    const stockMap = {};
    allStocks.forEach(s => {
      const st = STATIC[s.symbol] ?? { price: 0, changePercent: 0, volume: 0 };
      stockMap[s.symbol] = {
        symbol: s.symbol, name: s.name, sector: s.sector ?? 'Index',
        price: st.price, changePercent: st.changePercent, volume: st.volume,
        currency: 'INR', source: 'static',
      };
    });

    try {
      const results = await fetchYF(yfSymbols);
      if (results.length > 0) {
        source = 'live';
        results.forEach(r => {
          const meta = allStocks.find(s => s.yf === r.symbol);
          if (!meta) return;
          stockMap[meta.symbol] = {
            symbol:        meta.symbol,
            name:          meta.name,
            sector:        meta.sector ?? 'Index',
            price:         r.regularMarketPrice          ?? stockMap[meta.symbol].price,
            changePercent: r.regularMarketChangePercent  ?? stockMap[meta.symbol].changePercent,
            volume:        r.regularMarketVolume         ?? stockMap[meta.symbol].volume,
            currency: 'INR', source: 'live',
          };
        });
      }
    } catch (e) {
      console.warn('[india-market] Live fetch failed, using static:', e.message);
    }

    const stocks  = NSE_STOCKS.map(s  => stockMap[s.symbol]);
    const indices = NSE_INDICES.map(i => stockMap[i.symbol]);
    const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    const losers  = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

    const sectorMap = {};
    stocks.forEach(s => {
      if (!sectorMap[s.sector]) sectorMap[s.sector] = { count: 0, totalChg: 0 };
      sectorMap[s.sector].count++;
      sectorMap[s.sector].totalChg += s.changePercent;
    });
    const sectors = Object.entries(sectorMap).map(([name, d]) => ({
      name, avgChange: +(d.totalChg / d.count).toFixed(2),
    })).sort((a, b) => b.avgChange - a.avgChange);

    cache = { ok: true, source, updatedAt: Date.now(), stocks, indices, gainers, losers, sectors };
    cacheAt = Date.now();
    res.json(cache);
  });

  return router;
}

module.exports = { createIndiaMarketRouter };
