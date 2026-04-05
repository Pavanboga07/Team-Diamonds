'use strict';
/**
 * Polynomial Engine
 *
 * Handles:
 *  - Single-variable polynomial equations (any degree)
 *    - Quadratic: exact formula
 *    - Higher-degree: Durand-Kerner numerical root finding
 *  - Multi-variable polynomial expressions (evaluate / classify)
 *
 * AST node types expected:
 *   NumberLiteral, Variable, UnaryExpression(u-), BinaryExpression(+,-,*,/,^)
 */

// ─── Polynomial representation ────────────────────────────────────────────────
//
// A polynomial in one variable x is represented as a dense coefficient array:
//   [a0, a1, a2, ...] where value = a0 + a1*x + a2*x^2 + ...
//
// For multi-variable detection we use a symbolic form: Map<monomial_key, coeff>
// where monomial_key is e.g. "x^2*y" (sorted variable names).

/**
 * Convert AST to a single-variable polynomial array.
 * Returns null if the AST cannot be reduced to a polynomial in `varName`.
 * @param {object} node  AST node
 * @param {string} varName  the variable (e.g. 'x')
 * @returns {number[] | null}  coefficients array [a0, a1, ...]
 */
function astToUnivariatePoly(node, varName) {
  if (!node) return null;

  if (node.type === 'NumberLiteral') {
    return [node.value]; // constant polynomial
  }

  if (node.type === 'Variable') {
    if (node.name === varName) return [0, 1];  // x
    return null; // different variable — not univariate
  }

  if (node.type === 'UnaryExpression' && node.op === 'u-') {
    const inner = astToUnivariatePoly(node.arg, varName);
    if (!inner) return null;
    return inner.map(c => -c);
  }

  if (node.type === 'BinaryExpression') {
    const { op, left, right } = node;

    if (op === '+' || op === '-') {
      const L = astToUnivariatePoly(left, varName);
      const R = astToUnivariatePoly(right, varName);
      if (!L || !R) return null;
      return polyAddSub(L, R, op === '-');
    }

    if (op === '*') {
      const L = astToUnivariatePoly(left, varName);
      const R = astToUnivariatePoly(right, varName);
      if (!L || !R) return null;
      return polyMul(L, R);
    }

    if (op === '/') {
      // Only allow division by a constant
      const L = astToUnivariatePoly(left, varName);
      const R = astToUnivariatePoly(right, varName);
      if (!L || !R) return null;
      if (R.length !== 1 || R[0] === 0) return null; // division by non-constant
      return L.map(c => c / R[0]);
    }

    if (op === '^') {
      const base = astToUnivariatePoly(left, varName);
      // Exponent must be a non-negative integer constant
      if (!base) return null;
      if (right.type !== 'NumberLiteral') return null;
      const exp = right.value;
      if (!Number.isInteger(exp) || exp < 0 || exp > 20) return null;
      let result = [1];
      for (let i = 0; i < exp; i++) result = polyMul(result, base);
      return result;
    }
  }

  return null;
}

function polyAddSub(A, B, subtract) {
  const len = Math.max(A.length, B.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    const a = A[i] ?? 0;
    const b = B[i] ?? 0;
    out.push(subtract ? a - b : a + b);
  }
  return out;
}

function polyMul(A, B) {
  const out = new Array(A.length + B.length - 1).fill(0);
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      out[i + j] += A[i] * B[j];
    }
  }
  return out;
}

/**
 * Get the degree of a polynomial (index of the leading non-zero term).
 * @param {number[]} poly
 */
function polyDegree(poly) {
  for (let i = poly.length - 1; i >= 0; i--) {
    if (Math.abs(poly[i]) > 1e-12) return i;
  }
  return 0;
}

/**
 * Evaluate a polynomial at a real value x.
 * @param {number[]} poly
 * @param {number} x
 */
function polyEval(poly, x) {
  let result = 0;
  for (let i = poly.length - 1; i >= 0; i--) {
    result = result * x + poly[i];
  }
  return result;
}

// ─── Equation normalisation ───────────────────────────────────────────────────

/**
 * Given ast { left, right }, subtract right poly from left poly to get
 * a 0-form polynomial: p(x) = 0.
 */
function equationToPoly(equationAst, varName) {
  const L = astToUnivariatePoly(equationAst.left, varName);
  const R = astToUnivariatePoly(equationAst.right, varName);
  if (!L || !R) return null;
  return polyAddSub(L, R, true); // L - R
}

// ─── Quadratic solver ─────────────────────────────────────────────────────────

