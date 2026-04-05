'use strict';
/**
 * engine/index.js — Smart Shim
 *
 * Tries the compiled Rust/WASM engine first.
 * Falls back to the plain JS engine transparently on any load error.
 *
 * The WASM engine returns a JSON string; this shim parses it so the
 * caller always receives either an Array<object> or a string message —
 * identical to what the JS engine returns.
 */

let wasmSolve = null;

try {
  const wasm = require('./wasm/quantsolve_engine.js');
  wasmSolve = wasm.solve_equation;          // (equation, constraints_json, max_results) => string
} catch (_) {
  // WASM not available — will fall back to JS
}

const jsEngine = require('./engine.js');

/**
 * Solve an equation string with optional constraints.
 *
 * @param {string}  equation        e.g. "10x + 20y = 100"
 * @param {object}  constraintsRaw  e.g. { x: { min:5 }, y: { max:3 } }
 * @param {object}  options         e.g. { maxResults: 500 }
 * @returns {Array<Record<string,number>> | string}
 */
function solveEquation(equation, constraintsRaw, options) {
  const maxResults = options?.maxResults ?? 500;

  if (wasmSolve) {
    try {
      const constraintsJson = JSON.stringify(constraintsRaw ?? {});
      const result = wasmSolve(equation, constraintsJson, maxResults);

      // WASM returns a JSON-encoded array or a plain error string
      if (result.startsWith('[')) {
        return JSON.parse(result);
      }
      return result;   // string message (error / no-solutions / etc.)
    } catch (err) {
      // WASM error → fall through to JS fallback
      console.warn('[engine] WASM solve failed, falling back to JS engine:', err.message);
    }
  }

  return jsEngine.solveEquation(equation, constraintsRaw, { maxResults });
}

module.exports = { solveEquation };
