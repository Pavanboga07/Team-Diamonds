const assert = require("assert");
const { tokenizeEquation } = require("./tokenizer");
const { parseEquation } = require("./parser");
const { normalizeEquation } = require("./normalizer");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("normalizes (10x+20y)*2=500", () => {
  const tokens = tokenizeEquation("(10x + 20y) * 2 = 500");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);

  assert.deepStrictEqual(norm, {
    coefficients: { x: 20, y: 40 },
    constant: 500,
  });
});

test("normalizes x+2=5", () => {
  const tokens = tokenizeEquation("x + 2 = 5");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);

  assert.deepStrictEqual(norm, {
    coefficients: { x: 1 },
    constant: 3,
  });
});

test("normalizes 2(x+1)=10", () => {
  const tokens = tokenizeEquation("2(x+1)=10");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);

  assert.deepStrictEqual(norm, {
    coefficients: { x: 2 },
    constant: 8,
  });
});

test("normalizes subtraction y-3=0", () => {
  const tokens = tokenizeEquation("y-3=0");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);

  assert.deepStrictEqual(norm, {
    coefficients: { y: 1 },
    constant: 3,
  });
});

test("rejects non-linear multiplication x*y", () => {
  const tokens = tokenizeEquation("x*y=2");
  const parsed = parseEquation(tokens);
  assert.throws(() => normalizeEquation(parsed.equation), /Non-linear term/);
});

test("rejects non-integer division x/2=1", () => {
  const tokens = tokenizeEquation("x/2=1");
  const parsed = parseEquation(tokens);
  assert.throws(() => normalizeEquation(parsed.equation), /non-integer coefficient/);
});

test("supports divisible division (2x)/2 = 3", () => {
  const tokens = tokenizeEquation("(2x)/2 = 3");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);

  assert.deepStrictEqual(norm, {
    coefficients: { x: 1 },
    constant: 3,
  });
});

console.log("\nAll normalizer tests passed.");
