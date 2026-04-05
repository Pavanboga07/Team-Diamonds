/**
 * STEP 2 — Parser
 *
 * Converts tokens into:
 * 1) RPN (postfix) using the shunting-yard algorithm
 * 2) An AST (expression tree) from that RPN
 *
 * This module does NOT solve anything. It only structures the equation.
 */

/** @typedef {{ type: 'number', value: number } | { type: 'ident', value: string } | { type: 'op', value: string } | { type: 'paren', value: '('|')'|'['|']' }} Token */

const OPEN_TO_CLOSE = {
  "(": ")",
  "[": "]",
};

const CLOSE_TO_OPEN = {
  ")": "(",
  "]": "[",
};

const PRECEDENCE = {
  "u-": 4,
  "^": 3,
  "*": 2,
  "/": 2,
  "+": 1,
  "-": 1,
};

const RIGHT_ASSOC = new Set(["u-", "^"]);

function isOperatorToken(t) {
  return t.type === "op" && t.value !== "=";
}

function isValueToken(t) {
  return t.type === "number" || t.type === "ident";
}

function isOpenParen(t) {
  return t.type === "paren" && Object.prototype.hasOwnProperty.call(OPEN_TO_CLOSE, t.value);
}

function isCloseParen(t) {
  return t.type === "paren" && Object.prototype.hasOwnProperty.call(CLOSE_TO_OPEN, t.value);
}

function precedenceOf(op) {
  const p = PRECEDENCE[op];
  if (p == null) throw new Error(`Unsupported operator '${op}'.`);
  return p;
}

/**
 * Convert '-' tokens to unary minus ('u-') where appropriate.
 * Unary if '-' occurs:
 *  - at the beginning
 *  - after another operator
 *  - after an opening parenthesis
 *  - after '='
 * @param {Token[]} tokens
 * @returns {Token[]}
 */
function rewriteUnaryMinus(tokens) {
  /** @type {Token[]} */
  const out = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "op" && t.value === "-") {
      const prev = out[out.length - 1];
      const unary =
        !prev ||
        (prev.type === "op" && prev.value !== ")") ||
        (prev.type === "paren" && Object.prototype.hasOwnProperty.call(OPEN_TO_CLOSE, prev.value)) ||
        (prev.type === "op" && prev.value === "=");

      if (unary) {
        out.push({ type: "op", value: "u-" });
        continue;
      }
    }

    out.push(t);
  }

  return out;
}

/**
 * Shunting-yard algorithm: infix tokens -> postfix (RPN).
 * @param {Token[]} tokens Expression tokens ONLY (no '=')
 * @returns {Token[]}
 */
function toRpn(tokens) {
  const input = rewriteUnaryMinus(tokens);

  /** @type {Token[]} */
  const output = [];
  /** @type {Token[]} */
  const ops = [];

  for (const t of input) {
    if (isValueToken(t)) {
      output.push(t);
      continue;
    }

    if (isOpenParen(t)) {
      ops.push(t);
      continue;
    }

    if (isCloseParen(t)) {
      const expectedOpen = CLOSE_TO_OPEN[t.value];
      let found = false;

      while (ops.length) {
        const top = ops.pop();
        if (!top) break;

        if (top.type === "paren" && top.value === expectedOpen) {
          found = true;
          break;
        }

        if (top.type === "op") {
          output.push(top);
        } else {
          throw new Error("Invalid parser state while closing parentheses.");
        }
      }

      if (!found) {
        throw new Error(`Mismatched closing bracket '${t.value}'.`);
      }

      continue;
    }

    if (isOperatorToken(t)) {
      const o1 = t.value;
      const p1 = precedenceOf(o1);

      while (ops.length) {
        const top = ops[ops.length - 1];
        if (!top) break;

        if (top.type === "paren") break;
        if (top.type !== "op") throw new Error("Invalid operator stack state.");

        const o2 = top.value;
        const p2 = precedenceOf(o2);

        const shouldPop = RIGHT_ASSOC.has(o1) ? p1 < p2 : p1 <= p2;
        if (!shouldPop) break;

        output.push(ops.pop());
      }

      ops.push(t);
      continue;
    }

    if (t.type === "op" && t.value === "=") {
      throw new Error("'=' is not allowed inside an expression; split the equation first.");
    }

    throw new Error(`Unsupported token in expression: ${JSON.stringify(t)}`);
  }

  while (ops.length) {
    const top = ops.pop();
    if (!top) break;

    if (top.type === "paren") {
      throw new Error("Mismatched opening bracket.");
    }

    output.push(top);
  }

  return output;
}

