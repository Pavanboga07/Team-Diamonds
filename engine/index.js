'use strict';
/**
 * engine/index.js — Smart Shim
 *
 * Tries the compiled Rust/WASM engine first.
 * Falls back to the plain JS engine transparently on any load error.
 *
 * Exposes:
 *   - solveEquation(equation, constraints, options)  → single equation
 *   - solveSystem(equations[], constraints, options) → system of equations
 */

let wasmSolve = null;

try {
  const wasm = require('./wasm/quantsolve_engine.js');
  wasmSolve = wasm.solve_equation;
} catch (_) {
  // WASM not available — will fall back to JS
}

const jsEngine = require('./engine.js');

/**
 * Solve a single equation string.
 * @param {string}  equation
 * @param {object}  constraintsRaw
 * @param {object}  options   e.g. { maxResults, mode: 'financial' }
 * @returns {Array<Record<string,number>> | string}
 */
function solveEquation(equation, constraintsRaw, options) {
  const maxResults = options?.maxResults ?? 500;

  if (wasmSolve) {
    try {
      const constraintsJson = JSON.stringify(constraintsRaw ?? {});
      const result = wasmSolve(equation, constraintsJson, maxResults);
      if (result.startsWith('[')) return JSON.parse(result);
      return result;
    } catch (err) {
      console.warn('[engine] WASM solve failed, falling back to JS engine:', err.message);
    }
  }

  return jsEngine.solveEquation(equation, constraintsRaw, { maxResults, ...options });
}

/**
 * Solve a system of equations.
 * @param {string[]} equations
 * @param {object}   constraintsRaw
 * @param {object}   options
 * @returns {Array<Record<string,number>> | string}
 */
function solveSystem(equations, constraintsRaw, options) {
  return jsEngine.solveSystem(equations, constraintsRaw, options);
}

module.exports = { solveEquation, solveSystem };