/**
 * Solve a^2*x^2 + a1*x + a0 = 0 exactly.
 * @param {number} a2 @param {number} a1 @param {number} a0
 * @returns {{ solutions: number[], type: string }}
 */
function solveQuadratic(a2, a1, a0) {
  if (Math.abs(a2) < 1e-12) {
    // Degenerate — linear
    if (Math.abs(a1) < 1e-12) {
      return Math.abs(a0) < 1e-9
        ? { solutions: [], type: 'infinite' }
        : { solutions: [], type: 'none' };
    }
    return { solutions: [-a0 / a1], type: 'linear' };
  }
  const disc = a1 * a1 - 4 * a2 * a0;
  if (disc < 0) return { solutions: [], type: 'no_real' };
  if (Math.abs(disc) < 1e-12) return { solutions: [-a1 / (2 * a2)], type: 'one' };
  const sq = Math.sqrt(disc);
  return {
    solutions: [(-a1 + sq) / (2 * a2), (-a1 - sq) / (2 * a2)].sort((a, b) => a - b),
    type: 'two',
  };
}

// ─── Durand-Kerner root finder ────────────────────────────────────────────────

/**
 * Find all roots of a polynomial using the Durand-Kerner (Weierstrass) method.
 * Works for any degree ≥ 1.
 * @param {number[]} poly   normalised polynomial coefficients [a0, a1, ...]
 * @returns {{ re: number, im: number }[]} complex roots
 */
function durandKerner(poly) {
  const deg = polyDegree(poly);
  if (deg === 0) return [];

  // Make monic: divide by leading coefficient
  const lead = poly[deg];
  const p = poly.slice(0, deg + 1).map(c => c / lead);

  // Evaluate monic polynomial
  function evalP(x_re, x_im) {
    let re = 0, im = 0;
    // Horner's method for complex
    for (let i = deg; i >= 0; i--) {
      // (re + i*im) * (x_re + i*x_im) + p[i]
      const new_re = re * x_re - im * x_im + p[i];
      const new_im = re * x_im + im * x_re;
      re = new_re; im = new_im;
    }
    return { re, im };
  }

  // Initial guesses: spread on a circle
  const r0 = 1 + Math.max(...poly.slice(0, deg).map(c => Math.abs(c / lead)));
  const roots = [];
  for (let k = 0; k < deg; k++) {
    const angle = (2 * Math.PI * k) / deg + 0.1;  // offset to avoid symmetry issues
    roots.push({ re: r0 * Math.cos(angle), im: r0 * Math.sin(angle) });
  }

  const MAX_ITER = 200;
  const TOL = 1e-12;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < deg; i++) {
      const { re: num_re, im: num_im } = evalP(roots[i].re, roots[i].im);

      // Denominator = product of (roots[i] - roots[j]) for j != i
      let denom_re = 1, denom_im = 0;
      for (let j = 0; j < deg; j++) {
        if (j === i) continue;
        const diff_re = roots[i].re - roots[j].re;
        const diff_im = roots[i].im - roots[j].im;
        const new_re = denom_re * diff_re - denom_im * diff_im;
        const new_im = denom_re * diff_im + denom_im * diff_re;
        denom_re = new_re; denom_im = new_im;
      }

      // delta = num / denom
      const mag2 = denom_re * denom_re + denom_im * denom_im;
      if (mag2 < 1e-30) continue;
      const delta_re = (num_re * denom_re + num_im * denom_im) / mag2;
      const delta_im = (num_im * denom_re - num_re * denom_im) / mag2;

      roots[i].re -= delta_re;
      roots[i].im -= delta_im;

      maxDelta = Math.max(maxDelta, Math.sqrt(delta_re ** 2 + delta_im ** 2));
    }
    if (maxDelta < TOL) break;
  }

  return roots;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const SIG_DIGITS = 10; // rounding precision

