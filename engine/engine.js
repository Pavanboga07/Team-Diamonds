'use strict';
/**
 * Engine Facade — Universal Equation Solver
 *
 * Handles:
 *  1. Linear equations              : 50x = 200, 10x + 20y = 100
 *  2. Multi-variable linear         : 10a+15b+20c = 1000  (non-neg integers)
 *  3. Quadratic equations           : x^2 - 5x + 6 = 0
 *  4. Higher-degree polynomial      : x^3 - 6x^2 + 11x - 6 = 0
 *  5. Systems of equations          : [x + y = 10, 2x - y = 5]
 *  6. BODMAS brackets               : (10x+20y)*2 + 5z = 500
 *  7. Mixed linear + non-linear     : 150x + 200y + 50z + (x^2+y^2)/2 = 10000
 *     → bounded integer backtracking with AST evaluator
 *
 * Routing rules (single equation):
 *  allVars = 0         → trivial check
 *  allVars = 1, non-linear  → polynomial solver (Durand-Kerner / quadratic formula)
 *  allVars = 1, linear      → direct solve or integer backtracker
 *  allVars > 1, non-linear  → nonlinear integer solver (bounded backtracking + evaluation)
 *  allVars > 1, linear      → integer backtracker (financial) or runIntegerSolver
 */

const { tokenizeEquation }         = require('./tokenizer');
const { parseEquation }            = require('./parser');
const { normalizeEquation }        = require('./normalizer');
const { solveNormalized }          = require('./solver');
const { normalizeConstraints }     = require('./constraints');
const {
  collectVars,
  solveUnivariatePolynomial,
  astToUnivariatePoly,
  isNonLinear,
  isNonlinearAST,
  polyDegree,
  equationToPoly,
  formatNum,
  round,
}                                   = require('./polynomial');
const { solveSystem }              = require('./system-solver');
const { solveNonlinear }           = require('./nonlinear-solver');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a;
}

function isFinancialMode(options) {
  return options && (options.mode === 'financial' || options.mode === 'complex');
}

function isComplexMode(options) {
  return options && options.mode === 'complex';
}

// ─── Single-equation solver ───────────────────────────────────────────────────

/**
 * Solve a single equation string.
 *
 * @param {string}  equation       e.g. "150x + 200y + 50z + (x^2+y^2)/2 = 10000"
 * @param {object}  constraintsRaw e.g. { x: { min:0, max:50 } }
 * @param {object}  options        e.g. { maxResults: 200, mode: 'financial' }
 * @returns {Array<Record<string,number>> | string}
 */
