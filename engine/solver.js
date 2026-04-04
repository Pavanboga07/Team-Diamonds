/**
 * STEP 4 — Basic Solver (whole-number, non-negative)
 *
 * Solves a normalized LINEAR equation:
 *   a1*x1 + a2*x2 + ... + an*xn = constant
 *
 * Requirements for this step:
 * - whole-number solutions only
 * - non-negative values only
 * - use backtracking (not nested brute-force loops)
 *
 * NOTE (intentional for Step 4):
 * - This solver currently supports POSITIVE integer coefficients and a non-negative constant.
 * - Edge cases like negative/zero coefficients, infinite solutions, etc. are handled in Step 6.
 */

/** @typedef {{ coefficients: Record<string, number>, constant: number }} NormalizedEquation */

const {
  normalizeConstraints,
  domainFor,
  satisfiesAll,
} = require("./constraints");

function assertSafeInteger(n, label) {
  if (!Number.isSafeInteger(n)) throw new Error(`${label} must be a safe integer.`);
}

function validateNormalizedInput(eq) {
  if (!eq || typeof eq !== "object") throw new Error("Normalized equation is required.");
  if (!eq.coefficients || typeof eq.coefficients !== "object") {
    throw new Error("coefficients must be an object.");
  }

  assertSafeInteger(eq.constant, "constant");
  if (eq.constant < 0) {
    throw new Error("Step 4 solver expects a non-negative constant.");
  }

  const vars = Object.keys(eq.coefficients);
  if (vars.length === 0) throw new Error("No variables found to solve for.");

  for (const v of vars) {
    const a = eq.coefficients[v];
    assertSafeInteger(a, `coefficient for ${v}`);
    if (a <= 0) {
      throw new Error(
        `Step 4 solver expects positive coefficients only; got ${v}: ${a}`
      );
    }
  }

  return vars;
}

function cloneSolution(solution) {
  return { ...solution };
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function gcdAll(values) {
  let g = 0;
  for (const v of values) g = gcd(g, v);
  return g;
}

/**
 * Solve 1-variable equation a*x = c.
 * @param {string} variable
 * @param {number} a
 * @param {number} c
 */
function solve1(variable, a, c) {
  if (c % a !== 0) return [];
  const x = c / a;
  if (x < 0) return [];
  return [{ [variable]: x }];
}

/**
 * General N-variable backtracking solver.
 * Deterministic order: variables are sorted alphabetically.
 * @param {NormalizedEquation} eq
 * @param {Record<string, any> | undefined | null} [constraintsRaw]
 * @param {{ maxResults?: number }} [options]
 * @returns {Array<Record<string, number>>}
 */
function solveNormalized(eq, constraintsRaw, options) {
  const maxResults = options?.maxResults ?? 200;
  const vars = validateNormalizedInput(eq);
  const coeffs = eq.coefficients;
  const constant = eq.constant;

   const constraints = normalizeConstraints(constraintsRaw);

  // Variable ordering heuristic: larger coefficient first => smaller branching factor.
  // Deterministic: tie-break by variable name.
  const variables = vars
    .slice()
    .sort((a, b) => (coeffs[b] - coeffs[a]) || a.localeCompare(b));

  if (variables.length === 1) {
    const v = variables[0];
    const base = solve1(v, coeffs[v], constant);
    if (!base.length) return [];

    const x = base[0][v];
    const dom = domainFor(v, constraints, x);
    if (x < dom.min || x > dom.max) return [];
    if (!satisfiesAll(base[0], constraints)) return [];
    return base;
  }

  /** @type {Array<Record<string, number>>} */
  const solutions = [];

  function reachedLimit() {
    return solutions.length >= maxResults;
  }

  /**
   * Prune using constraint-aware min/max bounds and gcd divisibility.
   * @param {number} index
   * @param {number} remaining
   */
  function canStillSolve(index, remaining) {
    // Compute shifted remaining after applying mins for variables index..end.
    let minSum = 0;
    let maxSum = 0;

    /** @type {number[]} */
    const aList = [];

    for (let j = index; j < variables.length; j++) {
      const v = variables[j];
      const a = coeffs[v];
      aList.push(a);

      const hardMax = Math.floor(remaining / a);
      const dom = domainFor(v, constraints, hardMax);

      if (dom.max < dom.min) return false; // empty domain

      minSum += a * dom.min;
      maxSum += a * dom.max;
      if (minSum > remaining) return false;
    }

    if (remaining < minSum) return false;
    if (remaining > maxSum) return false;

    const shifted = remaining - minSum;
    const g = gcdAll(aList);
    if (g !== 0 && shifted % g !== 0) return false;

    return true;
  }

  /**
   * @param {number} index
   * @param {number} remaining
   * @param {Record<string, number>} partial
   */
  function backtrack(index, remaining, partial) {
    if (reachedLimit()) return;
    if (!canStillSolve(index, remaining)) return;

    const v = variables[index];
    const a = coeffs[v];

    if (index === variables.length - 1) {
      // Last variable: direct compute.
      if (remaining % a !== 0) return;
      const x = remaining / a;
      if (x < 0) return;
      const candidate = { ...partial, [v]: x };
      if (satisfiesAll(candidate, constraints)) {
        solutions.push(candidate);
      }
      return;
    }

    const hardMax = Math.floor(remaining / a);
    const dom = domainFor(v, constraints, hardMax);
    for (let x = dom.min; x <= dom.max; x += dom.step) {
      const nextRemaining = remaining - a * x;
      // nextRemaining is always >= 0 due to max
      partial[v] = x;
      backtrack(index + 1, nextRemaining, partial);

      if (reachedLimit()) break;
    }

    delete partial[v];
  }

  backtrack(0, constant, {});
  return solutions;
}

module.exports = {
  solveNormalized,
};
