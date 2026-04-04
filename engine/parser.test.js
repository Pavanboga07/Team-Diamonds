const assert = require("assert");
const { tokenizeEquation } = require("./tokenizer");
const { parseEquation, astToString } = require("./parser");

function rpnLexemes(rpn) {
  return rpn.map((t) => (t.type === "number" ? String(t.value) : t.value)).join(" ");
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("parses equation and creates RPN for both sides", () => {
  const tokens = tokenizeEquation("(10x + 20y) * 2 = 500");
  const parsed = parseEquation(tokens);

  assert.strictEqual(rpnLexemes(parsed.leftRpn), "10 x * 20 y * + 2 *");
  assert.strictEqual(rpnLexemes(parsed.rightRpn), "500");
  assert.strictEqual(astToString(parsed.equation), "(((10 * x) + (20 * y)) * 2) = 500");
});

test("respects operator precedence (1 + 2*3)", () => {
  const tokens = tokenizeEquation("1 + 2*3 = 7");
  const parsed = parseEquation(tokens);

  assert.strictEqual(rpnLexemes(parsed.leftRpn), "1 2 3 * +");
  assert.strictEqual(astToString(parsed.equation), "(1 + (2 * 3)) = 7");
});

test("handles unary minus at expression start", () => {
  const tokens = tokenizeEquation("-x + 2 = 0");
  const parsed = parseEquation(tokens);

  assert.strictEqual(rpnLexemes(parsed.leftRpn), "x u- 2 +");
  assert.strictEqual(astToString(parsed.equation), "((-x) + 2) = 0");
});

test("handles unary minus with parentheses", () => {
  const tokens = tokenizeEquation("-(x+1) = 0");
  const parsed = parseEquation(tokens);

  assert.strictEqual(rpnLexemes(parsed.leftRpn), "x 1 + u-");
});

test("rejects multiple equals", () => {
  const tokens = tokenizeEquation("x=1=2");
  assert.throws(() => parseEquation(tokens), /exactly one '='/);
});

test("rejects mismatched parentheses", () => {
  const tokens = tokenizeEquation("(x+1 = 2");
  assert.throws(() => parseEquation(tokens), /Mismatched opening bracket/);
});

console.log("\nAll parser tests passed.");
