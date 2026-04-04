const assert = require("assert");
const { tokenizeEquation, tokenToString } = require("./tokenizer");

function toLexemeString(tokens) {
  return tokens.map(tokenToString).join(" ");
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

test("tokenizes basic equation and inserts implicit multiplication", () => {
  const tokens = tokenizeEquation("(10x + 20y) * 2 = 500");
  assert.strictEqual(
    toLexemeString(tokens),
    "( 10 * x + 20 * y ) * 2 = 500"
  );
});

test("handles variable-variable implicit multiplication (xy)", () => {
  const tokens = tokenizeEquation("xy=10");
  assert.strictEqual(toLexemeString(tokens), "x * y = 10");
});

test("handles number-paren and paren-number implicit multiplication", () => {
  const t1 = tokenizeEquation("3(x+2)");
  assert.strictEqual(toLexemeString(t1), "3 * ( x + 2 )");

  const t2 = tokenizeEquation("(x+2)3");
  assert.strictEqual(toLexemeString(t2), "( x + 2 ) * 3");
});

test("handles adjacent parentheses implicit multiplication", () => {
  const tokens = tokenizeEquation("(x+1)(y+2)");
  assert.strictEqual(toLexemeString(tokens), "( x + 1 ) * ( y + 2 )");
});

test("handles square brackets as parens", () => {
  const tokens = tokenizeEquation("[10x+2]=12");
  assert.strictEqual(toLexemeString(tokens), "[ 10 * x + 2 ] = 12");
});

test("throws on unexpected characters", () => {
  assert.throws(() => tokenizeEquation("x @ 2 = 3"), /Unexpected character/);
});

console.log("\nAll tokenizer tests passed.");
