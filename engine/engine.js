'use strict';
/**
 * Engine Facade — solves equations with full example support:
 *
 *  Example 1: 50x = 200             → [x=4]
 *  Example 2: 10x + 20y = 100       → all non-negative integer pairs
 *  Example 3: 10a+15b+20c+50d+5e=1000 → all 5-way combos
 *  Example 4: with UI constraints (x≥5, y≤3)
 *  Example 5: (10x+20y)*2 + 5z = 500  → BODMAS respected by parser
 *  Example 6: 2x + 4y = 3           → "No whole-number solutions exist."
 */

const { tokenizeEquation }    = require('./tokenizer');
const { parseEquation }       = require('./parser');
const { normalizeEquation }   = require('./normalizer');
const { solveNormalized }     = require('./solver');
const { normalizeConstraints } = require('./constraints');

function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

/**
 * Solve an equation string with optional constraints.
 *
 * @param {string}  equation       e.g. "10x + 20y = 100"
 * @param {object}  constraintsRaw e.g. { x: { min:5 }, y: { max:3 } }
 * @param {object}  options        e.g. { maxResults: 500 }
 * @returns {Array<Record<string,number>> | string}
 */
function solveEquation(equation, constraintsRaw, options) {
  const maxResults = options?.maxResults ?? 500;

  try {
    if (typeof equation !== 'string' || !equation.trim()) {
      return 'Equation is required.';
    }

    const constraints = normalizeConstraints(constraintsRaw);

    // ── Parse & normalize ──────────────────────────────────────
    const tokens    = tokenizeEquation(equation);
    const parsed    = parseEquation(tokens);
    let   normalized = normalizeEquation(parsed.equation);

    // ── Trivial: no variables ──────────────────────────────────
    if (isEmpty(normalized.coefficients)) {
      return normalized.constant === 0
        ? 'Infinite solutions: the equation is always true (both sides are equal).'
        : 'No solutions: the equation is a contradiction (e.g. 5 = 3).';
    }

    // ── Flip signs if constant is negative ────────────────────
    // Example: -10x = -200 → 10x = 200 (valid after flip)
    if (normalized.constant < 0) {
      const flipped = {};
      for (const [v, a] of Object.entries(normalized.coefficients)) {
        flipped[v] = -a;
      }
      normalized = { coefficients: flipped, constant: -normalized.constant };
    }

    // ── Detect impossible case: non-divisible constant ─────────
    // Quick GCD check: if GCD of all coefficients doesn't divide constant
    // → no integer solutions possible at all.
    const coeffVals = Object.values(normalized.coefficients);
    const g = coeffVals.reduce((a, b) => gcd(Math.abs(a), Math.abs(b)), 0);
    if (g > 0 && normalized.constant % g !== 0) {
      return `No whole-number solutions exist. (The right-hand side ${normalized.constant} is not divisible by ${g}, the GCD of all coefficients.)`;
    }

    // ── Guard: negative coefficients ──────────────────────────
    // After the constant flip, any remaining negative coefficient means a
    // variable appears on both sides with net negative direction.
    // The backtracking solver handles positive coefficients only.
    const negVars = Object.entries(normalized.coefficients)
      .filter(([, a]) => a < 0)
      .map(([v]) => v);

    if (negVars.length > 0) {
      return `Unsupported: variables ${negVars.join(', ')} have a net negative coefficient after simplification. ` +
        `Try rewriting so all variable terms are on the left side with positive coefficients.`;
    }

    // ── Solve ──────────────────────────────────────────────────
    const solutions = solveNormalized(normalized, constraints, { maxResults });

    if (solutions.length === 0) {
      return 'No whole-number solutions exist.';
    }

    return solutions.slice(0, maxResults);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error: ${msg}`;
  }
}

function gcd(a, b) {
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a;
}

module.exports = { solveEquation };
