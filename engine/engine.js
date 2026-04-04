/**
 * STEP 6 — Engine Facade + Edge Case Handling
 *
 * Provides a single entry point that:
 *  - tokenizes
 *  - parses
 *  - normalizes
 *  - solves (with constraints)
 *
 * and returns either:
 *  - Array<solutionObject>
 *  - or a string message (error/warning)
 *
 * This shape matches the planned API contract.
 */

const { tokenizeEquation } = require("./tokenizer");
const { parseEquation } = require("./parser");
const { normalizeEquation } = require("./normalizer");
const { solveNormalized } = require("./solver");
const { normalizeConstraints } = require("./constraints");

function isEmptyObject(obj) {
  return !obj || Object.keys(obj).length === 0;
}

/**
 * Solve an equation string with constraints.
 *
 * @param {string} equation
 * @param {Record<string, any> | undefined | null} constraintsRaw
 * @param {{ maxResults?: number } | undefined} options
 * @returns {Array<Record<string, number>> | string}
 */
function solveEquation(equation, constraintsRaw, options) {
  const maxResults = options?.maxResults ?? 200;

  try {
    if (typeof equation !== "string" || !equation.trim()) {
      return "Equation is required.";
    }

    const constraints = normalizeConstraints(constraintsRaw);

    const tokens = tokenizeEquation(equation);
    const parsed = parseEquation(tokens);
    const normalized = normalizeEquation(parsed.equation);

    // Edge case: equation reduces to constant-only equality.
    if (isEmptyObject(normalized.coefficients)) {
      if (normalized.constant === 0) {
        return "Infinite solutions: the equation is always true.";
      }
      return "No solutions: the equation is inconsistent.";
    }

    // Step-4 solver limitation: positive coefficients.
    // We'll support negatives later once we have robust bounding + pruning.
    for (const [v, a] of Object.entries(normalized.coefficients)) {
      if (a <= 0) {
        return `Unsupported equation for now: coefficient for '${v}' is ${a}. Only positive coefficients are supported in this phase.`;
      }
    }

    const solutions = solveNormalized(normalized, constraints);
    if (!solutions.length) {
      return "No solutions found (whole-number, non-negative).";
    }

    return solutions.slice(0, maxResults);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return `Invalid equation: ${message}`;
  }
}

module.exports = {
  solveEquation,
};
