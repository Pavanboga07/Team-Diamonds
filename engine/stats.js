'use strict';
/**
 * engine/stats.js — Professional portfolio statistics
 * Works in browser (<script src>) and Node.js (require).
 *
 * All functions accept plain arrays of closing prices (numbers).
 * Assumes 252 trading days per year.
 */

const TRADING_DAYS = 252;
const DEFAULT_RFR  = 0.065; /* India risk-free rate ≈ 6.5% (10yr G-Sec) */

/* ── Primitives ─────────────────────────────────────────────────────────── */

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr, ddof = 1) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof));
}

/** Daily log returns: ln(P_t / P_{t-1}) */
function logReturns(prices) {
  const r = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      r.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return r;
}

/** Cumulative % return from base (index 0) */
function cumulativeReturns(prices) {
  if (!prices.length) return [];
  const base = prices[0];
  return prices.map(p => +((p / base - 1) * 100).toFixed(3));
}

/* ── Per-stock annual metrics ────────────────────────────────────────────── */

/** Annualised volatility (%) = σ_daily × √252 × 100 */
function annualizedVol(prices) {
  const r = logReturns(prices);
  if (r.length < 5) return null;
  return +(std(r) * Math.sqrt(TRADING_DAYS) * 100).toFixed(2);
}

/** Annualised arithmetic return (%) = μ_daily × 252 × 100 */
function annualizedReturn(prices) {
  const r = logReturns(prices);
  if (!r.length) return null;
  return +(mean(r) * TRADING_DAYS * 100).toFixed(2);
}

/** OLS beta vs benchmark (e.g. NIFTY) */
function beta(stockPrices, benchPrices) {
  const sr = logReturns(stockPrices);
  const br = logReturns(benchPrices);
  const n  = Math.min(sr.length, br.length);
  if (n < 10) return null;
  const s = sr.slice(-n), b = br.slice(-n);
  const sm = mean(s), bm = mean(b);
  let cov = 0, bvar = 0;
  for (let i = 0; i < n; i++) { cov += (s[i]-sm)*(b[i]-bm); bvar += (b[i]-bm)**2; }
  return bvar > 0 ? +(cov / bvar).toFixed(3) : 1;
}

/** Jensen's Alpha (annualised %) = R_p - [R_f + β(R_m - R_f)] */
function alpha(stockPrices, benchPrices, rfr = DEFAULT_RFR) {
  const b    = beta(stockPrices, benchPrices);
  if (b === null) return null;
  const rp   = (annualizedReturn(stockPrices) ?? 0) / 100;
  const rm   = (annualizedReturn(benchPrices) ?? 0) / 100;
  return +((rp - (rfr + b * (rm - rfr))) * 100).toFixed(2);
}

/** Maximum drawdown (%) — worst peak-to-trough decline */
function maxDrawdown(prices) {
  let peak = prices[0], maxDD = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return +(maxDD * 100).toFixed(2);
}

/** Drawdown series (%) — useful for plotting the underwater chart */
function drawdownSeries(prices) {
  let peak = prices[0];
  return prices.map(p => { if (p > peak) peak = p; return -((peak - p) / peak * 100); });
}

/** Value at Risk 95% (daily, %) — 5th percentile of daily log returns */
function var95(prices) {
  const r = logReturns(prices).sort((a, b) => a - b);
  if (!r.length) return null;
  const idx = Math.max(0, Math.floor(r.length * 0.05) - 1);
  return +(-r[idx] * 100).toFixed(3);
}

/** Conditional VaR / Expected Shortfall 95% — average of worst 5% days */
function cvar95(prices) {
  const r = logReturns(prices).sort((a, b) => a - b);
  if (!r.length) return null;
  const n    = Math.max(1, Math.floor(r.length * 0.05));
  const tail = r.slice(0, n);
  return +(-mean(tail) * 100).toFixed(3);
}

/** Sharpe ratio (annualised, using log returns) */
function sharpe(prices, rfr = DEFAULT_RFR) {
  const r = logReturns(prices);
  if (r.length < 5) return null;
  const excess = mean(r) * TRADING_DAYS - rfr;
  const vol    = std(r) * Math.sqrt(TRADING_DAYS);
  return vol > 0 ? +(excess / vol).toFixed(3) : null;
}

