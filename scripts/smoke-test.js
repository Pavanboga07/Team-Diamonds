'use strict';
/**
 * scripts/smoke-test.js
 * Quick smoke test: runs both the JS and WASM engines on canonical examples
 * and checks output parity.
 */

const jsEngine   = require('../engine/engine');
const { solveEquation: shim } = require('../engine/index');

const CASES = [
  { eq: '50x = 200',              constraints: {},              expect: 'array', desc: '1-var simple' },
  { eq: '10x + 20y = 100',        constraints: {},              expect: 'array', desc: '2-var all combos' },
  { eq: '2x + 4y = 3',            constraints: {},              expect: 'string', desc: 'no int solutions (GCD)' },
  { eq: '10a+15b+20c = 300',      constraints: {},              expect: 'array', desc: '3-var' },
  { eq: '10x + 20y = 100',        constraints: { x: { min: 3, max: 5 } }, expect: 'array', desc: '2-var with constraints' },
  { eq: '(10x+20y)*2 + 5z = 500', constraints: {},              expect: 'array', desc: 'BODMAS' },
  { eq: '5 = 3',                  constraints: {},              expect: 'string', desc: 'contradiction' },
];

let pass = 0, fail = 0;

for (const c of CASES) {
  const jsResult   = jsEngine.solveEquation(c.eq, c.constraints, { maxResults: 500 });
  const wasmResult = shim(c.eq, c.constraints, { maxResults: 500 });

  const jsType   = Array.isArray(jsResult)   ? 'array' : 'string';
  const wasmType = Array.isArray(wasmResult) ? 'array' : 'string';

  const jsCount   = Array.isArray(jsResult)   ? jsResult.length   : '-';
  const wasmCount = Array.isArray(wasmResult) ? wasmResult.length : '-';

  const typesMatch   = jsType   === wasmType;
  const countsMatch  = jsCount  === wasmCount;
  const expectMatch  = jsType   === c.expect;
  const ok = typesMatch && countsMatch && expectMatch;

  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${c.desc}]`);
  console.log(`    JS  : type=${jsType}, count=${jsCount}`);
  console.log(`    WASM: type=${wasmType}, count=${wasmCount}`);
  if (!ok) {
    console.log(`    JS result : ${JSON.stringify(jsResult).slice(0, 120)}`);
    console.log(`    WASM result: ${JSON.stringify(wasmResult).slice(0, 120)}`);
    fail++;
  } else {
    pass++;
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
