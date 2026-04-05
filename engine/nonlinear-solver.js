'use strict';
/**
 * Non-Linear Integer Solver
 *
 * Solves multi-variable equations that contain non-linear terms (e.g. x^2, y^2)
 * and returns ALL non-negative integer solutions within bounds.
 *
 * Algorithm:
 *  1. Compute per-variable upper bounds via binary search (computeBound).
 *  2. Sort variables so the one with the largest linear coefficient becomes the
 *     "last variable" — it has the fewest possible values so we solve for it
 *     analytically in the inner-most step instead of iterating.
 *  3. Backtrack over all but the last variable.
 *  4. For each partial assignment, determine the last variable by:
 *       a. If the remaining sub-equation is linear in lastVar → exact solve.
 *       b. If quadratic in lastVar → quadratic formula.
 *       c. Otherwise → bounded integer scan (fall-back).
 *  5. Verify every candidate exactly against the original equation before
 *     accepting it (epsilon = 1e-6 for floating-point safety).
 *  6. Monotone pruning: if the partial assignment (others = 0) already
 *     makes LHS > RHS, the remaining branch is infeasible → prune.
 */

const {
  evaluateEquation,
  estimateLinearCoeff,
  computeBound,
  EPSILON,
} = require('./evaluator');

const VERIFY_EPS = 1e-6; // tolerance for final solution verification

/**
 * Solves for the last variable given all others are fixed.
 *
 * Uses finite differences to detect the degree of dependence on lastVar,
 * then applies the appropriate formula.
 *
 * @param {{ type:'Equation' }} equationAst
 * @param {string}              lastVar
 * @param {Record<string,number>} fixed   other variables, all assigned
 * @param {number}              maxVal   upper bound for lastVar
 * @returns {number[]}  accepted non-negative integer value(s)
 */
function solveForLastVar(equationAst, lastVar, fixed, maxVal) {
  // Evaluate at z=0, z=1, z=2 to determine degree in lastVar
  let at0, at1, at2;
  try {
    at0 = evaluateEquation(equationAst, { ...fixed, [lastVar]: 0 });
    at1 = evaluateEquation(equationAst, { ...fixed, [lastVar]: 1 });
    at2 = evaluateEquation(equationAst, { ...fixed, [lastVar]: 2 });
  } catch {
    return [];
  }

  const c1 = at1 - at0;                // linear coefficient in lastVar
  const c2 = at2 - 2 * at1 + at0;     // quadratic coefficient (second difference)

  const results = [];

  if (Math.abs(c2) < EPSILON) {
    // Linear in lastVar: at0 + c1*z = 0  →  z = −at0/c1
    if (Math.abs(c1) < EPSILON) return []; // no dependence on lastVar
    const z = -at0 / c1;
    if (z >= -EPSILON && z <= maxVal + EPSILON) {
      const zi = Math.round(z);
      if (zi >= 0 && zi <= maxVal) results.push(zi);
    }
  } else {
    // Quadratic in lastVar: at0 + c1*z + (c2/2)*z^2 = 0
    // → c2/2 * z^2 + c1 * z + at0 = 0
    const a = c2 / 2, b = c1, c = at0;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const sq = Math.sqrt(disc);
    for (const root of [(-b + sq) / (2 * a), (-b - sq) / (2 * a)]) {
      if (root >= -EPSILON && root <= maxVal + EPSILON) {
        const zi = Math.round(root);
        if (zi >= 0 && zi <= maxVal) results.push(zi);
      }
    }
  }

  return results;
}

/**
 * Solve a multi-variable non-linear equation for non-negative integer solutions.
 *
 * @param {{ type:'Equation', left:object, right:object }} equationAst
 * @param {string[]}          variables     all variable names (any order)
 * @param {object}            constraints   { x: { min?, max? }, ... }
 * @param {object}            options       { maxResults? }
 * @returns {{ ok: boolean, type: string, solutions?: Array<Record<string,number>>, message?: string }}
 */
function solveNonlinear(equationAst, variables, constraints = {}, options = {}) {
  const maxResults = options.maxResults ?? 200;
  const allVars    = [...variables].sort();

  // ── Trivial: no variables ──────────────────────────────────────────────────
  if (allVars.length === 0) {
    try {
      const val = evaluateEquation(equationAst, {});
      return Math.abs(val) < EPSILON
        ? { ok: true, type: 'infinite',  message: 'Infinite solutions exist' }
        : { ok: true, type: 'none',      message: 'No valid solution exists'  };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  // ── Estimate linear coefficients (for variable ordering) ──────────────────
  const linCoeffs = {};
  for (const v of allVars) {
    linCoeffs[v] = estimateLinearCoeff(equationAst, v, allVars);
  }

  // Sort ASCENDING by |linear coeff| so the variable with the LARGEST linear
  // coefficient is LAST — it has the most linear behavior and is easiest to
  // solve analytically (ax = c is exact; a large coefficient means few valid
  // integer values, further reducing the search space).
  const sortedVars = [...allVars].sort(
    (a, b) => Math.abs(linCoeffs[a]) - Math.abs(linCoeffs[b])
  );
  const iterVars = sortedVars.slice(0, -1);  // variables we iterate over
  const lastVar  = sortedVars[sortedVars.length - 1]; // variable solved analytically

  // ── Compute per-variable bounds ───────────────────────────────────────────
  const bounds = {};
  for (const v of allVars) {
    const userMax  = constraints[v]?.max;
    const userMin  = Math.max(0, constraints[v]?.min ?? 0);
    const autoMax  = computeBound(equationAst, v, allVars, userMax);
    bounds[v] = { min: userMin, max: autoMax };
  }

  // ── Backtracking ──────────────────────────────────────────────────────────
  const solutions = [];
  const partial   = {};
  const zeros     = {};
  for (const v of allVars) zeros[v] = 0;

  /**
   * Monotone-feasibility pruning:
   * If the partial assignment alone (with all unset vars = 0) already
   * makes LHS − RHS > 0, the branch is infeasible (assuming all terms
   * are monotone increasing in each variable).
   */
  function canPrune() {
    try {
      const test = { ...zeros, ...partial };
      return evaluateEquation(equationAst, test) > EPSILON;
    } catch {
      return false; // never prune on eval errors
    }
  }

  function backtrack(idx) {
    if (solutions.length >= maxResults) return;
    if (canPrune()) return;

    if (idx === iterVars.length) {
      // ── Inner step: solve analytically for lastVar ──────────────────────
      const { min: zMin, max: zMax } = bounds[lastVar];
      const candidates = solveForLastVar(equationAst, lastVar, { ...partial }, zMax);

      for (const z of candidates) {
        if (z < zMin || z > zMax) continue;
        const candidate = { ...partial, [lastVar]: z };
        // Final exact verification
        try {
          const residual = evaluateEquation(equationAst, candidate);
          if (Math.abs(residual) <= VERIFY_EPS) {
            solutions.push(candidate);
            if (solutions.length >= maxResults) return;
          }
        } catch { /* skip */ }
      }
      return;
    }

    const v = iterVars[idx];
    const { min, max } = bounds[v];

    for (let x = min; x <= max && solutions.length < maxResults; x++) {
      partial[v] = x;
      backtrack(idx + 1);
    }
    delete partial[v];
  }

  try {
    backtrack(0);
  } catch (e) {
    return { ok: false, message: `Solver error: ${e.message}` };
  }

  if (solutions.length === 0) {
    return { ok: true, type: 'none', message: 'No valid solution exists' };
  }

  return { ok: true, type: 'nonlinear_integer', solutions };
}

module.exports = { solveNonlinear };