/** AST node shapes */

/** @typedef {{ type: 'NumberLiteral', value: number } | { type: 'Variable', name: string } | { type: 'UnaryExpression', op: 'u-', arg: AstNode } | { type: 'BinaryExpression', op: '+'|'-'|'*'|'/', left: AstNode, right: AstNode } AstNode */
/** @typedef {{ type: 'Equation', left: AstNode, right: AstNode }} EquationAst */

function numberNode(value) {
  return { type: "NumberLiteral", value };
}

function variableNode(name) {
  return { type: "Variable", name };
}

function unaryNode(op, arg) {
  return { type: "UnaryExpression", op, arg };
}

function binaryNode(op, left, right) {
  return { type: "BinaryExpression", op, left, right };
}

/**
 * Build an AST from RPN.
 * @param {Token[]} rpn
 * @returns {AstNode}
 */
function rpnToAst(rpn) {
  /** @type {AstNode[]} */
  const stack = [];

  for (const t of rpn) {
    if (t.type === "number") {
      stack.push(numberNode(t.value));
      continue;
    }

    if (t.type === "ident") {
      stack.push(variableNode(t.value));
      continue;
    }

    if (t.type === "op") {
      if (t.value === "u-") {
        const arg = stack.pop();
        if (!arg) throw new Error("Unary '-' missing operand.");
        stack.push(unaryNode("u-", arg));
        continue;
      }

      if (t.value === "+" || t.value === "-" || t.value === "*" || t.value === "/" || t.value === "^") {
        const right = stack.pop();
        const left = stack.pop();
        if (!left || !right) throw new Error(`Operator '${t.value}' missing operand(s).`);
        stack.push(binaryNode(t.value, left, right));
        continue;
      }

      throw new Error(`Unsupported operator in RPN: '${t.value}'.`);
    }

    throw new Error(`Unexpected token in RPN: ${JSON.stringify(t)}`);
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression: leftover operands/operators after parsing.");
  }

  return stack[0];
}

/**
 * Parse a token list as an expression (no '=' allowed).
 * @param {Token[]} tokens
 * @returns {{ rpn: Token[], ast: AstNode }}
 */
function parseExpression(tokens) {
  const rpn = toRpn(tokens);
  const ast = rpnToAst(rpn);
  return { rpn, ast };
}

/**
 * Split equation tokens around a single '='.
 * @param {Token[]} tokens
 * @returns {{ left: Token[], right: Token[] }}
 */
function splitEquationTokens(tokens) {
  const eqIndexes = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "op" && t.value === "=") eqIndexes.push(i);
  }

  if (eqIndexes.length !== 1) {
    throw new Error("Equation must contain exactly one '='.");
  }

  const idx = eqIndexes[0];
  const left = tokens.slice(0, idx);
  const right = tokens.slice(idx + 1);

  if (!left.length || !right.length) {
    throw new Error("Equation must have expressions on both sides of '='.");
  }

  return { left, right };
}

/**
 * Parse a full equation into { leftAst, rightAst }.
 * @param {Token[]} tokens
 * @returns {{ equation: EquationAst, leftRpn: Token[], rightRpn: Token[] }}
 */
function parseEquation(tokens) {
  const { left, right } = splitEquationTokens(tokens);
  const leftParsed = parseExpression(left);
  const rightParsed = parseExpression(right);

  return {
    equation: { type: "Equation", left: leftParsed.ast, right: rightParsed.ast },
    leftRpn: leftParsed.rpn,
    rightRpn: rightParsed.rpn,
  };
}

/**
 * Pretty-print AST for debugging.
 * @param {AstNode | EquationAst} node
 * @returns {string}
 */
function astToString(node) {
  if (node.type === "Equation") {
    return `${astToString(node.left)} = ${astToString(node.right)}`;
  }

  if (node.type === "NumberLiteral") return String(node.value);
  if (node.type === "Variable") return node.name;

  if (node.type === "UnaryExpression") {
    if (node.op === "u-") return `(-${astToString(node.arg)})`;
    return `(${node.op}${astToString(node.arg)})`;
  }

  if (node.type === "BinaryExpression") {
    return `(${astToString(node.left)} ${node.op} ${astToString(node.right)})`;
  }

  return "<unknown>";
}

module.exports = {
  toRpn,
  rpnToAst,
  parseExpression,
  splitEquationTokens,
  parseEquation,
  astToString,
};
