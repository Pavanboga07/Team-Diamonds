'use strict';
/**
 * Numeric AST Evaluator
 *
 * Walks any expression AST and computes a floating-point value given
 * a variable assignment map like { x: 3, y: 7 }.
 *
 * Supports: NumberLiteral, Variable, UnaryExpression(u-),
 *           BinaryExpression(+, -, *, /, ^)
 */

const EPSILON = 1e-9;

/**
 * Evaluate an expression AST node.
 * @param {object} node
 * @param {Record<string, number>} vars  variable → value mapping
 * @returns {number}
 */
function evaluate(node, vars) {
  if (!node) throw new Error('Null AST node.');

  switch (node.type) {
    case 'NumberLiteral':
      return node.value;

    case 'Variable': {
      const val = vars[node.name];
      if (val === undefined) throw new Error(`Variable '${node.name}' is not assigned.`);
      return val;
    }

    case 'UnaryExpression':
      if (node.op === 'u-') return -evaluate(node.arg, vars);
      throw new Error(`Unknown unary operator: ${node.op}`);

    case 'BinaryExpression': {
      const L = evaluate(node.left, vars);
      const R = evaluate(node.right, vars);
      switch (node.op) {
        case '+': return L + R;
        case '-': return L - R;
        case '*': return L * R;
        case '/':
          if (Math.abs(R) < 1e-15) throw new Error('Division by zero.');
          return L / R;
        case '^':
          return Math.pow(L, R);
        default:
          throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }

    default:
      throw new Error(`Unknown AST node type: ${node.type}`);
  }
}

/**
 * Evaluate both sides of an Equation AST and return LHS − RHS.
 * Returns ≈ 0 when the assignment satisfies the equation.
 * @param {{ type:'Equation', left:object, right:object }} equationAst
 * @param {Record<string, number>} vars
 * @returns {number}
 */
function evaluateEquation(equationAst, vars) {
  return evaluate(equationAst.left, vars) - evaluate(equationAst.right, vars);
}

/**
 * Numerically estimate the linear coefficient of `varName` in the equation,
 * treating all other variables as 0.
 *
 *   coeff ≈ f(varName=1, others=0) − f(varName=0, others=0)
 *
 * This is exact for purely-linear terms and gives a safe upper-bound
 * estimate for equations with mixed linear + non-linear terms.
 *
 * @param {{ type:'Equation' }} equationAst
 * @param {string}   varName
 * @param {string[]} allVars
 * @returns {number}
 */
function estimateLinearCoeff(equationAst, varName, allVars) {
  const zeros = {};
  for (const v of allVars) zeros[v] = 0;
  try {
    const at0 = evaluateEquation(equationAst, zeros);
    const at1 = evaluateEquation(equationAst, { ...zeros, [varName]: 1 });
    return at1 - at0;
  } catch {
    return 1; // safe fallback
  }
}

/**
 * Compute an integer upper bound for `varName` such that, when all other
 * variables are 0, the equation is still feasible (LHS ≤ RHS).
 *
 * Uses binary search so it works for both linear and non-linear equations.
 * Assumes the equation is monotone-increasing in each variable
 * (all terms contribute non-negatively as variable values grow).
 *
 * @param {{ type:'Equation' }} equationAst
 * @param {string}   varName
 * @param {string[]} allVars
 * @param {number|undefined} userMax  explicit max from constraints
 * @returns {number}
 */
function computeBound(equationAst, varName, allVars, userMax) {
  if (userMax != null) return Math.floor(userMax);

  const zeros = {};
  for (const v of allVars) zeros[v] = 0;

  // f(x) = LHS(x, others=0) − RHS; feasible when f(x) <= 0
  function feasible(x) {
    try {
      return evaluateEquation(equationAst, { ...zeros, [varName]: x }) <= EPSILON;
    } catch {
      return false;
    }
  }

  if (!feasible(0)) return 0; // Already infeasible at 0

  // Exponential expansion to find an upper infeasible value
  let hi = 1;
  while (hi <= 1_000_000 && feasible(hi)) hi *= 2;
  if (hi > 1_000_000) return Math.min(hi, 50_000); // Safety cap

  // Binary search for the largest feasible integer
  let lo = 0;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (feasible(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

module.exports = {
  evaluate,
  evaluateEquation,
  estimateLinearCoeff,
  computeBound,
  EPSILON,
};