/** Sortino ratio — uses only downside deviation */
function sortino(prices, rfr = DEFAULT_RFR) {
  const r = logReturns(prices);
  if (r.length < 5) return null;
  const annRet    = mean(r) * TRADING_DAYS;
  const downRets  = r.filter(x => x < 0);
  if (!downRets.length) return null;
  const downDev   = Math.sqrt(downRets.reduce((s, v) => s + v * v, 0) / r.length) * Math.sqrt(TRADING_DAYS);
  return downDev > 0 ? +((annRet - rfr) / downDev).toFixed(3) : null;
}

/** Calmar ratio = Annualised Return / Max Drawdown */
function calmar(prices) {
  const ret = (annualizedReturn(prices) ?? 0) / 100;
  const dd  = maxDrawdown(prices) / 100;
  return dd > 0 ? +(ret / dd).toFixed(3) : null;
}

/* ── Portfolio-level metrics ────────────────────────────────────────────── */

/**
 * Pearson correlation matrix from price arrays.
 * @param {Record<string, number[]>} pricesMap
 */
function correlationMatrix(pricesMap) {
  const syms = Object.keys(pricesMap);
  const rets = {};
  for (const s of syms) rets[s] = logReturns(pricesMap[s]);
  const minLen = Math.min(...syms.map(s => rets[s].length));
  for (const s of syms) rets[s] = rets[s].slice(-minLen);

  const means = {};
  for (const s of syms) means[s] = mean(rets[s]);

  const matrix = {};
  for (const a of syms) {
    matrix[a] = {};
    for (const b of syms) {
      let cov = 0, va = 0, vb = 0;
      for (let i = 0; i < minLen; i++) {
        const da = rets[a][i] - means[a], db = rets[b][i] - means[b];
        cov += da * db; va += da * da; vb += db * db;
      }
      matrix[a][b] = va > 0 && vb > 0 ? +(cov / Math.sqrt(va * vb)).toFixed(3) : (a === b ? 1 : 0);
    }
  }
  return matrix;
}

/**
 * Portfolio daily returns (weighted sum of aligned log returns).
 * @param {Record<string, number[]>} pricesMap aligned price series
 * @param {Record<string, number>}   weights   e.g. { RELIANCE: 0.4, TCS: 0.6 }
 */
function portfolioReturns(pricesMap, weights) {
  const syms = Object.keys(weights);
  const rets = {};
  let minLen = Infinity;
  for (const s of syms) {
    rets[s] = logReturns(pricesMap[s] ?? []);
    minLen  = Math.min(minLen, rets[s].length);
  }
  const portRet = [];
  for (let i = 0; i < minLen; i++) {
    let r = 0;
    for (const s of syms) r += (weights[s] ?? 0) * rets[s][rets[s].length - minLen + i];
    portRet.push(r);
  }
  return portRet;
}

/**
 * True portfolio volatility using full correlation matrix.
 * σ_p = √( wᵀ Σ w )  where Σ is the covariance matrix.
 */
function portfolioVolFromCorr(weights, individualVols, corrMatrix) {
  const syms = Object.keys(weights);
  let variance = 0;
  for (const a of syms) {
    for (const b of syms) {
      const va = (individualVols[a] ?? 20) / 100;
      const vb = (individualVols[b] ?? 20) / 100;
      const r  = corrMatrix?.[a]?.[b] ?? (a === b ? 1 : 0);
      variance += (weights[a] ?? 0) * (weights[b] ?? 0) * va * vb * r;
    }
  }
  return +(Math.sqrt(Math.max(0, variance)) * 100).toFixed(2);
}

/* ── Diversification ratio ───────────────────────────────────────────────── */

/**
 * Diversification ratio = weighted avg individual vol / portfolio vol.
 * > 1 means diversification is reducing risk. Higher = more benefit.
 */
function diversificationRatio(weights, individualVols, corrMatrix) {
  const wtAvgVol  = Object.keys(weights).reduce((s, sym) => s + (weights[sym] ?? 0) * (individualVols[sym] ?? 20), 0);
  const portVol   = portfolioVolFromCorr(weights, individualVols, corrMatrix);
  return portVol > 0 ? +(wtAvgVol / portVol).toFixed(2) : 1;
}

/* ── Export ──────────────────────────────────────────────────────────────── */
const Stats = {
  mean, std, logReturns, cumulativeReturns,
  annualizedVol, annualizedReturn,
  beta, alpha, maxDrawdown, drawdownSeries,
  var95, cvar95, sharpe, sortino, calmar,
  correlationMatrix, portfolioReturns, portfolioVolFromCorr, diversificationRatio,
};

if (typeof module !== 'undefined') module.exports = Stats;
else window.Stats = Stats;