function solveEquation(equation, constraintsRaw, options) {
  const maxResults    = options?.maxResults ?? 500;
  const financialMode = isFinancialMode(options);
  const complexMode   = isComplexMode(options);

  try {
    if (typeof equation !== 'string' || !equation.trim()) {
      return 'Equation is required.';
    }

    const constraints = normalizeConstraints(constraintsRaw);

    // ── Parse ─────────────────────────────────────────────────────────────
    const tokens      = tokenizeEquation(equation);
    const parsed      = parseEquation(tokens);
    const equationAst = parsed.equation;

    // ── Detect variables ──────────────────────────────────────────────────
    const allVars = [...collectVars(equationAst)].sort();

    // ── COMPLEX MODE: force nonlinear integer backtracker ─────────────────
    // Skips all auto-routing and sends directly to the bounded search engine.
    // Wider default bounds (0–100) are applied for each variable unless the
    // user has provided explicit constraints.
    if (complexMode) {
      const complexConstraints = { ...constraints };
      for (const v of allVars) {
        if (!complexConstraints[v]) {
          complexConstraints[v] = { min: 0, max: 50 }; // default search range
        }
      }
      const result = solveNonlinear(equationAst, allVars, complexConstraints, { maxResults });
      if (!result.ok)                    return `Error: ${result.message}`;
      if (result.type === 'infinite')    return result.message;
      if (result.type === 'none')        return result.message || 'No valid solution exists';
      return result.solutions;
    }


    // ── Trivial: no variables ─────────────────────────────────────────────
    if (allVars.length === 0) {
      try {
        const norm = normalizeEquation(equationAst);
        if (isEmpty(norm.coefficients)) {
          return norm.constant === 0
            ? 'Infinite solutions exist'
            : 'No valid solution exists';
        }
      } catch {
        // Might happen if even the constant equation has odd forms — ignore
      }
      return 'No variables found in equation.';
    }

    // ── Single-variable ───────────────────────────────────────────────────
    if (allVars.length === 1) {
      const varName = allVars[0];
      const poly    = equationToPoly(equationAst, varName);

      if (poly && isNonLinear(poly)) {
        // Non-linear single-variable → polynomial solver
        const result = solveUnivariatePolynomial(equationAst, varName, {
          integerOnly:     financialMode,
          nonNegativeOnly: financialMode,
        });
        return formatPolyResult(result);
      }

      // Linear single-variable
      const norm = normalizeEquation(equationAst);
      if (isEmpty(norm.coefficients)) {
        return norm.constant === 0 ? 'Infinite solutions exist' : 'No valid solution exists';
      }

      let normalized = norm;
      if (normalized.constant < 0) {
        const flipped = {};
        for (const [v, a] of Object.entries(normalized.coefficients)) flipped[v] = -a;
        normalized = { coefficients: flipped, constant: -normalized.constant };
      }

      if (financialMode) {
        return runIntegerSolver(normalized, constraints, maxResults);
      }

      // Direct linear: a*x = c → x = c/a
      const [v] = Object.keys(normalized.coefficients);
      const a   = normalized.coefficients[v];
      return [{ [v]: round(normalized.constant / a, 8) }];
    }

    // ── Multi-variable ────────────────────────────────────────────────────

    // Detect if the equation has any non-linear terms (x^2, x*y, etc.)
    const hasNonLinear = isNonlinearAST(equationAst.left)
                      || isNonlinearAST(equationAst.right);

    if (hasNonLinear) {
      // ── Non-linear multi-variable → bounded integer backtracker ─────────
      // We always return non-negative integers here because the real-solution
      // set is infinite (a surface in n-dimensional space).
      const result = solveNonlinear(equationAst, allVars, constraints, { maxResults });

      if (!result.ok)                    return `Error: ${result.message}`;
      if (result.type === 'infinite')    return result.message;
      if (result.type === 'none')        return result.message || 'No valid solution exists';
      return result.solutions;           // Array<{x, y, z, ...}>
    }

    // ── Linear multi-variable ─────────────────────────────────────────────
    let normalized;
    try {
      normalized = normalizeEquation(equationAst);
    } catch (e) {
      // normalizer rejects equations like (-x = -5) sometimes; try nonlinear fallback
      const result = solveNonlinear(equationAst, allVars, constraints, { maxResults });
      if (!result.ok)                    return `Error: ${result.message}`;
      if (result.type === 'infinite')    return result.message;
      if (result.type === 'none')        return result.message || 'No valid solution exists';
      return result.solutions;
    }

    if (normalized && !isEmpty(normalized.coefficients)) {
      return runIntegerSolver(normalized, constraints, maxResults);
    }

    return 'Unsupported equation type.';

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error: ${msg}`;
  }
}

// ─── System of equations solver ───────────────────────────────────────────────

/**
 * Solve a system of linear equations (array of equation strings).
 * Non-linear systems are not supported — users should solve them individually.
 *
 * @param {string[]} equations
 * @param {object}   constraintsRaw
 * @param {object}   options
 * @returns {Array<Record<string,number>> | string}
 */
function solveSystem_equations(equations, constraintsRaw, options) {
  const financialMode = isFinancialMode(options);

  try {
    if (!Array.isArray(equations) || equations.length === 0) {
      return 'At least one equation is required.';
    }
    for (const eq of equations) {
      if (typeof eq !== 'string' || !eq.trim())
        return 'All equations must be non-empty strings.';
    }

    // Parse + normalise each equation
    const normalizedEqs = [];
    for (const eq of equations) {
      const tokens = tokenizeEquation(eq);
      const parsed = parseEquation(tokens);
      const norm   = normalizeEquation(parsed.equation);
      normalizedEqs.push(norm);
    }

    // Collect all variables
    const varSet = new Set();
    for (const ne of normalizedEqs) {
      for (const v of Object.keys(ne.coefficients)) varSet.add(v);
    }
    const varList = [...varSet].sort();

    // Reject non-linear systems
    for (const eq of equations) {
      const tokens = tokenizeEquation(eq);
      const parsed = parseEquation(tokens);
      for (const v of varList) {
        const poly = equationToPoly(parsed.equation, v);
        if (poly && isNonLinear(poly)) {
          return 'Non-linear systems are not supported. Solve each equation individually.';
        }
      }
    }

    const opts   = { integerOnly: financialMode, nonNegativeOnly: financialMode };
    const result = solveSystem(normalizedEqs, opts);

    if (!result.ok)                 return `Error: ${result.message}`;
    if (result.type === 'infinite') return 'Infinite solutions exist';
    if (result.type === 'none')     return result.message || 'No valid solution exists';
    return result.solutions;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error: ${msg}`;
  }
}

// ─── Integer backtracking wrapper (linear equations only) ─────────────────────

function runIntegerSolver(normalized, constraints, maxResults) {
  let norm = normalized;

  // Flip signs if constant is negative
  if (norm.constant < 0) {
    const flipped = {};
    for (const [v, a] of Object.entries(norm.coefficients)) flipped[v] = -a;
    norm = { coefficients: flipped, constant: -norm.constant };
  }

  // GCD divisibility quick-reject
  const coeffVals = Object.values(norm.coefficients);
  const g = coeffVals.reduce((a, b) => gcd(Math.abs(a), Math.abs(b)), 0);
  if (g > 0 && norm.constant % g !== 0) {
    return `No whole-number solutions exist. ` +
      `(${norm.constant} is not divisible by the GCD of coefficients, ${g}.)`;
  }

  // Guard: negative coefficients unsupported by backtracker
  const negVars = Object.entries(norm.coefficients)
    .filter(([, a]) => a < 0)
    .map(([v]) => v);
  if (negVars.length > 0) {
    return `Unsupported: variables ${negVars.join(', ')} have a net negative coefficient. ` +
      `Try rewriting so all variable terms are on the left side with positive coefficients.`;
  }

  const solutions = solveNormalized(norm, constraints, { maxResults });
  if (solutions.length === 0) return 'No whole-number solutions exist.';
  return solutions.slice(0, maxResults);
}

// ─── Polynomial result formatter ──────────────────────────────────────────────

function formatPolyResult(result) {
  if (!result.ok)                                      return `Error: ${result.message}`;
  if (result.type === 'infinite')                      return result.message;
  if (result.type === 'none' || result.type === 'no_real') return result.message;
  if (!result.rawValues || result.rawValues.length === 0)  return 'No valid solution exists';
  return result.rawValues; // [{ x: 2 }, { x: 3 }]
}

module.exports = { solveEquation, solveSystem: solveSystem_equations };