function round(x, digits) {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function formatNum(x) {
  // Show as integer if very close
  const r = round(x, 8);
  if (Number.isInteger(r)) return String(r);
  return r.toPrecision(6).replace(/\.?0+$/, '');
}

/**
 * Detect all variables in an AST.
 * @param {object} node
 * @param {Set<string>} acc
 */
function collectVars(node, acc = new Set()) {
  if (!node) return acc;
  if (node.type === 'Variable') { acc.add(node.name); return acc; }
  if (node.left)  collectVars(node.left, acc);
  if (node.right) collectVars(node.right, acc);
  if (node.arg)   collectVars(node.arg, acc);
  return acc;
}

/**
 * Check whether a polynomial has any degree > 1 terms.
 * @param {number[]} poly
 */
function isNonLinear(poly) {
  return polyDegree(poly) > 1;
}

/**
 * Check whether an AST node contains any Variable node.
 * @param {object} node
 * @returns {boolean}
 */
function containsVariable(node) {
  if (!node) return false;
  if (node.type === 'Variable') return true;
  return containsVariable(node.left)
      || containsVariable(node.right)
      || containsVariable(node.arg);
}

/**
 * Return true if the AST contains any non-linear term:
 *   - variable raised to a power (x^2, x^3, …)
 *   - variable multiplied by another variable (x*y)
 *
 * @param {object} node  AST node
 * @returns {boolean}
 */
function isNonlinearAST(node) {
  if (!node) return false;
  if (node.type === 'BinaryExpression') {
    if (node.op === '^' && containsVariable(node.left)) return true;
    if (node.op === '*'
        && containsVariable(node.left)
        && containsVariable(node.right)) return true;
    return isNonlinearAST(node.left) || isNonlinearAST(node.right);
  }
  if (node.type === 'UnaryExpression') return isNonlinearAST(node.arg);
  return false;
}

/**
 * Solve a univariate polynomial equation AST { left, right }.
 * Returns a structured result object.
 *
 * @param {{ left: object, right: object, type: string }} equationAst
 * @param {string} varName
 * @param {{ integerOnly?: boolean, nonNegativeOnly?: boolean }} opts
 * @returns {{ ok: boolean, type: string, solutions?: string[], message?: string }}
 */
function solveUnivariatePolynomial(equationAst, varName, opts = {}) {
  const poly = equationToPoly(equationAst, varName);
  if (!poly) {
    return { ok: false, message: `Cannot reduce equation to a polynomial in ${varName}.` };
  }

  const deg = polyDegree(poly);

  // Trivial: 0 = 0 or c = 0 (no variable)
  if (deg === 0) {
    if (Math.abs(poly[0]) < 1e-9) {
      return { ok: true, type: 'infinite', message: 'Infinite solutions exist' };
    }
    return { ok: true, type: 'none', message: 'No valid solution exists' };
  }

  // Linear
  if (deg === 1) {
    const x = -poly[0] / poly[1];
    return applyOpts([x], varName, opts, 'linear');
  }

  // Quadratic
  if (deg === 2) {
    const { solutions, type: qtype } = solveQuadratic(poly[2], poly[1], poly[0]);
    if (qtype === 'no_real') {
      return { ok: true, type: 'no_real', message: 'No real solutions exist (discriminant < 0)' };
    }
    if (qtype === 'infinite') {
      return { ok: true, type: 'infinite', message: 'Infinite solutions exist' };
    }
    if (qtype === 'none') {
      return { ok: true, type: 'none', message: 'No valid solution exists' };
    }
    return applyOpts(solutions, varName, opts, 'quadratic');
  }

  // Higher degree — numeric
  const complexRoots = durandKerner(poly);
  const realRoots = complexRoots
    .filter(r => Math.abs(r.im) < 1e-6)
    .map(r => r.re);

  if (realRoots.length === 0) {
    return { ok: true, type: 'no_real', message: 'No real solutions exist' };
  }

  return applyOpts(realRoots, varName, opts, `degree_${deg}`);
}

function applyOpts(solutions, varName, opts, type) {
  let filtered = solutions;

  if (opts.nonNegativeOnly) {
    filtered = filtered.filter(x => x >= -1e-9);
  }
  if (opts.integerOnly) {
    filtered = filtered
      .filter(x => Math.abs(x - Math.round(x)) < 1e-6)
      .map(x => Math.round(x));
  }

  if (filtered.length === 0) {
    const detail = opts.integerOnly
      ? 'No non-negative integer solutions exist'
      : opts.nonNegativeOnly
      ? 'No non-negative solutions exist'
      : 'No valid solution exists';
    return { ok: true, type: 'none', message: detail };
  }

  // Deduplicate
  const seen = new Set();
  filtered = filtered.filter(x => {
    const key = round(x, 8);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const formatted = filtered.map(x => `${varName} = ${formatNum(x)}`);
  return { ok: true, type, solutions: formatted, rawValues: filtered.map(x => ({ [varName]: round(x, 8) })) };
}

module.exports = {
  astToUnivariatePoly,
  equationToPoly,
  solveUnivariatePolynomial,
  solveQuadratic,
  durandKerner,
  collectVars,
  containsVariable,
  isNonlinearAST,
  isNonLinear,
  polyDegree,
  polyEval,
  formatNum,
  round,
};
