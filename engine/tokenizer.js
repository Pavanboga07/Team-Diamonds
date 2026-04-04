/**
 * STEP 1 — Tokenizer (Lexer)
 *
 * Goal: Convert an equation string into tokens without evaluating it.
 * - Handles multi-digit integers
 * - Handles variables (single letters)
 * - Operators: + - * / =
 * - Brackets: ( ) [ ]
 * - Implicit multiplication: 10x -> 10 * x, 2(x+1) -> 2 * (x+1), xy -> x * y
 */

/** @typedef {{ type: 'number', value: number } | { type: 'ident', value: string } | { type: 'op', value: '+'|'-'|'*'|'/'|'=' } | { type: 'paren', value: '('|')'|'['|']' }} Token */

const OPS = new Set(["+", "-", "*", "/", "="]);
const OPEN = new Set(["(", "["]);
const CLOSE = new Set([")", "]"]);

function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function isAlpha(ch) {
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function tokenToString(t) {
  if (t.type === "number") return String(t.value);
  return t.value;
}

function isAtomStart(t) {
  return t.type === "number" || t.type === "ident" || (t.type === "paren" && OPEN.has(t.value));
}

function isAtomEnd(t) {
  return t.type === "number" || t.type === "ident" || (t.type === "paren" && CLOSE.has(t.value));
}

/**
 * Inserts explicit '*' where multiplication is implied.
 * Example: [10, x] -> [10, '*', x]
 *
 * Rule: If an "atom" ends and the next token is an "atom" start, insert '*'.
 * Excludes cases where either side is '='.
 *
 * Atom end: number, ident, ')', ']'
 * Atom start: number, ident, '(', '['
 */
function insertImplicitMultiplication(tokens) {
  /** @type {Token[]} */
  const out = [];

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    out.push(current);

    const next = tokens[i + 1];
    if (!next) continue;

    if (current.type === "op" && current.value === "=") continue;
    if (next.type === "op" && next.value === "=") continue;

    if (isAtomEnd(current) && isAtomStart(next)) {
      out.push({ type: "op", value: "*" });
    }
  }

  return out;
}

/**
 * Tokenize an equation string.
 * @param {string} input
 * @returns {Token[]}
 */
function tokenizeEquation(input) {
  if (typeof input !== "string") {
    throw new Error("Equation input must be a string.");
  }

  /** @type {Token[]} */
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (isWhitespace(ch)) {
      i++;
      continue;
    }

    if (OPS.has(ch)) {
      tokens.push({ type: "op", value: /** @type {any} */ (ch) });
      i++;
      continue;
    }

    if (OPEN.has(ch) || CLOSE.has(ch)) {
      tokens.push({ type: "paren", value: /** @type {any} */ (ch) });
      i++;
      continue;
    }

    if (isDigit(ch)) {
      let start = i;
      while (i < input.length && isDigit(input[i])) i++;
      const raw = input.slice(start, i);
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) {
        throw new Error(`Invalid or unsafe integer literal: ${raw}`);
      }
      tokens.push({ type: "number", value });
      continue;
    }

    // Variables are single letters (per project spec).
    // This makes "xy" tokenize as "x" "y" and then become "x * y" via implicit multiplication.
    if (isAlpha(ch)) {
      tokens.push({ type: "ident", value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}.`);
  }

  return insertImplicitMultiplication(tokens);
}

module.exports = {
  tokenizeEquation,
  insertImplicitMultiplication,
  tokenToString,
};
