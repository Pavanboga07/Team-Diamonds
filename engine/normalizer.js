/**
 * STEP 3 — Normalizer (Linear Form)
 *
 * Converts a parsed equation AST into a standard linear form:
 *   a1*x1 + a2*x2 + ... = constant
 *
 * Output format:
 * {
 *   coefficients: { x: 10, y: 20 },
 *   constant: 100
 * }
 *
 * IMPORTANT: This normalizer intentionally supports LINEAR expressions only.
 * - Allowed: +, -, unary -, parentheses, implicit multiplication, number*expr
 * - Allowed: division by a non-zero integer constant if it divides evenly
 * - Rejected: variable * variable, division by variable/expression, non-integer results
 */

/** @typedef {{ type: 'NumberLiteral', value: number } | { type: 'Variable', name: string } | { type: 'UnaryExpression', op: 'u-', arg: AstNode } | { type: 'BinaryExpression', op: '+'|'-'|'*'|'/', left: AstNode, right: AstNode } AstNode */
/** @typedef {{ type: 'Equation', left: AstNode, right: AstNode }} EquationAst */

/** @typedef {{ constant: number, coefficients: Record<string, number> }} LinearForm */

function isSafeInt(n) {
  return Number.isSafeInteger(n);
}

function cloneCoeffs(c) {
  return { ...c };
}

function addCoeff(coeffs, variable, delta) {
  const next = (coeffs[variable] ?? 0) + delta;
  if (next === 0) {
    delete coeffs[variable];
  } else {
    coeffs[variable] = next;
  }
}

function normalizeCoeffs(coeffs) {
  for (const [k, v] of Object.entries(coeffs)) {
    if (v === 0) delete coeffs[k];
  }
  return coeffs;
}

function linearZero() {
  return { constant: 0, coefficients: {} };
}

function linearFromNumber(value) {
  if (!isSafeInt(value)) throw new Error("Only safe integers are supported.");
  return { constant: value, coefficients: {} };
}

function linearFromVariable(name) {
  return { constant: 0, coefficients: { [name]: 1 } };
}

function linearNeg(a) {
  const coeffs = {};
  for (const [k, v] of Object.entries(a.coefficients)) coeffs[k] = -v;
  return { constant: -a.constant, coefficients: coeffs };
}

function linearAdd(a, b) {
  const coeffs = cloneCoeffs(a.coefficients);
  for (const [k, v] of Object.entries(b.coefficients)) addCoeff(coeffs, k, v);
  const constant = a.constant + b.constant;
  if (!isSafeInt(constant)) throw new Error("Integer overflow in constant.");
  return { constant, coefficients: coeffs };
}

function linearSub(a, b) {
  return linearAdd(a, linearNeg(b));
}

function isConstantForm(f) {
  return Object.keys(f.coefficients).length === 0;
}

function linearScale(a, scalar) {
  if (!isSafeInt(scalar)) throw new Error("Scalar must be a safe integer.");
  const coeffs = {};
  for (const [k, v] of Object.entries(a.coefficients)) {
    const nv = v * scalar;
    if (!isSafeInt(nv)) throw new Error("Integer overflow in coefficient.");
    if (nv !== 0) coeffs[k] = nv;
  }
  const constant = a.constant * scalar;
  if (!isSafeInt(constant)) throw new Error("Integer overflow in constant.");
  return { constant, coefficients: coeffs };
}

function linearMul(a, b) {
  // Linear multiplication allowed only if one side is constant.
  if (isConstantForm(a)) return linearScale(b, a.constant);
  if (isConstantForm(b)) return linearScale(a, b.constant);
  throw new Error("Non-linear term detected: variable * variable.");
}

function linearDiv(a, denom) {
  // Linear division allowed only by a non-zero constant that divides evenly.
  if (!isConstantForm(denom)) {
    throw new Error("Division by a variable/expression is not supported.");
  }

  const d = denom.constant;
  if (d === 0) throw new Error("Division by zero.");

  if (a.constant % d !== 0) {
    throw new Error("Division produces non-integer constant.");
  }

  const coeffs = {};
  for (const [k, v] of Object.entries(a.coefficients)) {
    if (v % d !== 0) {
      throw new Error(`Division produces non-integer coefficient for ${k}.`);
    }
    coeffs[k] = v / d;
  }

  return { constant: a.constant / d, coefficients: normalizeCoeffs(coeffs) };
}

/**
 * Convert an AST expression to a linear form.
 * @param {AstNode} node
 * @returns {LinearForm}
 */
function astToLinearForm(node) {
  if (!node || typeof node !== "object") throw new Error("Invalid AST node.");

  if (node.type === "NumberLiteral") {
    return linearFromNumber(node.value);
  }

  if (node.type === "Variable") {
    return linearFromVariable(node.name);
  }

  if (node.type === "UnaryExpression") {
    if (node.op !== "u-") throw new Error(`Unsupported unary operator '${node.op}'.`);
    return linearNeg(astToLinearForm(node.arg));
  }

  if (node.type === "BinaryExpression") {
    const left = astToLinearForm(node.left);
    const right = astToLinearForm(node.right);

    if (node.op === "+") return linearAdd(left, right);
    if (node.op === "-") return linearSub(left, right);
    if (node.op === "*") return linearMul(left, right);
    if (node.op === "/") return linearDiv(left, right);

    throw new Error(`Unsupported binary operator '${node.op}'.`);
  }

  throw new Error(`Unknown AST node type '${node.type}'.`);
}

/**
 * Normalize a full equation AST into coefficients + constant.
 *
 * If left = right, and:
 *  left = Lc + sum(Li*xi)
 *  right = Rc + sum(Ri*xi)
 *
 * Then:
 *   sum((Li-Ri)*xi) = (Rc - Lc)
 *
 * @param {EquationAst} equation
 */
function normalizeEquation(equation) {
  if (!equation || equation.type !== "Equation") {
    throw new Error("Expected an Equation AST.");
  }

  const left = astToLinearForm(equation.left);
  const right = astToLinearForm(equation.right);

  /** @type {Record<string, number>} */
  const coefficients = {};

  const vars = new Set([...Object.keys(left.coefficients), ...Object.keys(right.coefficients)]);
  for (const v of vars) {
    const coeff = (left.coefficients[v] ?? 0) - (right.coefficients[v] ?? 0);
    if (coeff !== 0) coefficients[v] = coeff;
  }

  const constant = right.constant - left.constant;
  if (!isSafeInt(constant)) throw new Error("Integer overflow in constant.");

  return {
    coefficients,
    constant,
  };
}

module.exports = {
  astToLinearForm,
  normalizeEquation,
  linearZero,
};
