'use strict';
/**
 * engine/risk-analyzer.js
 * Works in both browser (<script> tag) and Node.js (require).
 *
 * Core logic: given an allocation (shares per stock), live prices,
 * and risk metadata, compute portfolio risk/return metrics.
 */

/* ── Risk calculation ─────────────────────────────────────────────────────── */

const DEFAULTS = { beta: 1.0, annualVol: 20, expectedReturn: 12, sector: 'Other' };

/**
 * Analyse one allocation.
 * @param {Record<string,number>} allocation  - { RELIANCE: 5, TCS: 2 }
 * @param {Record<string,number>} prices      - { RELIANCE: 2948, TCS: 3812 }
 * @param {Record<string,object>} riskMeta    - from /market/risk endpoint
 * @returns {object|null}
 */
function analyzeAllocation(allocation, prices, riskMeta) {
  const symbols = Object.keys(allocation).filter(s => (allocation[s] ?? 0) > 0);
  if (!symbols.length) return null;

  /* Invested amounts & weights */
  const invested = {};
  let total = 0;
  for (const sym of symbols) {
    invested[sym] = (allocation[sym] ?? 0) * (prices[sym] ?? 0);
    total += invested[sym];
  }
  if (total <= 0) return null;

  const weights = {};
  for (const sym of symbols) weights[sym] = invested[sym] / total;

  /* Weighted portfolio metrics */
  let beta = 0, vol = 0, ret = 0;
  const sectorW = {};
  for (const sym of symbols) {
    const m = (riskMeta && riskMeta[sym]) ? riskMeta[sym] : DEFAULTS;
    const w = weights[sym];
    beta += w * (m.beta           ?? DEFAULTS.beta);
    vol  += w * (m.annualVol      ?? DEFAULTS.annualVol);
    ret  += w * (m.expectedReturn ?? DEFAULTS.expectedReturn);
    const sec = m.sector ?? DEFAULTS.sector;
    sectorW[sec] = (sectorW[sec] ?? 0) + w;
  }

  /* Concentration (Herfindahl–Hirschman Index) */
  const n   = symbols.length;
  const hhi = Object.values(weights).reduce((s, w) => s + w * w, 0);
  const minHHI   = 1 / n;
  const concNorm = n > 1 ? Math.min(100, ((hhi - minHHI) / (1 - minHHI)) * 100) : 100;

  /* Risk score 0–100 */
  const betaNorm = Math.min(100, (beta / 2) * 100);
  const volNorm  = Math.min(100, (vol  / 40) * 100);
  const riskScore = Math.round(0.35 * betaNorm + 0.40 * volNorm + 0.25 * concNorm);
  const riskLevel = riskScore < 35 ? 'low' : riskScore < 65 ? 'medium' : 'high';

  /* Sharpe proxy (no risk-free rate): return ÷ volatility */
  const sharpeProxy = vol > 0 ? +(ret / vol).toFixed(2) : 0;

  /* Alerts */
  const alerts = [];
  if (beta > 1.3)
    alerts.push({ type:'high',   msg:`High market sensitivity (β=${beta.toFixed(2)}) — big moves with the market` });
  if (vol > 25)
    alerts.push({ type:'high',   msg:`High volatility ~${vol.toFixed(0)}%/yr — expect large price swings` });
  if (hhi > 0.5)
    alerts.push({ type:'medium', msg:`Concentrated — top stock is ${(Math.max(...Object.values(weights))*100).toFixed(0)}% of portfolio` });
  if (n < 3)
    alerts.push({ type:'medium', msg:'Low diversification — fewer than 3 stocks selected' });
  const domSec = Object.entries(sectorW).sort((a,b) => b[1]-a[1])[0];
  if (domSec && domSec[1] > 0.55)
    alerts.push({ type:'medium', msg:`${(domSec[1]*100).toFixed(0)}% in ${domSec[0]} sector — sector concentration risk` });
  if (ret < 8)
    alerts.push({ type:'info',   msg:`Low expected return (${ret.toFixed(1)}%) — may lag inflation` });
  if (n === 1)
    alerts.push({ type:'high',   msg:'Single-stock portfolio — maximum concentration risk' });

  return {
    riskScore, riskLevel,
    portfolioBeta:  +beta.toFixed(2),
    volatility:     +vol.toFixed(1),
    expectedReturn: +ret.toFixed(1),
    concentration:  +hhi.toFixed(3),
    concentrationPct: Math.round(concNorm),
    sharpeProxy,
    totalInvested: Math.round(total),
    weights, sectorWeights: sectorW,
    alerts, symbols, invested,
  };
}

/** Analyse many allocations → sorted by Sharpe (best first). */
function analyzeMultiple(allocations, prices, riskMeta) {
  return allocations
    .map(a => { const r = analyzeAllocation(a, prices, riskMeta); return r ? { ...r, allocation: a } : null; })
    .filter(Boolean)
    .sort((a, b) => b.sharpeProxy - a.sharpeProxy);
}

/* ── Display helpers ──────────────────────────────────────────────────────── */
function riskColor(level)  { return level==='low'?'#16A34A':level==='medium'?'#D97706':'#DC2626'; }
function riskBg(level)     { return level==='low'?'#F0FDF4':level==='medium'?'#FFFBEB':'#FEF2F2'; }
function riskBorder(level) { return level==='low'?'#BBF7D0':level==='medium'?'#FDE68A':'#FECACA'; }
function riskEmoji(level)  { return level==='low'?'🟢':level==='medium'?'🟡':'🔴'; }
function riskLabel(level)  { return level==='low'?'Low Risk':level==='medium'?'Medium Risk':'High Risk'; }

/* ── Export (works in browser & Node) ───────────────────────────────────────*/
const RiskAnalyzer = { analyzeAllocation, analyzeMultiple, riskColor, riskBg, riskBorder, riskEmoji, riskLabel };
if (typeof module !== 'undefined') module.exports = RiskAnalyzer;
else window.RiskAnalyzer = RiskAnalyzer;
