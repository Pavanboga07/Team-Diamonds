'use strict';
/**
 * scripts/bench.js
 * Compare JS vs WASM engine performance on increasingly complex equations.
 */

const jsEngine = require('../engine/engine');
const { solveEquation: shimSolve } = require('../engine/index');

function bench(label, fn, iters = 5) {
  // warm up
  fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6 / iters;
  console.log(`  ${label.padEnd(8)}: ${elapsed.toFixed(2)} ms/call`);
  return elapsed;
}

const cases = [
  { label: '2-var',  eq: '10x + 20y = 1000', opts: { maxResults: 500 } },
  { label: '3-var',  eq: '10a + 15b + 20c = 1000', opts: { maxResults: 500 } },
  { label: '4-var',  eq: '5a + 10b + 15c + 20d = 1000', opts: { maxResults: 500 } },
  { label: '5-var',  eq: '5a + 8b + 10c + 15d + 20e = 500', opts: { maxResults: 500 } },
];

console.log('\n=== QuantSolve Engine Benchmark ===\n');

for (const c of cases) {
  console.log(`Equation: ${c.eq}`);
  const jsMs   = bench('JS',   () => jsEngine.solveEquation(c.eq, {}, c.opts));
  const wasmMs = bench('WASM', () => shimSolve(c.eq, {}, c.opts));
  const speedup = jsMs / wasmMs;
  console.log(`  Speedup : ${speedup.toFixed(1)}×\n`);
}
